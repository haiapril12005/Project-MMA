import { Alert, Platform } from 'react-native';
import { emitConfirm } from './confirmBus';

// Danh mục hiển thị ở trang chủ (icon thuộc bộ MaterialCommunityIcons)
export const CATEGORIES = [
  { key: 'Tất cả', icon: 'view-grid-outline' },
  { key: 'Đèn chùm', icon: 'ceiling-light' },
  { key: 'Sofa', icon: 'sofa-outline' },
  { key: 'Ghế gỗ', icon: 'seat-outline' },
  { key: 'Bàn ghế', icon: 'table-chair' },
  { key: 'Gia dụng', icon: 'kettle-outline' },
];

export const SORTS = [
  { key: 'priceDesc', label: 'Giá cao trước', icon: 'sort-descending' },
  { key: 'priceAsc', label: 'Giá thấp trước', icon: 'sort-ascending' },
];

// Màu sắc sản phẩm -> ô màu hiển thị ở trang chi tiết
export const SWATCHES = {
  'Vàng đồng': '#C9A46A', 'Trong suốt': '#E8EEF0', 'Trắng ngà': '#F4EDE1', 'Vàng nhạt': '#EED9A6',
  'Đen mờ': '#4B4644', 'Đồng rêu': '#8A7A55', 'Mộc tự nhiên': '#D2B48C', Kem: '#EADFC8',
  'Xám tro': '#B5ADA6', 'Xanh rêu': '#7D8B6A', 'Nâu đất': '#9C6B4E', 'Nâu cognac': '#A8673F',
  'Nâu óc chó': '#7A5A44', 'Xanh lam': '#7C93A8', Bạc: '#C9CBCC', 'Hồng phấn': '#E6BDB3',
};

export const formatVND = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
export const finalPrice = (p) => Math.round(p.price * (1 - (p.percentOff || 0)));
export const percentLabel = (p) => `-${Math.round((p.percentOff || 0) * 100)}%`;

// Bỏ dấu tiếng Việt để tìm kiếm: "den chum" vẫn ra "Đèn chùm"
export const norm = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

export const brandsOf = (list) => Array.from(new Set(list.map((p) => p.brand))).sort((a, b) => a.localeCompare(b, 'vi'));

// Lọc theo danh mục, thương hiệu, từ khóa; mặc định sắp xếp giá giảm dần
export function applyFilters(list, { q = '', cat = 'Tất cả', brand = null, sort = 'priceDesc', range = 'all', deal = false }) {
  const nq = norm(q);
  const r = PRICE_RANGES.find((x) => x.key === range) || PRICE_RANGES[0];
  const out = list.filter((p) => {
    const price = finalPrice(p);
    return (cat === 'Tất cả' || p.category === cat)
      && (!brand || p.brand === brand)
      && (!nq || norm(p.name).includes(nq) || norm(p.brand).includes(nq))
      && price >= r.min && price < r.max
      && (!deal || p.percentOff > 0);
  });
  const dir = sort === 'priceAsc' ? 1 : -1;
  return out.sort((a, b) => dir * (finalPrice(a) - finalPrice(b)));
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export const ORDER_STATUS = {
  processing: { label: 'Đang xử lý', color: '#985333', bg: '#F2E1D4' },
  cancelled: { label: 'Đã hủy', color: '#99423A', bg: '#F3E1DC' },
};

export const PRICE_RANGES = [
  { key: 'all', label: 'Mọi mức giá', min: 0, max: Infinity },
  { key: 'u5', label: 'Dưới 5 triệu', min: 0, max: 5000000 },
  { key: '5-15', label: '5 – 15 triệu', min: 5000000, max: 15000000 },
  { key: '15-30', label: '15 – 30 triệu', min: 15000000, max: 30000000 },
  { key: 'o30', label: 'Trên 30 triệu', min: 30000000, max: Infinity },
];

// Hộp thoại xác nhận chạy được cả trên điện thoại lẫn trình duyệt
// (Alert.alert có nhiều nút không hoạt động trên web)
export function confirmAction({ title, message, confirmText = 'Đồng ý', destructive = false, onConfirm }) {
  // Ưu tiên thanh xác nhận tự thiết kế (chạy trên cả web và điện thoại)
  if (emitConfirm({ title, message, confirmText, destructive, onConfirm })) return;

  // Dự phòng nếu <ConfirmDialog /> chưa được gắn vào App.js
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Hủy', style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}