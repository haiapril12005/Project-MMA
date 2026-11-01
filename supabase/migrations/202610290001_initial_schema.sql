-- FurWorld buyer backend: schema, authorization policies and atomic order creation.
-- Run this file once in Supabase Dashboard > SQL Editor before importing seed.sql.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  phone text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id bigint primary key,
  name text not null,
  price bigint not null check (price >= 0),
  category text not null,
  brand text not null,
  colors text[] not null default '{}',
  material text not null,
  dimensions text not null,
  description text not null,
  image_url text not null,
  percent_off numeric(5,4) not null default 0 check (percent_off between 0 and 1),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  user_name text not null check (char_length(trim(user_name)) between 1 and 100),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reviews_one_per_user_product
  on public.reviews (product_id, user_id)
  where user_id is not null;
create index if not exists reviews_product_created_idx on public.reviews (product_id, created_at desc);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  selected_color text not null default '',
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id, selected_color)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  shipping_name text not null,
  shipping_phone text not null,
  shipping_address text not null,
  payment_method text not null check (payment_method in ('cod', 'bank_transfer')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled')),
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  shipping_fee bigint not null default 0 check (shipping_fee >= 0),
  total bigint not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete restrict,
  product_name text not null,
  brand text not null,
  category text not null,
  image_url text not null,
  selected_color text not null default '',
  original_price bigint not null check (original_price >= 0),
  unit_price bigint not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null
    check (status in ('pending_confirmation', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled')),
  changed_at timestamptz not null default now()
);

create index if not exists order_history_order_idx on public.order_status_history (order_id, changed_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute procedure public.set_updated_at();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at before update on public.reviews
for each row execute procedure public.set_updated_at();

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at before update on public.cart_items
for each row execute procedure public.set_updated_at();

create or replace function public.validate_cart_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_colors text[];
  v_stock integer;
begin
  select colors, stock into v_colors, v_stock
  from public.products
  where id = new.product_id;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if new.selected_color <> all(v_colors) then
    raise exception 'PRODUCT_COLOR_INVALID';
  end if;
  if new.quantity > v_stock then
    raise exception 'CART_QUANTITY_INVALID';
  end if;
  return new;
end;
$$;

drop trigger if exists cart_items_validate on public.cart_items;
create trigger cart_items_validate before insert or update on public.cart_items
for each row execute procedure public.validate_cart_item();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.record_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.order_status_history (order_id, status, changed_at)
    values (new.id, new.status, coalesce(new.updated_at, now()));
  end if;
  return new;
end;
$$;

drop trigger if exists orders_record_status on public.orders;
create trigger orders_record_status
  after insert or update of status on public.orders
  for each row execute procedure public.record_order_status();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

drop policy if exists "products are publicly readable" on public.products;
create policy "products are publicly readable" on public.products
  for select to anon, authenticated using (true);

drop policy if exists "reviews are publicly readable" on public.reviews;
create policy "reviews are publicly readable" on public.reviews
  for select to anon, authenticated using (true);
drop policy if exists "users create own reviews" on public.reviews;
create policy "users create own reviews" on public.reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "users update own reviews" on public.reviews;
create policy "users update own reviews" on public.reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "users delete own reviews" on public.reviews;
create policy "users delete own reviews" on public.reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "users manage own favorites" on public.favorites;
create policy "users manage own favorites" on public.favorites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users manage own cart" on public.cart_items;
create policy "users manage own cart" on public.cart_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users read own orders" on public.orders;
create policy "users read own orders" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users read own order items" on public.order_items;
create policy "users read own order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders
      where public.orders.id = order_items.order_id
        and public.orders.user_id = (select auth.uid())
    )
  );

drop policy if exists "users read own order history" on public.order_status_history;
create policy "users read own order history" on public.order_status_history
  for select to authenticated using (
    exists (
      select 1 from public.orders
      where public.orders.id = order_status_history.order_id
        and public.orders.user_id = (select auth.uid())
    )
  );

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
    subtotal, discount, shipping_fee, total
  ) values (
    v_code, v_user_id, trim(p_shipping_name), trim(p_shipping_phone), trim(p_shipping_address),
    p_payment_method, 'unpaid', 'pending_confirmation',
    v_subtotal, v_subtotal - v_item_total, 0, v_item_total
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

revoke all on function public.place_order(text, text, text, text) from public, anon;
grant execute on function public.place_order(text, text, text, text) to authenticated;

grant select on public.products, public.reviews to anon;
grant select on public.products, public.reviews to authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.favorites, public.cart_items to authenticated;
grant select on public.orders, public.order_items, public.order_status_history to authenticated;
grant usage, select on sequence public.order_status_history_id_seq to authenticated;
