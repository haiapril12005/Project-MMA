-- Nhân viên giao hàng, sự cố khi giao + giao bù, báo lỗi / bảo hành. Chạy SAU 202611030007_wholesale_gifts.sql.
--
-- Vai trò: khách hàng · admin (bảng admins) · nhân viên giao hàng (bảng delivery_staff).
-- Luồng giao: admin phân công nhân viên -> nhân viên Xuất kho -> Đang giao -> (Đang lắp đặt) -> Đã giao & lắp đặt
--   (xác nhận đã thu đủ tiền còn lại). Thiếu/hỏng khi giao -> "Chờ giao bù" (delivery_issue) -> admin hẹn giao bù
--   -> nhân viên "Đã giao bù đủ" -> Đã giao & lắp đặt. Còn sự cố chưa xử lý thì không thể chuyển Đã giao.
-- Báo lỗi / bảo hành (support_requests): khách gửi -> admin phân công + hẹn lịch -> nhân viên kiểm tra, ghi nhận định
--   -> admin chốt: đổi trả miễn phí (lỗi cửa hàng) / bảo hành (lỗi khách, còn hạn) / từ chối.
-- Kho hàng thay thế do admin tự trừ trong product_color_stock; chi phí tổn thất, đổi trả, bảo hành được đưa vào thống kê.

-- ================= Vai trò nhân viên giao hàng =================
create table if not exists public.delivery_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.delivery_staff enable row level security;
drop policy if exists "staff see own row" on public.delivery_staff;
create policy "staff see own row" on public.delivery_staff for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.delivery_staff from anon, authenticated;
grant select on public.delivery_staff to authenticated;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.delivery_staff where user_id = (select auth.uid()));
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- Vai trò của người đang đăng nhập: 'admin' | 'staff' | 'customer'
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.admins where user_id = (select auth.uid())) then 'admin'
    when exists (select 1 from public.delivery_staff where user_id = (select auth.uid())) then 'staff'
    else 'customer'
  end;
$$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- Danh sách nhân viên để admin phân công
create or replace function public.admin_list_staff()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', staff.user_id, 'name', profile.name, 'phone', profile.phone) order by profile.name)
    from public.delivery_staff staff
    join public.profiles profile on profile.id = staff.user_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

-- ================= Đơn hàng: phân công, giao bù, thu tiền =================
alter table public.orders
  add column if not exists assigned_staff_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_staff_name text,
  add column if not exists assigned_staff_phone text,
  add column if not exists redelivery_date date,
  add column if not exists redelivery_time_slot text,
  add column if not exists cash_collected bigint,
  add column if not exists cash_collected_by uuid references auth.users(id) on delete set null,
  add column if not exists cash_collected_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending_confirmation', 'confirmed', 'preparing', 'shipping', 'installing', 'delivery_issue', 'delivered', 'cancelled'));
alter table public.order_status_history drop constraint if exists order_status_history_status_check;
alter table public.order_status_history
  add constraint order_status_history_status_check
  check (status in ('pending_confirmation', 'confirmed', 'preparing', 'shipping', 'installing', 'delivery_issue', 'delivered', 'cancelled'));

-- Nhân viên đọc được đơn được phân công cho mình
drop policy if exists "staff read assigned orders" on public.orders;
create policy "staff read assigned orders" on public.orders for select to authenticated
  using (assigned_staff_id = (select auth.uid()));
drop policy if exists "staff read assigned order items" on public.order_items;
create policy "staff read assigned order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.assigned_staff_id = (select auth.uid())));
drop policy if exists "staff read assigned order history" on public.order_status_history;
create policy "staff read assigned order history" on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_status_history.order_id and o.assigned_staff_id = (select auth.uid())));

