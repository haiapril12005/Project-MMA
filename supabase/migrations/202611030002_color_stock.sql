-- Tồn kho theo từng màu. Chạy SAU 202611030001_furniture_flows.sql.
-- Bảng product_color_stock là nơi lưu tồn kho thật; products.stock tự động = tổng các màu
-- (sửa tồn kho trong Supabase thì sửa ở bảng này, không sửa products.stock).
-- Lần đầu chạy, tồn kho hiện có của mỗi sản phẩm được chia đều cho các màu (phần dư dồn cho màu đầu).
-- Đặt hàng trừ đúng màu đã chọn (báo COLOR_STOCK_INVALID nếu màu đó không đủ), hủy đơn cộng lại đúng màu,
-- giỏ hàng không được vượt số lượng còn của màu.

create table if not exists public.product_color_stock (
  product_id bigint not null references public.products(id) on delete cascade,
  color text not null,
  stock integer not null default 0 check (stock >= 0),
  primary key (product_id, color)
);

alter table public.product_color_stock enable row level security;
drop policy if exists "color stock is publicly readable" on public.product_color_stock;
create policy "color stock is publicly readable" on public.product_color_stock
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.product_color_stock from anon, authenticated;
grant select on public.product_color_stock to anon, authenticated;

-- ---------- Chia tồn kho của một sản phẩm cho các màu (chỉ khi chưa có dữ liệu màu) ----------
create or replace function public.split_stock_by_color(p_product_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.product_color_stock (product_id, color, stock)
  select
    product.id,
    color_item.color,
    product.stock / color_count.n + case when color_item.ord <= product.stock % color_count.n then 1 else 0 end
  from public.products product
  cross join lateral (select greatest(cardinality(product.colors), 1) as n) color_count
  cross join lateral unnest(
    case when cardinality(product.colors) > 0 then product.colors else array['']::text[] end
  ) with ordinality as color_item(color, ord)
  where product.id = p_product_id
    and not exists (select 1 from public.product_color_stock existing where existing.product_id = product.id)
  on conflict do nothing;
$$;

revoke all on function public.split_stock_by_color(bigint) from public, anon, authenticated;

-- ---------- products.stock luôn bằng tổng tồn kho các màu ----------
create or replace function public.product_stock_from_colors()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.product_color_stock where product_id = new.id) then
    new.stock := (select coalesce(sum(stock), 0) from public.product_color_stock where product_id = new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists products_stock_from_colors on public.products;
create trigger products_stock_from_colors
  before update on public.products
  for each row execute procedure public.product_stock_from_colors();

-- Sản phẩm mới (ví dụ chạy seed.sql trên database trống) được chia tồn kho cho các màu
create or replace function public.product_split_new_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.split_stock_by_color(new.id);
  return null;
end;
$$;

drop trigger if exists products_split_new_stock on public.products;
create trigger products_split_new_stock
  after insert on public.products
  for each row execute procedure public.product_split_new_stock();

-- Đổi tồn kho một màu thì cập nhật lại tổng ở products
create or replace function public.color_stock_sync_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products set stock = stock
  where id = coalesce(new.product_id, old.product_id);
  return null;
end;
$$;

drop trigger if exists product_color_stock_sync on public.product_color_stock;
create trigger product_color_stock_sync
  after insert or update or delete on public.product_color_stock
  for each row execute procedure public.color_stock_sync_product();

-- Chia tồn kho cho các sản phẩm đang có
do $$
declare
  v_product_id bigint;
begin
  for v_product_id in select id from public.products order by id loop
    perform public.split_stock_by_color(v_product_id);
  end loop;
end;
$$;
update public.products set stock = stock;

-- ---------- Đặt hàng: trừ đúng màu ----------
create or replace function public.order_item_take_color_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Chỉ đơn đặt qua place_order / place_buy_now_order (stock_deducted = true) mới trừ kho
  if exists (select 1 from public.orders where id = new.order_id and stock_deducted)
     and exists (select 1 from public.product_color_stock where product_id = new.product_id) then
    update public.product_color_stock
    set stock = stock - new.quantity
    where product_id = new.product_id
      and color = new.selected_color
      and stock >= new.quantity;
    if not found then
      raise exception 'COLOR_STOCK_INVALID';
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists order_items_take_color_stock on public.order_items;
create trigger order_items_take_color_stock
  after insert on public.order_items
  for each row execute procedure public.order_item_take_color_stock();

-- ---------- Hủy đơn: cộng lại đúng màu (chạy trước orders_restore_stock) ----------
create or replace function public.restore_color_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and old.stock_deducted then
    update public.product_color_stock color_stock
    set stock = color_stock.stock + item.qty
    from (
      select product_id, selected_color, sum(quantity)::integer as qty
      from public.order_items
      where order_id = new.id
      group by product_id, selected_color
    ) item
    where color_stock.product_id = item.product_id
      and color_stock.color = item.selected_color;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_restore_color_stock on public.orders;
create trigger orders_restore_color_stock
  before update of status on public.orders
  for each row execute procedure public.restore_color_stock_on_cancel();

-- ---------- Giỏ hàng: không vượt số lượng còn của màu ----------
create or replace function public.cart_item_limit_color_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_available integer;
begin
  if exists (select 1 from public.product_color_stock where product_id = new.product_id) then
    select stock into v_available
    from public.product_color_stock
    where product_id = new.product_id and color = new.selected_color;
    if coalesce(v_available, 0) <= 0 then
      raise exception 'CART_QUANTITY_INVALID';
    end if;
    -- Mua lại đơn cũ có thể xin nhiều hơn số còn của màu: giữ tối đa số còn lại
    new.quantity := least(new.quantity, v_available);
  end if;
  return new;
end;
$$;

drop trigger if exists cart_items_validate_color_stock on public.cart_items;
create trigger cart_items_validate_color_stock
  before insert or update on public.cart_items
  for each row execute procedure public.cart_item_limit_color_stock();
