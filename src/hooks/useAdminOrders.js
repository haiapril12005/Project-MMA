import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

// Mã lỗi database khi quản lý đơn / báo lỗi -> câu dễ hiểu
const ERRORS = [
  ['ADMIN_ONLY', 'Tài khoản này không có quyền quản trị.'],
  ['NOT_ASSIGNED_STAFF', 'Bạn không phải nhân viên được phân công cho việc này.'],
  ['STAFF_NOT_ASSIGNED', 'Hãy phân công nhân viên giao hàng trước khi xuất kho.'],
  ['STAFF_NOT_FOUND', 'Không tìm thấy nhân viên này.'],
  ['ORDER_NOT_ASSIGNABLE', 'Đơn đã kết thúc, không thể phân công.'],
  ['DEPOSIT_NOT_PAID', 'Đơn chưa nhận cọc. Hãy xác nhận đã nhận cọc trước khi xác nhận đơn.'],
  ['DEPOSIT_NOT_AWAITING', 'Đơn này không còn chờ cọc.'],
  ['ORDER_STATUS_TRANSITION_INVALID', 'Trạng thái đơn vừa thay đổi. Hãy tải lại rồi thử lại.'],
  ['ORDER_CANNOT_BE_CANCELLED', 'Đơn đã qua bước xác nhận nên không thể duyệt hủy.'],
  ['CANCELLATION_REQUEST_NOT_FOUND', 'Yêu cầu hủy đã được xử lý trước đó.'],
  ['OPEN_DELIVERY_INCIDENT', 'Đơn còn sự cố giao hàng chưa xử lý.'],
  ['REDELIVERY_NOT_SCHEDULED', 'Admin chưa hẹn lịch giao bù cho đơn này.'],
  ['REDELIVERY_DATE_INVALID', 'Ngày giao bù không hợp lệ.'],
  ['ORDER_NOT_WAITING_REDELIVERY', 'Đơn không ở trạng thái chờ giao bù.'],
  ['ORDER_NOT_DELIVERING', 'Chỉ ghi nhận sự cố khi đơn đang giao hoặc đang lắp đặt.'],
  ['INCIDENT_NOTE_REQUIRED', 'Hãy ghi chú rõ thiếu hoặc hỏng món gì.'],
  ['CASH_AMOUNT_MISMATCH', 'Số tiền đã thu không khớp số tiền cần thu.'],
  ['INSTALLATION_TIME_SLOT_INVALID', 'Hãy chọn khung giờ.'],
  ['LOSS_COST_INVALID', 'Chi phí tổn thất không hợp lệ.'],
  ['VISIT_DATE_INVALID', 'Ngày kiểm tra không hợp lệ.'],
  ['SUPPORT_NOT_SCHEDULABLE', 'Yêu cầu này không còn hẹn lịch được.'],
  ['SUPPORT_NOT_SCHEDULED', 'Yêu cầu chưa được hẹn lịch kiểm tra.'],
  ['ASSESSMENT_NOTE_REQUIRED', 'Hãy ghi nhận định sau khi kiểm tra.'],
  ['ASSESSMENT_REQUIRED', 'Nhân viên chưa gửi nhận định kiểm tra.'],
  ['REJECT_REASON_REQUIRED', 'Từ chối cần ghi lý do.'],
  ['RESOLUTION_INVALID', 'Hãy chọn sửa chữa hay đổi mới.'],
  ['COST_INVALID', 'Chi phí không hợp lệ.'],
  ['SUPPORT_NOT_RESOLVABLE', 'Yêu cầu đã được xử lý trước đó.'],
  ['SUPPORT_DESCRIPTION_TOO_SHORT', 'Mô tả lỗi cần ít nhất 10 ký tự.'],
  ['SUPPORT_QUANTITY_INVALID', 'Số lượng không hợp lệ.'],
  ['SUPPORT_ALREADY_OPEN', 'Món này đang có một yêu cầu chưa xử lý xong.'],
  ['SUPPORT_LIMIT_REACHED', 'Bạn đang có 3 yêu cầu chưa xử lý xong. Hãy chờ cửa hàng xử lý rồi gửi tiếp.'],
  ['WARRANTY_EXPIRED', 'Món này đã hết hạn bảo hành.'],
  ['ORDER_NOT_DELIVERED', 'Chỉ báo lỗi cho đơn đã giao.'],
  ['SUPPORT_NOT_CANCELLABLE', 'Yêu cầu đã được tiếp nhận nên không thể hủy.'],
];

