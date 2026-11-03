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
  INSTALLING: 'installing',
  DELIVERY_ISSUE: 'delivery_issue',
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

// Phí giao, đặt cọc và bảo hành phải khớp migration 202611030001_furniture_flows.sql (database tính lại khi đặt hàng)
export const DELIVERY_ZONES = [
  { key: 'inner_city', label: 'Nội thành TP.HCM, Hà Nội', fee: 0, icon: 'city-variant-outline' },
  { key: 'suburban', label: 'Ngoại thành TP.HCM, Hà Nội', fee: 300000, icon: 'home-group' },
  { key: 'province', label: 'Tỉnh/thành khác', fee: 800000, icon: 'truck-fast-outline' },
];
export const deliveryZone = (key) => DELIVERY_ZONES.find((zone) => zone.key === key) || null;

export const DEPOSIT_THRESHOLD = 20000000;
// Cọc 30%, làm tròn lên nghìn đồng (tính bằng số nguyên để tránh sai số số thực)
export const depositFor = (total) => (total >= DEPOSIT_THRESHOLD ? Math.ceil((total * 3) / 10000) * 1000 : 0);

export const DEPOSIT_STATUS = {
  NOT_REQUIRED: 'not_required',
  AWAITING: 'awaiting',
  PAID: 'paid',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
};

export const DEPOSIT_STATUSES = {
  awaiting: { label: 'Chờ chuyển cọc', color: '#9A5B2E' },
  paid: { label: 'Đã nhận cọc', color: '#2F7250' },
  refunded: { label: 'Hoàn cọc trong 3–5 ngày làm việc', color: '#47708A' },
  cancelled: { label: 'Đơn đã hủy, không cần cọc', color: '#6B6B6B' },
};

