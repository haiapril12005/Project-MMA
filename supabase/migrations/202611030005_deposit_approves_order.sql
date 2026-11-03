-- Admin xác nhận đã nhận cọc = duyệt đơn luôn. Chạy SAU 202611030004_admin_orders.sql.
-- Đơn đang "Chờ xác nhận" và chờ cọc: khi admin bấm "Đã nhận cọc", deposit_status = 'paid'
-- và đơn tự chuyển sang 'confirmed' (Đã xác nhận) để cửa hàng tiếp tục chuẩn bị và giao hàng.

create or replace function public.admin_mark_deposit_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  update public.orders
  set deposit_status = 'paid',
      status = case when status = 'pending_confirmation' then 'confirmed' else status end
  where id = p_order_id and deposit_status = 'awaiting';
  if not found then
    raise exception 'DEPOSIT_NOT_AWAITING';
  end if;
end;
$$;

revoke all on function public.admin_mark_deposit_paid(uuid) from public, anon;
grant execute on function public.admin_mark_deposit_paid(uuid) to authenticated;
