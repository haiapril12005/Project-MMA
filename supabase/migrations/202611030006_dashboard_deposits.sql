-- Sửa thống kê: thêm "Tiền cọc đã nhận" và đảm bảo bản admin_dashboard mới nhất (có biểu đồ thu chi).
-- Chạy SAU 202611030005_deposit_approves_order.sql. Nếu lỡ chạy lại 202611030003 hoặc 202611030004 thì chạy lại file này.

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
      -- Cọc đang giữ: đã nhận cọc nhưng đơn chưa giao xong (giao xong thì cọc tính vào doanh thu)
      'depositsHeld', coalesce((select sum(deposit_amount) from public.orders where deposit_status = 'paid' and status not in ('delivered', 'cancelled')), 0),
      -- Tổng tiền cọc đã nhận của các đơn đặt trong kỳ (kể cả đơn đã giao hoặc đã hoàn cọc)
      'depositsReceived', coalesce((select sum(deposit_amount) from period_orders where deposit_status in ('paid', 'refunded')), 0),
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
