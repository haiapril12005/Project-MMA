import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const errorMessage = (e) => {
  const message = String(e?.message || '');
  if (message.includes('ADMIN_ONLY')) return 'Tài khoản này không có quyền xem thống kê.';
  if (e?.code === 'PGRST202' || message.includes('Could not find the function')) {
    return 'Database chưa có chức năng thống kê. Hãy chạy file supabase/migrations/202611030003_collections_admin.sql.';
  }
  return 'Không tải được số liệu. Kiểm tra kết nối rồi thử lại.';
};

export function useAdminDashboard(days) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.admin.dashboard(days)
      .then((result) => { if (active) setData(result); })
      .catch((e) => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return { data, loading, error, retry };
}