-- ---------- Sự cố khi giao ----------
create table if not exists public.delivery_incidents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('missing', 'damaged')),
  note text not null check (char_length(trim(note)) between 3 and 1000),
  photo_count integer not null default 0 check (photo_count between 0 and 3),
  reported_by uuid references auth.users(id) on delete set null,
  reported_by_name text,
  reported_at timestamptz not null default now(),
  loss_cost bigint not null default 0 check (loss_cost >= 0),
  resolved_at timestamptz
);
create index if not exists delivery_incidents_order_idx on public.delivery_incidents (order_id);
alter table public.delivery_incidents enable row level security;
drop policy if exists "read delivery incidents" on public.delivery_incidents;
create policy "read delivery incidents" on public.delivery_incidents for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = delivery_incidents.order_id
        and (o.user_id = (select auth.uid()) or o.assigned_staff_id = (select auth.uid()))
    )
  );
revoke insert, update, delete on public.delivery_incidents from anon, authenticated;
grant select on public.delivery_incidents to authenticated;

-- Không thể chuyển "Đã giao" khi còn sự cố chưa xử lý
create or replace function public.guard_open_incidents()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered'
     and exists (select 1 from public.delivery_incidents where order_id = new.id and resolved_at is null) then
    raise exception 'OPEN_DELIVERY_INCIDENT';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_incident_guard on public.orders;
create trigger orders_incident_guard
  before update of status on public.orders
  for each row execute procedure public.guard_open_incidents();

