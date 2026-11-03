import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

// Mốc quà tặng theo giá trị đơn, kèm thông tin sản phẩm quà và còn hàng hay không
export function useGiftRules(products) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let active = true;
    api.promotions.giftRules().then((data) => { if (active) setRows(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return useMemo(() => rows
    .map((rule) => {
      const product = products.find((item) => item.id === rule.productId);
      return product ? { ...rule, product, available: product.stock >= rule.quantity } : null;
    })
    .filter(Boolean), [rows, products]);
}
