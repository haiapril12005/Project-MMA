import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const adminErrorMessage = (e) => {
  const message = String(e?.message || '');
  if (message.includes('ADMIN_ONLY')) return 'Tài khoản này không có quyền quản trị.';
  if (message.includes('DEPOSIT_NOT_PAID')) return 'Đơn chưa nhận cọc. Hãy xác nhận đã nhận cọc trước khi xác nhận đơn.';
  if (message.includes('DEPOSIT_NOT_AWAITING')) return 'Đơn này không còn chờ cọc.';
  if (message.includes('ORDER_STATUS_TRANSITION_INVALID')) return 'Trạng thái đơn vừa thay đổi. Hãy tải lại rồi thử lại.';
  if (message.includes('ORDER_CANNOT_BE_CANCELLED')) return 'Đơn đã qua bước xác nhận nên không thể duyệt hủy.';
  if (message.includes('CANCELLATION_REQUEST_NOT_FOUND')) return 'Yêu cầu hủy đã được xử lý trước đó.';
  if (e?.code === 'PGRST202' || message.includes('Could not find the function')) {
    return 'Database chưa có chức năng quản lý đơn. Hãy chạy file supabase/migrations/202611030004_admin_orders.sql.';
  }
  return 'Không thực hiện được. Kiểm tra kết nối rồi thử lại.';
};

// Danh sách mọi đơn cho admin; màn hình gọi reload() mỗi lần được mở lại
export function useAdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await api.admin.listOrders());
    } catch (e) {
      setError(adminErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { orders, loading, error, reload };
}

// Một đơn + các thao tác của cửa hàng; mỗi thao tác xong thì tải lại đơn từ database
export function useAdminOrder(orderId) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrder(await api.admin.getOrder(orderId));
    } catch (e) {
      setError(adminErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { reload(); }, [reload]);

  const run = async (key, action) => {
    setBusy(key);
    try {
      await action();
      setOrder(await api.admin.getOrder(orderId));
    } catch (e) {
      throw new Error(adminErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  return {
    order, loading, error, reload, busy,
    updateStatus: (status) => run(status, () => api.admin.updateStatus(orderId, status)),
    markDepositPaid: () => run('deposit', () => api.admin.markDepositPaid(orderId)),
    reviewCancellation: (approve, note) => run(approve ? 'approve' : 'reject', () => api.admin.reviewCancellation(orderId, approve, note)),
  };
}
