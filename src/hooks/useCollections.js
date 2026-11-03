import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { finalPrice } from '../utils';

// Bộ sưu tập theo thương hiệu, ghép sẵn với danh sách sản phẩm đang có trong app
export function useCollections(products) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.collections.list()
      .then((data) => { if (active) setRows(data); })
      .catch(() => { if (active) setError('Không tải được bộ sưu tập. Kiểm tra kết nối rồi thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const collections = useMemo(() => rows
    .map((collection) => {
      const items = collection.productIds
        .map((id) => products.find((product) => product.id === id))
        .filter(Boolean);
      return { ...collection, items, total: items.reduce((sum, product) => sum + finalPrice(product), 0) };
    })
    .filter((collection) => collection.items.length > 0), [rows, products]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return { collections, loading, error, retry };
}
