-- Hủy ngay khi đơn còn "Chờ xác nhận".
-- Đơn pending_confirmation: tạo yêu cầu hủy rồi TỰ DUYỆT ngay (không chờ cửa hàng).
--   Việc duyệt đi qua các trigger sẵn có: validate_order_cancellation_review (ghi reviewed_at),
--   apply_approved_order_cancellation (đơn -> cancelled), record_order_status (ghi lịch sử)
--   và orders_restore_stock (hoàn kho).
-- Đơn confirmed: giữ nguyên quy trình cũ, gửi yêu cầu và chờ cửa hàng duyệt.
-- Tên hàm, tham số và quyền giữ nguyên nên app không phải đổi cách gọi.

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
  v_existing_status text;
  v_reason_detail text := trim(coalesce(p_reason_detail, ''));
  v_auto_note constant text := 'Tự động hủy vì đơn chưa được cửa hàng xác nhận.';
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

  select id, status
  into v_request_id, v_existing_status
  from public.order_cancellation_requests
  where order_id = p_order_id
  for update;

  if found then
    -- Yêu cầu cũ còn chờ duyệt mà đơn vẫn chưa xác nhận: duyệt luôn yêu cầu đó
    if v_existing_status = 'pending' and v_order_status = 'pending_confirmation' then
      update public.order_cancellation_requests
      set status = 'approved', store_note = v_auto_note
      where id = v_request_id;
      return v_request_id;
    end if;
    raise exception 'CANCELLATION_REQUEST_ALREADY_EXISTS';
  end if;

  insert into public.order_cancellation_requests (
    order_id, requested_by, reason_code, reason_detail
  ) values (
    p_order_id, v_user_id, p_reason_code, v_reason_detail
  )
  returning id into v_request_id;

  if v_order_status = 'pending_confirmation' then
    update public.order_cancellation_requests
    set status = 'approved', store_note = v_auto_note
    where id = v_request_id;
  end if;

  return v_request_id;
exception
  when unique_violation then
    raise exception 'CANCELLATION_REQUEST_ALREADY_EXISTS';
end;
$$;

revoke all on function public.request_order_cancellation(uuid, text, text) from public, anon;
grant execute on function public.request_order_cancellation(uuid, text, text) to authenticated;
