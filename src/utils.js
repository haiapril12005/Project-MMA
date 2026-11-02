import { Alert, Platform } from 'react-native';

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

export const ORDER_STATUS = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  SHIPPING: 'shipping',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const CANCELLATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const PAYMENT_METHOD = {
  COD: 'cod',
  BANK_TRANSFER: 'bank_transfer',
};

export const PAYMENT_METHODS = [
  { key: PAYMENT_METHOD.COD, label: 'Thanh toán khi nhận hàng', icon: 'cash', note: 'Thanh toán bằng tiền mặt hoặc chuyển khoản khi nhận hàng.' },
  { key: PAYMENT_METHOD.BANK_TRANSFER, label: 'Chuyển khoản ngân hàng', icon: 'bank-outline', note: 'Cửa hàng sẽ liên hệ gửi hướng dẫn thanh toán.' },
];

export const INSTALLATION_TIME_SLOTS = [
  { key: '08:00-12:00', label: 'Buổi sáng', note: '08:00–12:00', icon: 'weather-sunny' },
  { key: '13:00-17:00', label: 'Buổi chiều', note: '13:00–17:00', icon: 'weather-sunset' },
];

export const ORDER_STATUSES = {
  pending_confirmation: { label: 'Chờ xác nhận', color: '#9A5B2E', bg: '#F6E7D8', icon: 'clock-outline' },
  confirmed: { label: 'Đã xác nhận', color: '#47708A', bg: '#E1EDF3', icon: 'check-circle-outline' },
  preparing: { label: 'Đang chuẩn bị', color: '#79652F', bg: '#F2ECD8', icon: 'package-variant-closed' },
  shipping: { label: 'Đang giao', color: '#356B58', bg: '#DDEDE6', icon: 'truck-delivery-outline' },
  delivered: { label: 'Đã giao', color: '#2F7250', bg: '#DCEEE3', icon: 'check-circle' },
  cancelled: { label: 'Đã hủy', color: '#A34E43', bg: '#F4E1DE', icon: 'close-circle-outline' },
};


export const paymentLabel = (key) => PAYMENT_METHODS.find((p) => p.key === key)?.label || 'Chưa xác định';
export const orderStatus = (key) => ORDER_STATUSES[key] || ORDER_STATUSES.pending_confirmation;

export const formatDateTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const vietnamDateISO = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export const earliestInstallationDate = () => vietnamDateISO(new Date(Date.now() + 24 * 60 * 60 * 1000));

export const isValidISODate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const formatDateOnly = (value) => {
  if (!isValidISODate(value)) return '';
  return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  });
};

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
export function applyFilters(list, { q = '', cat = 'Tất cả', brand = null, sort = 'priceDesc' }) {
  const nq = norm(q);
  const out = list.filter(
    (p) => (cat === 'Tất cả' || p.category === cat) && (!brand || p.brand === brand) && (!nq || norm(p.name).includes(nq) || norm(p.brand).includes(nq))
  );
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

// Hộp thoại xác nhận chạy được cả trên điện thoại lẫn trình duyệt
// (Alert.alert có nhiều nút không hoạt động trên web)
export function confirmAction({ title, message, confirmText = 'Đồng ý', destructive = false, onConfirm }) {
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
