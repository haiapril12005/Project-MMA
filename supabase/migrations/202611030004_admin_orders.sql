-- Quản lý đơn hàng cho admin ngay trong app + biểu đồ thu chi. Chạy SAU 202611030003_collections_admin.sql.
-- Admin đọc được mọi đơn (chính sách RLS riêng), còn mọi thay đổi đi qua RPC có kiểm tra quyền và luồng trạng thái:
-- Chờ xác nhận -> Đã xác nhận -> Đang chuẩn bị -> Đang giao -> (Đang lắp đặt) -> Đã giao & lắp đặt.
-- Cửa hàng được hủy đơn khi còn Chờ xác nhận / Đã xác nhận / Đang chuẩn bị (kho và cọc được hoàn bởi trigger sẵn có).

-- ---------- Admin xem được mọi đơn ----------
drop policy if exists "admins read all orders" on public.orders;
create policy "admins read all orders" on public.orders for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins read all order items" on public.order_items;
create policy "admins read all order items" on public.order_items for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins read all order history" on public.order_status_history;
create policy "admins read all order history" on public.order_status_history for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins read all cancellation requests" on public.order_cancellation_requests;
create policy "admins read all cancellation requests" on public.order_cancellation_requests for select to authenticated using ((select public.is_admin()));

-- ---------- Đổi trạng thái đơn ----------
create or replace function public.admin_update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  select status into v_current from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if not (
    (v_current = 'pending_confirmation' and p_status in ('confirmed', 'cancelled'))
    or (v_current = 'confirmed' and p_status in ('preparing', 'cancelled'))
    or (v_current = 'preparing' and p_status in ('shipping', 'cancelled'))
    or (v_current = 'shipping' and p_status in ('installing', 'delivered'))
    or (v_current = 'installing' and p_status = 'delivered')
  ) then
    raise exception 'ORDER_STATUS_TRANSITION_INVALID';
  end if;
  update public.orders
  set status = p_status,
      -- Giao xong thì đã thu đủ tiền (tiền mặt hoặc chuyển khoản phần còn lại)
      payment_status = case when p_status = 'delivered' then 'paid' else payment_status end
  where id = p_order_id;
end;
$$;
revoke all on function public.admin_update_order_status(uuid, text) from public, anon;
grant execute on function public.admin_update_order_status(uuid, text) to authenticated;

-- ---------- Xác nhận đã nhận tiền cọc ----------
create or replace function public.admin_mark_deposit_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  update public.orders set deposit_status = 'paid'
  where id = p_order_id and deposit_status = 'awaiting';
  if not found then
    raise exception 'DEPOSIT_NOT_AWAITING';
  end if;
end;
$$;
revoke all on function public.admin_mark_deposit_paid(uuid) from public, anon;
grant execute on function public.admin_mark_deposit_paid(uuid) to authenticated;

-- ---------- Duyệt / từ chối yêu cầu hủy của khách ----------
create or replace function public.admin_review_cancellation(p_order_id uuid, p_approve boolean, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  update public.order_cancellation_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      store_note = left(trim(coalesce(p_note, '')), 500)
  where order_id = p_order_id and status = 'pending';
  if not found then
    raise exception 'CANCELLATION_REQUEST_NOT_FOUND';
  end if;
end;
$$;
revoke all on function public.admin_review_cancellation(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_cancellation(uuid, boolean, text) to authenticated;

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
  v_unit text := case when coalesce(p_days, 30) <= 31 then 'day' else 'month' end;
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
    -- Thu (đơn đã giao) và chi (giá vốn) theo từng ngày, hoặc từng tháng khi xem 12 tháng
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', to_char(bucket.start_at, case when v_unit = 'day' then 'DD/MM' else 'MM/YY' end),
        'revenue', coalesce((
          select sum(total) from delivered
          where date_trunc(v_unit, timezone('Asia/Ho_Chi_Minh', delivered.created_at)) = bucket.start_at
        ), 0),
        'cost', coalesce((
          select sum(cost_price * quantity) from delivered_items
          join delivered on delivered.id = delivered_items.order_id
          where date_trunc(v_unit, timezone('Asia/Ho_Chi_Minh', delivered.created_at)) = bucket.start_at
        ), 0)
      ) order by bucket.start_at)
      from generate_series(
        date_trunc(v_unit, timezone('Asia/Ho_Chi_Minh', v_from)),
        date_trunc(v_unit, timezone('Asia/Ho_Chi_Minh', now())),
        ('1 ' || v_unit)::interval
      ) as bucket(start_at)
    ), '[]'::jsonb),
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
