-- Bộ sưu tập theo thương hiệu + vai trò admin xem thống kê. Chạy SAU 202611030002_color_stock.sql.

-- ================= Bộ sưu tập (series) theo thương hiệu =================
create table if not exists public.collections (
  id text primary key,
  name text not null,
  brand text not null,
  room text not null,
  description text not null default '',
  sort_order integer not null default 0
);

create table if not exists public.collection_products (
  collection_id text not null references public.collections(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (collection_id, product_id)
);

alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
drop policy if exists "collections are publicly readable" on public.collections;
create policy "collections are publicly readable" on public.collections for select to anon, authenticated using (true);
drop policy if exists "collection products are publicly readable" on public.collection_products;
create policy "collection products are publicly readable" on public.collection_products for select to anon, authenticated using (true);
revoke insert, update, delete on public.collections, public.collection_products from anon, authenticated;
grant select on public.collections, public.collection_products to anon, authenticated;

insert into public.collections (id, name, brand, room, description, sort_order) values
  ('kova-phong-khach-bac-au', 'Phòng khách Bắc Âu', 'Kova Home', 'Phòng khách',
   'Trọn bộ phòng khách tông kem – xám: sofa chính, sofa 2 chỗ, bàn trà kính kèm ghế bành và đèn chùm LED.', 1),
  ('moc-an-phong-an-go-moc', 'Phòng ăn gỗ mộc', 'Mộc An', 'Phòng ăn',
   'Bàn ăn gỗ 6 ghế, ghế gỗ mộc bổ sung và đèn chùm khung gỗ cùng tông gỗ tự nhiên.', 2)
on conflict (id) do update set
  name = excluded.name, brand = excluded.brand, room = excluded.room,
  description = excluded.description, sort_order = excluded.sort_order;

insert into public.collection_products (collection_id, product_id, sort_order)
select item.collection_id, item.product_id, item.sort_order
from (values
  ('kova-phong-khach-bac-au', 16::bigint, 1),
  ('kova-phong-khach-bac-au', 11::bigint, 2),
  ('kova-phong-khach-bac-au', 30::bigint, 3),
  ('kova-phong-khach-bac-au', 5::bigint, 4),
  ('moc-an-phong-an-go-moc', 26::bigint, 1),
  ('moc-an-phong-an-go-moc', 19::bigint, 2),
  ('moc-an-phong-an-go-moc', 8::bigint, 3)
) as item(collection_id, product_id, sort_order)
where exists (select 1 from public.products where id = item.product_id)
on conflict (collection_id, product_id) do update set sort_order = excluded.sort_order;

-- ================= Admin =================
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "users see own admin row" on public.admins;
create policy "users see own admin row" on public.admins for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Giá vốn để tính "chi". Giá trị mặc định = 60% giá niêm yết (dữ liệu mẫu), cửa hàng sửa lại theo giá nhập thật.
alter table public.products add column if not exists cost_price bigint not null default 0;
alter table public.products drop constraint if exists products_cost_price_check;
alter table public.products add constraint products_cost_price_check check (cost_price >= 0);
update public.products set cost_price = round(price * 0.6)::bigint where cost_price = 0;

create or replace function public.product_default_cost()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(new.cost_price, 0) = 0 then
    new.cost_price := round(new.price * 0.6)::bigint;
  end if;
  return new;
end;
$$;

drop trigger if exists products_default_cost on public.products;
create trigger products_default_cost
  before insert on public.products
  for each row execute procedure public.product_default_cost();

-- ---------- Số liệu thống kê (chỉ admin gọi được) ----------
-- Thu: tiền hàng + phí giao của đơn đã giao trong kỳ. Chi: giá vốn của hàng đã giao + tiền cọc phải hoàn.
create or replace function public.admin_dashboard(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));
  v_today date := timezone('Asia/Ho_Chi_Minh', now())::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  with period_orders as (
    select * from public.orders where created_at >= v_from
  ),
  delivered as (
    select * from period_orders where status = 'delivered'
  ),
  delivered_items as (
    select item.*, product.cost_price
    from public.order_items item
    join delivered on delivered.id = item.order_id
    join public.products product on product.id = item.product_id
  )
  select jsonb_build_object(
    'days', greatest(coalesce(p_days, 30), 1),
    'summary', jsonb_build_object(
      'revenue', coalesce((select sum(total) from delivered), 0),
      'goodsRevenue', coalesce((select sum(total - shipping_fee) from delivered), 0),
      'shippingRevenue', coalesce((select sum(shipping_fee) from delivered), 0),
      'costOfGoods', coalesce((select sum(cost_price * quantity) from delivered_items), 0),
      'refundedDeposits', coalesce((select sum(deposit_amount) from period_orders where deposit_status = 'refunded'), 0),
      'depositsHeld', coalesce((select sum(deposit_amount) from public.orders where deposit_status = 'paid' and status not in ('delivered', 'cancelled')), 0),
      'openOrderValue', coalesce((select sum(total) from period_orders where status not in ('delivered', 'cancelled')), 0),
      'orderCount', (select count(*) from period_orders),
      'deliveredCount', (select count(*) from delivered),
      'cancelledCount', (select count(*) from period_orders where status = 'cancelled')
    ),
    'statusCounts', coalesce((
      select jsonb_object_agg(status, n) from (select status, count(*) as n from period_orders group by status) counts
    ), '{}'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(row_to_json(top)::jsonb order by top.quantity desc, top.revenue desc)
      from (
        select product_id as "productId", min(product_name) as name, sum(quantity)::integer as quantity,
          sum(unit_price * quantity)::bigint as revenue, sum(cost_price * quantity)::bigint as cost
        from delivered_items
        group by product_id
        order by sum(quantity) desc, sum(unit_price * quantity) desc
        limit 5
      ) top
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(row_to_json(cat)::jsonb order by cat.revenue desc)
      from (
        select category, sum(unit_price * quantity)::bigint as revenue, sum(cost_price * quantity)::bigint as cost
        from delivered_items
        group by category
      ) cat
    ), '[]'::jsonb),
    'lowStock', coalesce((
      select jsonb_agg(row_to_json(low)::jsonb order by low.stock, low.name)
      from (
        select product.id as "productId", product.name, color_stock.color, color_stock.stock
        from public.product_color_stock color_stock
        join public.products product on product.id = color_stock.product_id
        where color_stock.stock <= 2
        order by color_stock.stock, product.name
        limit 10
      ) low
    ), '[]'::jsonb),
    -- Đơn sắp giao gom theo ngày + khu vực: cùng ngày, cùng khu vực thì xếp chung một chuyến
    'deliveryPlan', coalesce((
      select jsonb_agg(row_to_json(trip)::jsonb order by trip.date, trip.zone)
      from (
        select installation_date as date, coalesce(delivery_zone, 'unknown') as zone, count(*)::integer as "orderCount",
          sum((select sum(quantity) from public.order_items where order_id = o.id))::integer as "itemCount",
          jsonb_agg(jsonb_build_object('code', code, 'timeSlot', installation_time_slot, 'status', status, 'address', shipping_address)
            order by installation_time_slot, code) as orders
        from public.orders o
        where status in ('pending_confirmation', 'confirmed', 'preparing', 'shipping', 'installing')
          and installation_date >= v_today
        group by installation_date, coalesce(delivery_zone, 'unknown')
        order by installation_date, coalesce(delivery_zone, 'unknown')
        limit 20
      ) trip
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard(integer) from public, anon;
grant execute on function public.admin_dashboard(integer) to authenticated;
