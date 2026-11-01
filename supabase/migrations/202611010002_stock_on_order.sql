-- Trừ tồn kho khi đặt hàng, hoàn lại khi đơn bị hủy.
-- 1. place_order (đặt từ giỏ) và place_buy_now_order (Mua ngay) khóa dòng sản phẩm (FOR UPDATE)
--    để hai đơn đặt cùng lúc không bán quá số lượng, rồi trừ stock trong cùng transaction tạo đơn.
-- 2. place_order kiểm tra TỔNG số lượng mọi màu của cùng một sản phẩm, không chỉ từng dòng giỏ.
-- 3. Khi đơn chuyển sang 'cancelled' (ví dụ cửa hàng duyệt yêu cầu hủy) thì cộng lại stock.
--    Cột stock_deducted đánh dấu đơn đã trừ kho, nên đơn cũ (tạo trước migration này, chưa trừ kho)
--    bị hủy sẽ không làm kho tăng sai.

alter table public.orders
  add column if not exists stock_deducted boolean not null default false;

-- ---------- Đặt hàng từ giỏ ----------
create or replace function public.place_order(
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_id uuid;
  v_subtotal bigint;
  v_item_total bigint;
  v_code text;
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
  if not exists (select 1 from public.cart_items where user_id = v_user_id) then
    raise exception 'CART_EMPTY';
  end if;

  -- Khóa các sản phẩm trong giỏ cho tới hết transaction
  perform 1
  from public.products
  where id in (select product_id from public.cart_items where user_id = v_user_id)
  order by id
  for update;

  -- Tổng số lượng mọi màu của một sản phẩm không được vượt tồn kho
  if exists (
    select 1
    from (
      select product_id, sum(quantity) as qty
      from public.cart_items
      where user_id = v_user_id
      group by product_id
    ) cart
    join public.products product on product.id = cart.product_id
    where cart.qty > product.stock
  ) then
    raise exception 'CART_QUANTITY_INVALID';
  end if;

  select
    sum(product.price * cart.quantity)::bigint,
    sum(round(product.price * (1 - product.percent_off))::bigint * cart.quantity)::bigint
  into v_subtotal, v_item_total
  from public.cart_items cart
  join public.products product on product.id = cart.product_id
  where cart.user_id = v_user_id;

  v_code := 'FW-'
    || to_char(timezone('Asia/Ho_Chi_Minh', now()), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    code, user_id, shipping_name, shipping_phone, shipping_address,
    payment_method, payment_status, status,
    subtotal, discount, shipping_fee, total, stock_deducted
  ) values (
    v_code, v_user_id, trim(p_shipping_name), trim(p_shipping_phone), trim(p_shipping_address),
    p_payment_method, 'unpaid', 'pending_confirmation',
    v_subtotal, v_subtotal - v_item_total, 0, v_item_total, true
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, brand, category, image_url,
    selected_color, original_price, unit_price, quantity
  )
  select
    v_order_id, product.id, product.name, product.brand, product.category, product.image_url,
    cart.selected_color, product.price,
    round(product.price * (1 - product.percent_off))::bigint,
    cart.quantity
  from public.cart_items cart
  join public.products product on product.id = cart.product_id
  where cart.user_id = v_user_id;

  -- Trừ tồn kho
  update public.products product
  set stock = product.stock - cart.qty
  from (
    select product_id, sum(quantity)::integer as qty
    from public.cart_items
    where user_id = v_user_id
    group by product_id
  ) cart
  where product.id = cart.product_id;

  delete from public.cart_items where user_id = v_user_id;
  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text) from public, anon;
grant execute on function public.place_order(text, text, text, text) to authenticated;

-- ---------- Mua ngay ----------
create or replace function public.place_buy_now_order(
  p_product_id bigint,
  p_selected_color text,
  p_quantity integer,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_payment_method text
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

  -- Khóa dòng sản phẩm cho tới hết transaction
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
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
    subtotal, discount, shipping_fee, total, stock_deducted
  ) values (
    v_code, v_user_id, trim(p_shipping_name), trim(p_shipping_phone), trim(p_shipping_address),
    p_payment_method, 'unpaid', 'pending_confirmation',
    v_product.price * p_quantity,
    (v_product.price - v_unit_price) * p_quantity,
    0,
    v_unit_price * p_quantity,
    true
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

revoke all on function public.place_buy_now_order(bigint, text, integer, text, text, text, text) from public, anon;
grant execute on function public.place_buy_now_order(bigint, text, integer, text, text, text, text) to authenticated;

-- ---------- Hoàn kho khi hủy đơn ----------
create or replace function public.restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and old.stock_deducted then
    update public.products product
    set stock = product.stock + item.qty
    from (
      select product_id, sum(quantity)::integer as qty
      from public.order_items
      where order_id = new.id
      group by product_id
    ) item
    where product.id = item.product_id;
    new.stock_deducted := false;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_restore_stock on public.orders;
create trigger orders_restore_stock
  before update of status on public.orders
  for each row execute procedure public.restore_stock_on_cancel();
