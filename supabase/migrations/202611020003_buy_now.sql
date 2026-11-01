-- "Mua ngay": đặt đúng 1 sản phẩm đang xem, không đọc và không xóa giỏ hàng.
-- Chạy SAU 202611020002_stock_on_order.sql (cần cột orders.stock_deducted).
-- Kiểm tra giống place_order: đăng nhập, người nhận, SĐT 9-11 số, địa chỉ >= 10 ký tự, phương thức thanh toán,
-- lịch giao/lắp đặt (từ ngày kế tiếp, khung 08:00-12:00 hoặc 13:00-17:00, ghi chú <= 500 ký tự),
-- màu hợp lệ, số lượng không vượt tồn kho. Giá lấy từ database, khóa dòng sản phẩm và trừ kho.
-- Lịch sử trạng thái được ghi tự động bởi trigger orders_record_status.

-- Bản cũ chưa có lịch lắp đặt
drop function if exists public.place_buy_now_order(bigint, text, integer, text, text, text, text);

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
  p_installation_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_product public.products%rowtype;
  v_color text := coalesce(p_selected_color, '');
  v_unit_price bigint;
  v_order_id uuid;
  v_code text;
  v_today date := timezone('Asia/Ho_Chi_Minh', now())::date;
  v_installation_note text := trim(coalesce(p_installation_note, ''));
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_shipping_name, ''))) = 0 then
    raise exception 'SHIPPING_NAME_REQUIRED';
  end if;
  if char_length(regexp_replace(coalesce(p_shipping_phone, ''), '[^0-9]', '', 'g')) not between 9 and 11 then
    raise exception 'SHIPPING_PHONE_INVALID';
  end if;
  if char_length(trim(coalesce(p_shipping_address, ''))) < 10 then
    raise exception 'SHIPPING_ADDRESS_INVALID';
  end if;
  if p_payment_method not in ('cod', 'bank_transfer') then
    raise exception 'PAYMENT_METHOD_INVALID';
  end if;
  if p_installation_date is null or p_installation_date < v_today + 1 then
    raise exception 'INSTALLATION_DATE_INVALID';
  end if;
  if p_installation_time_slot is null or p_installation_time_slot not in ('08:00-12:00', '13:00-17:00') then
    raise exception 'INSTALLATION_TIME_SLOT_INVALID';
  end if;
  if char_length(v_installation_note) > 500 then
    raise exception 'INSTALLATION_NOTE_TOO_LONG';
  end if;

  -- Khóa dòng sản phẩm cho tới hết transaction
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  -- Sản phẩm có danh sách màu thì màu phải nằm trong danh sách; bỏ trống thì lấy màu đầu tiên
  if cardinality(v_product.colors) > 0 then
    if v_color = '' then
      v_color := v_product.colors[1];
    elsif v_color <> all(v_product.colors) then
      raise exception 'PRODUCT_COLOR_INVALID';
    end if;
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > v_product.stock then
    raise exception 'CART_QUANTITY_INVALID';
  end if;

  v_unit_price := round(v_product.price * (1 - v_product.percent_off))::bigint;
  v_code := 'FW-'
    || to_char(timezone('Asia/Ho_Chi_Minh', now()), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    code, user_id, shipping_name, shipping_phone, shipping_address,
    payment_method, payment_status, status,
    subtotal, discount, shipping_fee, total,
    installation_date, installation_time_slot, installation_note, stock_deducted
  ) values (
    v_code, v_user_id, trim(p_shipping_name), trim(p_shipping_phone), trim(p_shipping_address),
    p_payment_method, 'unpaid', 'pending_confirmation',
    v_product.price * p_quantity,
    (v_product.price - v_unit_price) * p_quantity,
    0,
    v_unit_price * p_quantity,
    p_installation_date, p_installation_time_slot, v_installation_note, true
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, brand, category, image_url,
    selected_color, original_price, unit_price, quantity
  ) values (
    v_order_id, v_product.id, v_product.name, v_product.brand, v_product.category, v_product.image_url,
    v_color, v_product.price, v_unit_price, p_quantity
  );

  -- Trừ tồn kho
  update public.products set stock = stock - p_quantity where id = v_product.id;

  return v_order_id;
end;
$$;

revoke all on function public.place_buy_now_order(bigint, text, integer, text, text, text, text, date, text, text) from public, anon;
grant execute on function public.place_buy_now_order(bigint, text, integer, text, text, text, text, date, text, text) to authenticated;