export const manageErrorMessage = (e) => {
  const message = String(e?.message || '');
  if (e?.code === 'PGRST202' || message.includes('Could not find the function')) {
    return 'Database chưa có chức năng này. Hãy chạy các file mới trong supabase/migrations (theo thứ tự trong README).';
  }
  const known = ERRORS.find(([code]) => message.includes(code))?.[1];
  if (known) return known;
  // Lỗi lạ: hiện kèm thông báo gốc của database để dễ tìm nguyên nhân
  return message ? `Không thực hiện được (${message}).` : 'Không thực hiện được. Kiểm tra kết nối rồi thử lại.';
};

// Tải dữ liệu một lần + reload(); auto = false thì màn hình tự gọi reload (ví dụ khi được mở lại)
export function useLoader(load, { auto = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(auto);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await load());
    } catch (e) {
      setError(manageErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => { if (auto) reload(); }, [auto, reload]);

  return { data, setData, loading, error, reload };
}

// Danh sách mọi đơn cho admin; màn hình gọi reload() mỗi lần được mở lại
export function useAdminOrders() {
  const { data, loading, error, reload } = useLoader(api.admin.listOrders, { auto: false });
  return { orders: data || [], loading, error, reload };
}

// Danh sách nhân viên giao hàng (admin chọn để phân công)
export function useStaffList(enabled = true) {
  const load = useCallback(() => (enabled ? api.admin.listStaff() : Promise.resolve([])), [enabled]);
  const { data } = useLoader(load);
  return data || [];
}

// Việc của nhân viên: đơn được giao + lịch kiểm tra lỗi
export function useStaffTasks(userId) {
  const load = useCallback(async () => {
    const [orders, visits] = await Promise.all([api.staff.myOrders(userId), api.staff.myVisits(userId)]);
    return { orders, visits };
  }, [userId]);
  const { data, loading, error, reload } = useLoader(load, { auto: false });
  return { orders: data?.orders || [], visits: data?.visits || [], loading, error, reload };
}

// Một đơn + mọi thao tác của admin / nhân viên; mỗi thao tác xong thì tải lại đơn từ database
export function useManagedOrder(orderId) {
  const load = useCallback(() => api.admin.getOrder(orderId), [orderId]);
  const { data: order, setData, loading, error, reload } = useLoader(load);
  const [busy, setBusy] = useState('');

  const run = async (key, action) => {
    setBusy(key);
    try {
      await action();
      setData(await api.admin.getOrder(orderId));
    } catch (e) {
      throw new Error(manageErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  return {
    order, loading, error, reload, busy,
    updateStatus: (status) => run(status, () => api.admin.updateStatus(orderId, status)),
    markDepositPaid: () => run('deposit', () => api.admin.markDepositPaid(orderId)),
    reviewCancellation: (approve, note) => run(approve ? 'approve' : 'reject', () => api.admin.reviewCancellation(orderId, approve, note)),
    assignStaff: (staffId) => run('assign', () => api.admin.assignStaff(orderId, staffId)),
    scheduleRedelivery: (input) => run('redelivery', () => api.admin.scheduleRedelivery(orderId, input)),
    staffStep: (status) => run(status, () => api.staff.updateStatus(orderId, status)),
    reportIncident: (input) => run('incident', () => api.staff.reportIncident(orderId, input)),
    completeDelivery: (cash) => run('complete', () => api.staff.completeDelivery(orderId, cash)),
  };
}
