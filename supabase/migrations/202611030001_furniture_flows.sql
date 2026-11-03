-- Nghiệp vụ đặc thù cửa hàng nội thất. Chạy SAU 202611020003_buy_now.sql.
-- 1. Phí giao và lắp đặt theo khu vực: nội thành miễn phí, ngoại thành 300.000đ, tỉnh/thành khác 800.000đ.
-- 2. Đặt cọc: đơn từ 20.000.000đ (đã gồm phí giao) phải cọc 30% (làm tròn lên nghìn đồng) trước khi cửa hàng xác nhận.
--    Cửa hàng ghi nhận cọc bằng cách đổi deposit_status = 'paid'. Hủy đơn đã cọc thì chuyển sang 'refunded' (hoàn cọc).
-- 3. Trạng thái 'installing' (Đang lắp đặt) nằm giữa 'shipping' và 'delivered'.
-- 4. Bảo hành theo sản phẩm (mặc định 24 tháng, khớp mô tả sản phẩm), được chụp lại vào từng dòng đơn lúc đặt.
-- place_order / place_buy_now_order cũ được đổi tên thành *_core (chỉ dùng nội bộ) và được bọc bởi bản mới
-- có thêm tham số p_delivery_zone, nên mọi kiểm tra cũ (kho, màu, lịch lắp đặt, khóa dòng) vẫn giữ nguyên.

-- ---------- Cột mới ----------
alter table public.products
  add column if not exists warranty_months integer not null default 24;
alter table public.products drop constraint if exists products_warranty_months_check;
alter table public.products
  add constraint products_warranty_months_check check (warranty_months between 0 and 120);

alter table public.order_items
  add column if not exists warranty_months integer not null default 24;

alter table public.orders
  add column if not exists delivery_zone text,
  add column if not exists deposit_amount bigint not null default 0,
  add column if not exists deposit_status text not null default 'not_required';

alter table public.orders drop constraint if exists orders_delivery_zone_check;
alter table public.orders
  add constraint orders_delivery_zone_check
  check (delivery_zone is null or delivery_zone in ('inner_city', 'suburban', 'province'));

alter table public.orders drop constraint if exists orders_deposit_check;
alter table public.orders
  add constraint orders_deposit_check
  check (
    deposit_amount >= 0
    and deposit_status in ('not_required', 'awaiting', 'paid', 'refunded', 'cancelled')
  );

-- Thêm trạng thái 'installing'
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending_confirmation', 'confirmed', 'preparing', 'shipping', 'installing', 'delivered', 'cancelled'));

alter table public.order_status_history drop constraint if exists order_status_history_status_check;
alter table public.order_status_history
  add constraint order_status_history_status_check
  check (status in ('pending_confirmation', 'confirmed', 'preparing', 'shipping', 'installing', 'delivered', 'cancelled'));

-- Dòng đơn cũ lấy thời hạn bảo hành hiện tại của sản phẩm
update public.order_items item
set warranty_months = product.warranty_months
from public.products product
where product.id = item.product_id
  and item.warranty_months <> product.warranty_months;

-- ---------- Bảng phí giao ----------
create or replace function public.delivery_fee(p_zone text)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case p_zone
    when 'inner_city' then 0::bigint
    when 'suburban' then 300000::bigint
    when 'province' then 800000::bigint
  end;
$$;

