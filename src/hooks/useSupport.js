import { useCallback, useState } from 'react';
import { api } from '../api';
import { manageErrorMessage, useLoader } from './useAdminOrders';

// Danh sách báo lỗi / bảo hành: của khách (mine) hoặc toàn bộ (admin). Màn hình gọi reload() khi được mở lại.
export function useSupportList(scope, userId) {
  const load = useCallback(() => (scope === 'admin' ? api.admin.listSupport() : api.support.mine(userId)), [scope, userId]);
  const { data, loading, error, reload } = useLoader(load, { auto: false });
  return { requests: data || [], loading, error, reload };
}

// Một yêu cầu + thao tác theo vai trò; mỗi thao tác xong thì tải lại
export function useSupportRequest(requestId) {
  const load = useCallback(() => api.support.get(requestId), [requestId]);
  const { data: request, setData, loading, error, reload } = useLoader(load);
  const [busy, setBusy] = useState('');

  const run = async (key, action) => {
    setBusy(key);
    try {
      await action();
      setData(await api.support.get(requestId));
    } catch (e) {
      throw new Error(manageErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  return {
    request, loading, error, reload, busy,
    cancel: () => run('cancel', () => api.support.cancel(requestId)),
    schedule: (input) => run('schedule', () => api.admin.scheduleSupport(requestId, input)),
    submitAssessment: (input) => run('assess', () => api.staff.submitAssessment(requestId, input)),
    resolve: (input) => run('resolve', () => api.admin.resolveSupport(requestId, input)),
  };
}

// Khách gửi yêu cầu mới
export async function createSupportRequest(input) {
  try {
    return await api.support.create(input);
  } catch (e) {
    throw new Error(manageErrorMessage(e));
  }
}
