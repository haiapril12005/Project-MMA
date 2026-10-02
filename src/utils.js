export const CATEGORIES = ['Tất cả', 'Sofa & Ghế', 'Bàn', 'Giường & Tủ', 'Đèn & Trang trí'];
export const PRICE_RANGES = [
  { label: 'Mọi mức giá', min: 0, max: Infinity },
  { label: 'Dưới 2 triệu', min: 0, max: 2e6 },
  { label: '2 – 5 triệu', min: 2e6, max: 5e6 },
  { label: '5 – 10 triệu', min: 5e6, max: 10e6 },
  { label: 'Trên 10 triệu', min: 10e6, max: Infinity },
];
export const SORTS = [
  { key: 'priceDesc', label: 'Giá giảm dần' },
  { key: 'priceAsc', label: 'Giá tăng dần' },
  { key: 'nameAsc', label: 'Tên A–Z' },
];

export const formatVND = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
export const finalPrice = (p) => Math.round(p.price * (1 - (p.percentOff || 0)));
export const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

export function applyFilters(list, { q, cat, range, sort }) {
  const r = PRICE_RANGES[range];
  const nq = norm(q);
  const out = list.filter((p) => {
    const price = finalPrice(p);
    return (cat === 'Tất cả' || p.category === cat) && price >= r.min && price < r.max && (!nq || norm(p.name).includes(nq));
  });
  const by = {
    priceDesc: (a, b) => finalPrice(b) - finalPrice(a),
    priceAsc: (a, b) => finalPrice(a) - finalPrice(b),
    nameAsc: (a, b) => a.name.localeCompare(b.name, 'vi'),
  }[sort];
  return out.sort(by);
}