-- ---------- Áp phí giao, đặt cọc, bảo hành cho đơn vừa tạo (nội bộ) ----------
create or replace function public.apply_furniture_terms(p_order_id uuid, p_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee bigint := public.delivery_fee(p_zone);
begin
  if v_fee is null then
    raise exception 'DELIVERY_ZONE_INVALID';
  end if;

  update public.order_items item
  set warranty_months = product.warranty_months
  from public.products product
  where item.order_id = p_order_id
    and product.id = item.product_id;

  update public.orders customer_order
  set delivery_zone = p_zone,
      shipping_fee = v_fee,
      total = customer_order.total + v_fee,
      deposit_amount = case
        when customer_order.total + v_fee >= 20000000
          then (ceil((customer_order.total + v_fee) * 0.3 / 1000.0) * 1000)::bigint
        else 0
      end,
      deposit_status = case
        when customer_order.total + v_fee >= 20000000 then 'awaiting'
        else 'not_required'
      end
  where customer_order.id = p_order_id;
end;
$$;

revoke all on function public.apply_furniture_terms(uuid, text) from public, anon, authenticated;

-- ---------- Đổi tên hàm đặt hàng cũ thành bản nội bộ ----------
do $$
begin
  if to_regprocedure('public.place_order_core(text, text, text, text, date, text, text)') is null then
    alter function public.place_order(text, text, text, text, date, text, text) rename to place_order_core;
  elsif to_regprocedure('public.place_order(text, text, text, text, date, text, text)') is not null then
    drop function public.place_order(text, text, text, text, date, text, text);
  end if;

  if to_regprocedure('public.place_buy_now_order_core(bigint, text, integer, text, text, text, text, date, text, text)') is null then
    alter function public.place_buy_now_order(bigint, text, integer, text, text, text, text, date, text, text)
      rename to place_buy_now_order_core;
  elsif to_regprocedure('public.place_buy_now_order(bigint, text, integer, text, text, text, text, date, text, text)') is not null then
    drop function public.place_buy_now_order(bigint, text, integer, text, text, text, text, date, text, text);
  end if;
end;
$$;

revoke all on function public.place_order_core(text, text, text, text, date, text, text) from public, anon, authenticated;
revoke all on function public.place_buy_now_order_core(bigint, text, integer, text, text, text, text, date, text, text)
  from public, anon, authenticated;

-- ---------- Hàm đặt hàng mới (có khu vực giao) ----------
create or replace function public.place_order(
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_payment_method text,
  p_installation_date date,
  p_installation_time_slot text,
  p_installation_note text,
  p_delivery_zone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  if public.delivery_fee(p_delivery_zone) is null then
    raise exception 'DELIVERY_ZONE_INVALID';
  end if;
  v_order_id := public.place_order_core(
    p_shipping_name, p_shipping_phone, p_shipping_address, p_payment_method,
    p_installation_date, p_installation_time_slot, p_installation_note
  );
  perform public.apply_furniture_terms(v_order_id, p_delivery_zone);
  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text, date, text, text, text) from public, anon;
grant execute on function public.place_order(text, text, text, text, date, text, text, text) to authenticated;

create or replace function public.place_buy_now_order(
  p_product_id bigint,
  p_selected_color text,
  p_quantity integer,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_payment_method text,
  p_installation_date date,
  p_installation_time_slot text,
  p_installation_note text,
  p_delivery_zone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  if public.delivery_fee(p_delivery_zone) is null then
    raise exception 'DELIVERY_ZONE_INVALID';
  end if;
  v_order_id := public.place_buy_now_order_core(
    p_product_id, p_selected_color, p_quantity,
    p_shipping_name, p_shipping_phone, p_shipping_address, p_payment_method,
    p_installation_date, p_installation_time_slot, p_installation_note
  );
  perform public.apply_furniture_terms(v_order_id, p_delivery_zone);
  return v_order_id;
end;
$$;

revoke all on function public.place_buy_now_order(bigint, text, integer, text, text, text, text, date, text, text, text) from public, anon;
grant execute on function public.place_buy_now_order(bigint, text, integer, text, text, text, text, date, text, text, text) to authenticated;

-- ---------- Quy tắc đặt cọc khi đổi trạng thái ----------
create or replace function public.guard_order_deposit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.deposit_status = 'awaiting' and new.status not in ('pending_confirmation', 'cancelled') then
      raise exception 'DEPOSIT_NOT_PAID';
    end if;
    if new.status = 'cancelled' then
      if new.deposit_status = 'paid' then
        new.deposit_status := 'refunded';
      elsif new.deposit_status = 'awaiting' then
        new.deposit_status := 'cancelled';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_deposit_guard on public.orders;
create trigger orders_deposit_guard
  before update of status on public.orders
  for each row execute procedure public.guard_order_deposit();