// Ngày hết bảo hành = ngày giao xong + số tháng bảo hành
export const warrantyEndDate = (deliveredAt, months) => {
  if (!deliveredAt || !months) return '';
  const date = new Date(deliveredAt);
  date.setMonth(date.getMonth() + months);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const INSTALLATION_TIME_SLOTS = [
  { key: '08:00-12:00', label: 'Buổi sáng', note: '08:00–12:00', icon: 'weather-sunny' },
  { key: '13:00-17:00', label: 'Buổi chiều', note: '13:00–17:00', icon: 'weather-sunset' },
];

export const ORDER_STATUSES = {
  pending_confirmation: { label: 'Chờ xác nhận', color: '#9A5B2E', bg: '#F6E7D8', icon: 'clock-outline' },
  confirmed: { label: 'Đã xác nhận', color: '#47708A', bg: '#E1EDF3', icon: 'check-circle-outline' },
  preparing: { label: 'Đang chuẩn bị', color: '#79652F', bg: '#F2ECD8', icon: 'package-variant-closed' },
  shipping: { label: 'Đang giao', color: '#356B58', bg: '#DDEDE6', icon: 'truck-delivery-outline' },
  installing: { label: 'Đang lắp đặt', color: '#5B5A8E', bg: '#E6E5F2', icon: 'tools' },
  delivery_issue: { label: 'Chờ giao bù', color: '#B4542E', bg: '#F8E2D6', icon: 'truck-alert-outline' },
  delivered: { label: 'Đã giao & lắp đặt', color: '#2F7250', bg: '#DCEEE3', icon: 'check-circle' },
  cancelled: { label: 'Đã hủy', color: '#A34E43', bg: '#F4E1DE', icon: 'close-circle-outline' },
};


// ---------- Sự cố giao hàng, báo lỗi / bảo hành (migration 202611030008) ----------
export const INCIDENT_KINDS = {
  missing: { label: 'Giao thiếu', icon: 'package-variant-remove' },
  damaged: { label: 'Hàng hỏng', icon: 'package-variant-closed-remove' },
};

export const SUPPORT_STATUSES = {
  pending: { label: 'Chờ tiếp nhận', color: '#9A5B2E', bg: '#F6E7D8', icon: 'clock-outline' },
  scheduled: { label: 'Đã hẹn lịch', color: '#47708A', bg: '#E1EDF3', icon: 'calendar-check' },
  in_progress: { label: 'Đang xử lý', color: '#5B5A8E', bg: '#E6E5F2', icon: 'tools' },
  completed: { label: 'Hoàn tất', color: '#2F7250', bg: '#DCEEE3', icon: 'check-circle' },
  rejected: { label: 'Từ chối', color: '#A34E43', bg: '#F4E1DE', icon: 'close-circle-outline' },
  cancelled: { label: 'Đã hủy', color: '#6B6B6B', bg: '#ECECEC', icon: 'cancel' },
};
export const supportStatus = (key) => SUPPORT_STATUSES[key] || SUPPORT_STATUSES.pending;
export const OPEN_SUPPORT_STATUSES = ['pending', 'scheduled', 'in_progress'];

export const ASSESSMENTS = {
  store_fault: 'Lỗi do cửa hàng (vận chuyển, kho, lỗi sẵn)',
  customer_fault: 'Lỗi do khách sử dụng',
};
export const CONCLUSIONS = {
  store_return: 'Đổi trả miễn phí (lỗi cửa hàng)',
  warranty: 'Bảo hành',
  rejected: 'Từ chối',
};
export const RESOLUTIONS = { repair: 'Sửa chữa', replace: 'Đổi mới' };

// Số tiền nhân viên cần thu khi giao = tổng đơn - tiền cọc đã nhận
export const amountDue = (order) => order.total - (order.depositStatus === 'paid' ? order.depositAmount : 0);

// Ngày giao xong (mốc tính bảo hành) và món còn được báo lỗi / bảo hành không
export const deliveredAtOf = (order) => [...(order.statusHistory || [])].reverse().find((event) => event.status === ORDER_STATUS.DELIVERED)?.at || null;
export const warrantyActive = (order, item) => {
  const deliveredAt = deliveredAtOf(order);
  if (order.status !== ORDER_STATUS.DELIVERED || !deliveredAt || !item.warrantyMonths) return false;
  const end = new Date(deliveredAt);
  end.setMonth(end.getMonth() + item.warrantyMonths);
  return Date.now() <= end.getTime();
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

// Các ngày có thể chọn để giao và lắp đặt: từ ngày mai, liên tiếp `count` ngày (giờ Việt Nam)
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const installationDateOptions = (count = 14) => {
  const [year, month, day] = earliestInstallationDate().split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index));
    return {
      value: date.toISOString().slice(0, 10),
      weekday: WEEKDAYS[date.getUTCDay()],
      label: `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    };
  });
};

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
// ---------- Giá sỉ và quà tặng: phải khớp apply_furniture_terms (migration 202611030007) ----------
// Mua từ wholesaleMinQty cái của cùng một sản phẩm (cộng mọi màu) thì mỗi cái giảm thêm wholesalePercent
export const wholesaleApplies = (product, totalQty) => product.wholesalePercent > 0 && totalQty >= product.wholesaleMinQty;
export const wholesalePrice = (product) => Math.round(finalPrice(product) * (1 - product.wholesalePercent));

// Tính tiền các dòng hàng: lines = [{ product, quantity, ... }]
export const priceLines = (lines) => {
  const qtyByProduct = {};
  lines.forEach((line) => { qtyByProduct[line.product.id] = (qtyByProduct[line.product.id] || 0) + line.quantity; });
  const priced = lines.map((line) => {
    const wholesale = wholesaleApplies(line.product, qtyByProduct[line.product.id]);
    const unitPrice = wholesale ? wholesalePrice(line.product) : finalPrice(line.product);
    return { ...line, wholesale, unitPrice, lineTotal: unitPrice * line.quantity };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const itemsTotal = priced.reduce((sum, line) => sum + line.lineTotal, 0);
  return { lines: priced, subtotal, itemsTotal, discount: subtotal - itemsTotal };
};

// Quà nhận được (mốc cao nhất đạt được) và mốc quà kế tiếp để nhắc khách mua thêm
export const giftFor = (rules, itemsTotal) => rules
  .filter((rule) => rule.available && rule.minTotal <= itemsTotal)
  .sort((a, b) => b.minTotal - a.minTotal)[0] || null;
export const nextGiftFor = (rules, itemsTotal) => rules
  .filter((rule) => rule.available && rule.minTotal > itemsTotal)
  .sort((a, b) => a.minTotal - b.minTotal)[0] || null;

// Số lượng còn của một màu; sản phẩm chưa có dữ liệu theo màu thì dùng tồn kho chung
export const colorStockOf = (product, color) => {
  if (!product) return 0;
  const byColor = product.colorStock || {};
  if (!Object.keys(byColor).length) return product.stock ?? 0;
  return byColor[color || product.color?.[0] || ''] ?? 0;
};

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
