-- Required delivery/installation schedule stored as an order snapshot.

begin;

alter table public.orders
  add column if not exists installation_date date,
  add column if not exists installation_time_slot text,
  add column if not exists installation_note text not null default '';

alter table public.orders
  drop constraint if exists orders_installation_time_slot_check;
alter table public.orders
  add constraint orders_installation_time_slot_check
  check (
    installation_time_slot is null
    or installation_time_slot in ('08:00-12:00', '13:00-17:00')
  );

alter table public.orders
  drop constraint if exists orders_installation_schedule_pair_check;
alter table public.orders
  add constraint orders_installation_schedule_pair_check
  check (
    (installation_date is null and installation_time_slot is null)
    or (installation_date is not null and installation_time_slot is not null)
  );

alter table public.orders
  drop constraint if exists orders_installation_note_length_check;
alter table public.orders
  add constraint orders_installation_note_length_check
  check (char_length(installation_note) <= 500);

-- Remove the previous RPC signature so buyers cannot place an order without a schedule.
drop function if exists public.place_order(text, text, text, text);

create or replace function public.place_order(
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
  v_order_id uuid;
  v_subtotal bigint;
  v_item_total bigint;
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
  if p_installation_time_slot not in ('08:00-12:00', '13:00-17:00') then
    raise exception 'INSTALLATION_TIME_SLOT_INVALID';
  end if;
  if char_length(v_installation_note) > 500 then
    raise exception 'INSTALLATION_NOTE_TOO_LONG';
  end if;
  if not exists (select 1 from public.cart_items where user_id = v_user_id) then
    raise exception 'CART_EMPTY';
  end if;
  if exists (
    select 1
    from public.cart_items cart
    join public.products product on product.id = cart.product_id
    where cart.user_id = v_user_id and cart.quantity > product.stock
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
    subtotal, discount, shipping_fee, total,
    installation_date, installation_time_slot, installation_note
  ) values (
    v_code, v_user_id, trim(p_shipping_name), trim(p_shipping_phone), trim(p_shipping_address),
    p_payment_method, 'unpaid', 'pending_confirmation',
    v_subtotal, v_subtotal - v_item_total, 0, v_item_total,
    p_installation_date, p_installation_time_slot, v_installation_note
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

  delete from public.cart_items where user_id = v_user_id;
  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text, date, text, text) from public, anon;
grant execute on function public.place_order(text, text, text, text, date, text, text) to authenticated;

commit;
