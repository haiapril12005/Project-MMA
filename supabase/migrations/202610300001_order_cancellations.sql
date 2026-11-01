-- Buyer cancellation requests with shop review.
-- Buyers may request cancellation only while an order is pending confirmation or confirmed.

create table if not exists public.order_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  reason_code text not null check (reason_code in (
    'wrong_item',
    'change_address',
    'order_issue',
    'no_longer_needed',
    'found_better',
    'other'
  )),
  reason_detail text not null default '' check (char_length(trim(reason_detail)) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  store_note text not null default '' check (char_length(trim(store_note)) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (reason_code <> 'other' or char_length(trim(reason_detail)) > 0)
);

create index if not exists order_cancellations_requester_created_idx
  on public.order_cancellation_requests (requested_by, created_at desc);

drop trigger if exists order_cancellations_set_updated_at on public.order_cancellation_requests;
create trigger order_cancellations_set_updated_at
  before update on public.order_cancellation_requests
  for each row execute procedure public.set_updated_at();

create or replace function public.validate_order_cancellation_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_id is distinct from old.order_id
    or new.requested_by is distinct from old.requested_by
    or new.reason_code is distinct from old.reason_code
    or new.reason_detail is distinct from old.reason_detail then
    raise exception 'CANCELLATION_REQUEST_IMMUTABLE';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'CANCELLATION_STATUS_INVALID';
    end if;
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists order_cancellations_validate_review on public.order_cancellation_requests;
create trigger order_cancellations_validate_review
  before update on public.order_cancellation_requests
  for each row execute procedure public.validate_order_cancellation_review();

create or replace function public.apply_approved_order_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    update public.orders
    set status = 'cancelled'
    where id = new.order_id
      and status in ('pending_confirmation', 'confirmed');

    if not found then
      raise exception 'ORDER_CANNOT_BE_CANCELLED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists order_cancellations_apply_approval on public.order_cancellation_requests;
create trigger order_cancellations_apply_approval
  after update of status on public.order_cancellation_requests
  for each row execute procedure public.apply_approved_order_cancellation();

alter table public.order_cancellation_requests enable row level security;

drop policy if exists "users read own cancellation requests" on public.order_cancellation_requests;
create policy "users read own cancellation requests"
  on public.order_cancellation_requests
  for select to authenticated
  using (
    requested_by = (select auth.uid())
    and exists (
      select 1
      from public.orders
      where public.orders.id = order_cancellation_requests.order_id
        and public.orders.user_id = (select auth.uid())
    )
  );

create or replace function public.request_order_cancellation(
  p_order_id uuid,
  p_reason_code text,
  p_reason_detail text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_user_id uuid;
  v_order_status text;
  v_request_id uuid;
  v_reason_detail text := trim(coalesce(p_reason_detail, ''));
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select user_id, status
  into v_order_user_id, v_order_status
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order_user_id <> v_user_id then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order_status not in ('pending_confirmation', 'confirmed') then
    raise exception 'ORDER_CANNOT_BE_CANCELLED';
  end if;
  if p_reason_code not in (
    'wrong_item', 'change_address', 'order_issue',
    'no_longer_needed', 'found_better', 'other'
  ) then
    raise exception 'CANCELLATION_REASON_INVALID';
  end if;
  if p_reason_code = 'other' and char_length(v_reason_detail) = 0 then
    raise exception 'CANCELLATION_REASON_DETAIL_REQUIRED';
  end if;
  if char_length(v_reason_detail) > 1000 then
    raise exception 'CANCELLATION_REASON_DETAIL_TOO_LONG';
  end if;

  insert into public.order_cancellation_requests (
    order_id, requested_by, reason_code, reason_detail
  ) values (
    p_order_id, v_user_id, p_reason_code, v_reason_detail
  )
  returning id into v_request_id;

  return v_request_id;
exception
  when unique_violation then
    raise exception 'CANCELLATION_REQUEST_ALREADY_EXISTS';
end;
$$;

revoke all on function public.request_order_cancellation(uuid, text, text) from public, anon;
grant execute on function public.request_order_cancellation(uuid, text, text) to authenticated;
grant select on public.order_cancellation_requests to authenticated;
