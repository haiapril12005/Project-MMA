-- Verified-purchase reviews with database-enforced anti-spam rules.
-- Only a buyer with a delivered order containing the product can create a review.

alter table public.reviews
  add column if not exists verified_purchase boolean not null default false;

-- Remove anonymous seed reviews and any legacy review that cannot be proven by a delivered order.
delete from public.reviews review
where review.user_id is null
   or not exists (
     select 1
     from public.orders customer_order
     join public.order_items order_item on order_item.order_id = customer_order.id
     where customer_order.user_id = review.user_id
       and customer_order.status = 'delivered'
       and order_item.product_id = review.product_id
   );

update public.reviews set verified_purchase = true;

create table if not exists public.review_write_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  last_write_at timestamptz not null,
  primary key (user_id, product_id)
);

alter table public.review_write_limits enable row level security;
revoke all on public.review_write_limits from public, anon, authenticated;

create or replace function public.can_review_product(p_product_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.orders customer_order
      join public.order_items order_item on order_item.order_id = customer_order.id
      where customer_order.user_id = (select auth.uid())
        and customer_order.status = 'delivered'
        and order_item.product_id = p_product_id
    );
$$;

create or replace function public.save_verified_review(
  p_product_id bigint,
  p_rating smallint,
  p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_name text;
  v_comment text;
  v_review_id uuid;
  v_last_write_at timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.can_review_product(p_product_id) then
    raise exception 'REVIEW_PURCHASE_REQUIRED';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'REVIEW_RATING_INVALID';
  end if;

  v_comment := regexp_replace(trim(coalesce(p_comment, '')), '[[:space:]]+', ' ', 'g');
  if char_length(v_comment) not between 10 and 1000 then
    raise exception 'REVIEW_COMMENT_LENGTH_INVALID';
  end if;
  if v_comment ~* '(https?://|www[.])'
     or v_comment ~* '(^|[[:space:]])[[:alnum:]][[:alnum:]._-]*[.](com|net|org|vn)(/|[[:space:]]|$)' then
    raise exception 'REVIEW_LINK_NOT_ALLOWED';
  end if;

  select profile.name into v_user_name
  from public.profiles profile
  where profile.id = v_user_id;

  if not found or char_length(trim(v_user_name)) = 0 then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  insert into public.review_write_limits (user_id, product_id, last_write_at)
  values (v_user_id, p_product_id, '-infinity'::timestamptz)
  on conflict (user_id, product_id) do nothing;

  select rate_limit.last_write_at into v_last_write_at
  from public.review_write_limits rate_limit
  where rate_limit.user_id = v_user_id
    and rate_limit.product_id = p_product_id
  for update;

  if v_last_write_at > v_now - interval '60 seconds' then
    raise exception 'REVIEW_RATE_LIMIT';
  end if;

  insert into public.reviews (
    product_id, user_id, user_name, rating, comment, verified_purchase
  ) values (
    p_product_id, v_user_id, trim(v_user_name), p_rating, v_comment, true
  )
  on conflict (product_id, user_id) where user_id is not null
  do update set
    user_name = excluded.user_name,
    rating = excluded.rating,
    comment = excluded.comment,
    verified_purchase = true
  returning id into v_review_id;

  update public.review_write_limits
  set last_write_at = v_now
  where user_id = v_user_id and product_id = p_product_id;

  return v_review_id;
end;
$$;

create or replace function public.delete_verified_review(p_review_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_product_id bigint;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select review.product_id into v_product_id
  from public.reviews review
  where review.id = p_review_id and review.user_id = v_user_id
  for update;

  if not found then
    raise exception 'REVIEW_NOT_FOUND';
  end if;

  insert into public.review_write_limits (user_id, product_id, last_write_at)
  values (v_user_id, v_product_id, clock_timestamp())
  on conflict (user_id, product_id)
  do update set last_write_at = excluded.last_write_at;

  delete from public.reviews
  where id = p_review_id and user_id = v_user_id;

  return true;
end;
$$;

-- All writes go through the RPCs above so the client cannot forge a buyer or bypass validation.
drop policy if exists "users create own reviews" on public.reviews;
drop policy if exists "users update own reviews" on public.reviews;
drop policy if exists "users delete own reviews" on public.reviews;
revoke insert, update, delete on public.reviews from authenticated;

revoke all on function public.can_review_product(bigint) from public, anon;
revoke all on function public.save_verified_review(bigint, smallint, text) from public, anon;
revoke all on function public.delete_verified_review(uuid) from public, anon;
grant execute on function public.can_review_product(bigint) to authenticated;
grant execute on function public.save_verified_review(bigint, smallint, text) to authenticated;
grant execute on function public.delete_verified_review(uuid) to authenticated;