-- ---------- Admin: phân công nhân viên ----------
create or replace function public.admin_assign_staff(p_order_id uuid, p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_phone text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  if not exists (select 1 from public.delivery_staff where user_id = p_staff_id) then
    raise exception 'STAFF_NOT_FOUND';
  end if;
  select name, phone into v_name, v_phone from public.profiles where id = p_staff_id;
  update public.orders
  set assigned_staff_id = p_staff_id, assigned_staff_name = v_name, assigned_staff_phone = v_phone
  where id = p_order_id and status not in ('delivered', 'cancelled');
  if not found then
    raise exception 'ORDER_NOT_ASSIGNABLE';
  end if;
end;
$$;
revoke all on function public.admin_assign_staff(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_staff(uuid, uuid) to authenticated;

-- Admin chỉ còn các bước trước khi xuất kho; từ "Xuất kho" trở đi đi qua staff_* (admin cũng gọi được)
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
    or (v_current = 'preparing' and p_status = 'cancelled')
  ) then
    raise exception 'ORDER_STATUS_TRANSITION_INVALID';
  end if;
  update public.orders set status = p_status where id = p_order_id;
end;
$$;
revoke all on function public.admin_update_order_status(uuid, text) from public, anon;
grant execute on function public.admin_update_order_status(uuid, text) to authenticated;

-- ---------- Nhân viên (hoặc admin): các bước giao hàng ----------
-- Kiểm tra quyền trên một đơn và trả về đơn đó (khóa dòng)
create or replace function public.staff_lock_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if not public.is_admin() and v_order.assigned_staff_id is distinct from (select auth.uid()) then
    raise exception 'NOT_ASSIGNED_STAFF';
  end if;
  return v_order;
end;
$$;
revoke all on function public.staff_lock_order(uuid) from public, anon, authenticated;

-- Xuất kho / Đang lắp đặt
create or replace function public.staff_update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  v_order := public.staff_lock_order(p_order_id);
  if not (
    (v_order.status = 'preparing' and p_status = 'shipping')
    or (v_order.status = 'shipping' and p_status = 'installing')
  ) then
    raise exception 'ORDER_STATUS_TRANSITION_INVALID';
  end if;
  if p_status = 'shipping' and v_order.assigned_staff_id is null then
    raise exception 'STAFF_NOT_ASSIGNED';
  end if;
  update public.orders set status = p_status where id = p_order_id;
end;
$$;
revoke all on function public.staff_update_order_status(uuid, text) from public, anon;
grant execute on function public.staff_update_order_status(uuid, text) to authenticated;

-- Ghi nhận giao thiếu/hỏng -> "Chờ giao bù"
create or replace function public.staff_report_incident(p_order_id uuid, p_kind text, p_note text, p_photo_count integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  v_order := public.staff_lock_order(p_order_id);
  if v_order.status not in ('shipping', 'installing', 'delivery_issue') then
    raise exception 'ORDER_NOT_DELIVERING';
  end if;
  if p_kind not in ('missing', 'damaged') then
    raise exception 'INCIDENT_KIND_INVALID';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'INCIDENT_NOTE_REQUIRED';
  end if;
  insert into public.delivery_incidents (order_id, kind, note, photo_count, reported_by, reported_by_name)
  values (
    p_order_id, p_kind, trim(p_note), least(greatest(coalesce(p_photo_count, 0), 0), 3),
    (select auth.uid()), (select name from public.profiles where id = (select auth.uid()))
  );
  if v_order.status <> 'delivery_issue' then
    update public.orders set status = 'delivery_issue', redelivery_date = null, redelivery_time_slot = null where id = p_order_id;
  end if;
end;
$$;
revoke all on function public.staff_report_incident(uuid, text, text, integer) from public, anon;
grant execute on function public.staff_report_incident(uuid, text, text, integer) to authenticated;

-- Admin hẹn giao bù (đổi được nhân viên) và ghi chi phí tổn thất
create or replace function public.admin_schedule_redelivery(
  p_order_id uuid, p_date date, p_time_slot text, p_staff_id uuid default null, p_loss_cost bigint default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_date is null or p_date < timezone('Asia/Ho_Chi_Minh', now())::date then
    raise exception 'REDELIVERY_DATE_INVALID';
  end if;
  if p_time_slot not in ('08:00-12:00', '13:00-17:00') then
    raise exception 'INSTALLATION_TIME_SLOT_INVALID';
  end if;
  if coalesce(p_loss_cost, 0) < 0 then
    raise exception 'LOSS_COST_INVALID';
  end if;
  update public.orders set redelivery_date = p_date, redelivery_time_slot = p_time_slot
  where id = p_order_id and status = 'delivery_issue';
  if not found then
    raise exception 'ORDER_NOT_WAITING_REDELIVERY';
  end if;
  if p_staff_id is not null then
    perform public.admin_assign_staff(p_order_id, p_staff_id);
  end if;
  -- Chi phí tổn thất gắn vào sự cố mới nhất chưa xử lý
  update public.delivery_incidents set loss_cost = coalesce(p_loss_cost, 0)
  where id = (
    select id from public.delivery_incidents
    where order_id = p_order_id and resolved_at is null
    order by reported_at desc limit 1
  );
end;
$$;
revoke all on function public.admin_schedule_redelivery(uuid, date, text, uuid, bigint) from public, anon;
grant execute on function public.admin_schedule_redelivery(uuid, date, text, uuid, bigint) to authenticated;

-- Giao xong (lần đầu hoặc giao bù): xác nhận đã thu đủ phần còn lại -> Đã giao & lắp đặt
create or replace function public.staff_complete_delivery(p_order_id uuid, p_cash_collected bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_due bigint;
begin
  v_order := public.staff_lock_order(p_order_id);
  if v_order.status not in ('shipping', 'installing', 'delivery_issue') then
    raise exception 'ORDER_STATUS_TRANSITION_INVALID';
  end if;
  if v_order.status = 'delivery_issue' and v_order.redelivery_date is null then
    raise exception 'REDELIVERY_NOT_SCHEDULED';
  end if;
  v_due := v_order.total - case when v_order.deposit_status = 'paid' then v_order.deposit_amount else 0 end;
  if coalesce(p_cash_collected, -1) <> v_due then
    raise exception 'CASH_AMOUNT_MISMATCH';
  end if;
  update public.delivery_incidents set resolved_at = now() where order_id = p_order_id and resolved_at is null;
  update public.orders
  set status = 'delivered',
      payment_status = 'paid',
      cash_collected = v_due,
      cash_collected_by = (select auth.uid()),
      cash_collected_at = now()
  where id = p_order_id;
end;
$$;
revoke all on function public.staff_complete_delivery(uuid, bigint) from public, anon;
grant execute on function public.staff_complete_delivery(uuid, bigint) to authenticated;

-- ================= Báo lỗi / bảo hành =================
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  description text not null check (char_length(trim(description)) between 10 and 1000),
  photo_count integer not null default 0 check (photo_count between 0 and 3),
  -- Gửi trong 7 ngày đầu sau khi nhận hàng: ưu tiên kiểm tra lỗi vận chuyển
  early_report boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'in_progress', 'completed', 'rejected', 'cancelled')),
  assigned_staff_id uuid references auth.users(id) on delete set null,
  assigned_staff_name text,
  assigned_staff_phone text,
  visit_date date,
  visit_time_slot text,
  staff_assessment text check (staff_assessment in ('store_fault', 'customer_fault')),
  staff_note text,
  staff_photo_count integer not null default 0 check (staff_photo_count between 0 and 3),
  conclusion text check (conclusion in ('store_return', 'warranty', 'rejected')),
  resolution text check (resolution in ('repair', 'replace')),
  cost bigint not null default 0 check (cost >= 0),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_requests_customer_idx on public.support_requests (customer_id, status);
alter table public.support_requests enable row level security;
drop policy if exists "read support requests" on public.support_requests;
create policy "read support requests" on public.support_requests for select to authenticated
  using (
    customer_id = (select auth.uid())
    or assigned_staff_id = (select auth.uid())
    or (select public.is_admin())
  );
revoke insert, update, delete on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;

-- Nhân viên được phân công kiểm tra lỗi cũng xem được đơn + món liên quan
drop policy if exists "staff read orders of support visits" on public.orders;
create policy "staff read orders of support visits" on public.orders for select to authenticated
  using (exists (select 1 from public.support_requests r where r.order_id = orders.id and r.assigned_staff_id = (select auth.uid())));
drop policy if exists "staff read items of support visits" on public.order_items;
create policy "staff read items of support visits" on public.order_items for select to authenticated
  using (exists (select 1 from public.support_requests r where r.order_id = order_items.order_id and r.assigned_staff_id = (select auth.uid())));

-- Khách gửi báo lỗi / bảo hành
create or replace function public.create_support_request(p_order_item_id uuid, p_quantity integer, p_description text, p_photo_count integer default 0)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item record;
  v_delivered_at timestamptz;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select item.id, item.order_id, item.quantity, item.warranty_months, customer_order.user_id, customer_order.status
  into v_item
  from public.order_items item
  join public.orders customer_order on customer_order.id = item.order_id
  where item.id = p_order_item_id;
  if not found or v_item.user_id <> v_user then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;
  if v_item.status <> 'delivered' then
    raise exception 'ORDER_NOT_DELIVERED';
  end if;
  select max(changed_at) into v_delivered_at from public.order_status_history
  where order_id = v_item.order_id and status = 'delivered';
  v_delivered_at := coalesce(v_delivered_at, now());
  if v_item.warranty_months <= 0 or now() > v_delivered_at + make_interval(months => v_item.warranty_months) then
    raise exception 'WARRANTY_EXPIRED';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > v_item.quantity then
    raise exception 'SUPPORT_QUANTITY_INVALID';
  end if;
  if char_length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'SUPPORT_DESCRIPTION_TOO_SHORT';
  end if;
  if exists (select 1 from public.support_requests where order_item_id = p_order_item_id and status in ('pending', 'scheduled', 'in_progress')) then
    raise exception 'SUPPORT_ALREADY_OPEN';
  end if;
  if (select count(*) from public.support_requests where customer_id = v_user and status in ('pending', 'scheduled', 'in_progress')) >= 3 then
    raise exception 'SUPPORT_LIMIT_REACHED';
  end if;
  insert into public.support_requests (order_id, order_item_id, customer_id, quantity, description, photo_count, early_report)
  values (
    v_item.order_id, p_order_item_id, v_user, p_quantity, trim(p_description),
    least(greatest(coalesce(p_photo_count, 0), 0), 3), now() <= v_delivered_at + interval '7 days'
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_support_request(uuid, integer, text, integer) from public, anon;
grant execute on function public.create_support_request(uuid, integer, text, integer) to authenticated;

-- Khách hủy khi còn "Chờ tiếp nhận"
create or replace function public.cancel_support_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_requests set status = 'cancelled', resolved_at = now()
  where id = p_request_id and customer_id = (select auth.uid()) and status = 'pending';
  if not found then
    raise exception 'SUPPORT_NOT_CANCELLABLE';
  end if;
end;
$$;
revoke all on function public.cancel_support_request(uuid) from public, anon;
grant execute on function public.cancel_support_request(uuid) to authenticated;

-- Admin phân công nhân viên + hẹn lịch kiểm tra
create or replace function public.admin_schedule_support(p_request_id uuid, p_staff_id uuid, p_date date, p_time_slot text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_phone text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  if not exists (select 1 from public.delivery_staff where user_id = p_staff_id) then
    raise exception 'STAFF_NOT_FOUND';
  end if;
  if p_date is null or p_date < timezone('Asia/Ho_Chi_Minh', now())::date then
    raise exception 'VISIT_DATE_INVALID';
  end if;
  if p_time_slot not in ('08:00-12:00', '13:00-17:00') then
    raise exception 'INSTALLATION_TIME_SLOT_INVALID';
  end if;
  select name, phone into v_name, v_phone from public.profiles where id = p_staff_id;
  update public.support_requests
  set status = 'scheduled', assigned_staff_id = p_staff_id, assigned_staff_name = v_name, assigned_staff_phone = v_phone,
      visit_date = p_date, visit_time_slot = p_time_slot
  where id = p_request_id and status in ('pending', 'scheduled');
  if not found then
    raise exception 'SUPPORT_NOT_SCHEDULABLE';
  end if;
end;
$$;
revoke all on function public.admin_schedule_support(uuid, uuid, date, text) from public, anon;
grant execute on function public.admin_schedule_support(uuid, uuid, date, text) to authenticated;

-- Nhân viên ghi nhận định sau khi kiểm tra
create or replace function public.staff_submit_assessment(p_request_id uuid, p_assessment text, p_note text, p_photo_count integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.support_requests%rowtype;
begin
  select * into v_request from public.support_requests where id = p_request_id for update;
  if not found then
    raise exception 'SUPPORT_NOT_FOUND';
  end if;
  if not public.is_admin() and v_request.assigned_staff_id is distinct from (select auth.uid()) then
    raise exception 'NOT_ASSIGNED_STAFF';
  end if;
  if v_request.status not in ('scheduled', 'in_progress') then
    raise exception 'SUPPORT_NOT_SCHEDULED';
  end if;
  if p_assessment not in ('store_fault', 'customer_fault') then
    raise exception 'ASSESSMENT_INVALID';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'ASSESSMENT_NOTE_REQUIRED';
  end if;
  update public.support_requests
  set status = 'in_progress', staff_assessment = p_assessment, staff_note = trim(p_note),
      staff_photo_count = least(greatest(coalesce(p_photo_count, 0), 0), 3)
  where id = p_request_id;
end;
$$;
revoke all on function public.staff_submit_assessment(uuid, text, text, integer) from public, anon;
grant execute on function public.staff_submit_assessment(uuid, text, text, integer) to authenticated;

-- Admin chốt: đổi trả miễn phí / bảo hành / từ chối. Đổi mới mà không nhập chi phí thì lấy giá vốn x số lượng.
create or replace function public.admin_resolve_support(
  p_request_id uuid, p_conclusion text, p_resolution text default null, p_cost bigint default null, p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.support_requests%rowtype;
  v_cost bigint;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  select * into v_request from public.support_requests where id = p_request_id for update;
  if not found or v_request.status in ('completed', 'rejected', 'cancelled') then
    raise exception 'SUPPORT_NOT_RESOLVABLE';
  end if;
  if p_conclusion not in ('store_return', 'warranty', 'rejected') then
    raise exception 'CONCLUSION_INVALID';
  end if;
  if p_conclusion = 'rejected' then
    if char_length(trim(coalesce(p_note, ''))) < 3 then
      raise exception 'REJECT_REASON_REQUIRED';
    end if;
    update public.support_requests
    set status = 'rejected', conclusion = 'rejected', resolution = null, cost = 0, admin_note = trim(p_note), resolved_at = now()
    where id = p_request_id;
    return;
  end if;
  if v_request.status <> 'in_progress' then
    raise exception 'ASSESSMENT_REQUIRED';
  end if;
  if p_resolution not in ('repair', 'replace') then
    raise exception 'RESOLUTION_INVALID';
  end if;
  v_cost := p_cost;
  if v_cost is null and p_resolution = 'replace' then
    select product.cost_price * v_request.quantity into v_cost
    from public.order_items item join public.products product on product.id = item.product_id
    where item.id = v_request.order_item_id;
  end if;
  if coalesce(v_cost, 0) < 0 then
    raise exception 'COST_INVALID';
  end if;
  update public.support_requests
  set status = 'completed', conclusion = p_conclusion, resolution = p_resolution, cost = coalesce(v_cost, 0),
      admin_note = trim(coalesce(p_note, '')), resolved_at = now()
  where id = p_request_id;
end;
$$;
revoke all on function public.admin_resolve_support(uuid, text, text, bigint, text) from public, anon;
grant execute on function public.admin_resolve_support(uuid, text, text, bigint, text) to authenticated;

-- ================= Thống kê: thêm chi phí sau bán hàng, lịch giao gồm giao bù =================
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
  v_after_sales bigint;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  -- Chi phí sau bán hàng trong kỳ: tổn thất khi giao + chi phí đổi trả/bảo hành
  v_after_sales := coalesce((select sum(loss_cost) from public.delivery_incidents where reported_at >= v_from), 0)
    + coalesce((select sum(cost) from public.support_requests where status = 'completed' and resolved_at >= v_from), 0);

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
      -- Giá vốn của quà tặng (đã nằm trong costOfGoods)
      'giftCost', coalesce((select sum(cost_price * quantity) from delivered_items where is_gift), 0),
      'afterSalesCost', v_after_sales,
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
        where not is_gift
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
        where not is_gift
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
        select coalesce(redelivery_date, installation_date) as date, coalesce(delivery_zone, 'unknown') as zone, count(*)::integer as "orderCount",
          sum((select sum(quantity) from public.order_items where order_id = o.id))::integer as "itemCount",
          jsonb_agg(jsonb_build_object('code', code, 'timeSlot', coalesce(redelivery_time_slot, installation_time_slot), 'status', status, 'address', shipping_address, 'staff', assigned_staff_name)
            order by coalesce(redelivery_time_slot, installation_time_slot), code) as orders
        from public.orders o
        where status in ('pending_confirmation', 'confirmed', 'preparing', 'shipping', 'installing', 'delivery_issue')
          and coalesce(redelivery_date, installation_date) >= v_today
        group by coalesce(redelivery_date, installation_date), coalesce(delivery_zone, 'unknown')
        order by coalesce(redelivery_date, installation_date), coalesce(delivery_zone, 'unknown')
        limit 20
      ) trip
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard(integer) from public, anon;
grant execute on function public.admin_dashboard(integer) to authenticated;
