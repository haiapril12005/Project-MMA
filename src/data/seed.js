// Dữ liệu mẫu theo định dạng mockapi.io. Dùng CommonJS để chạy được cả trong app lẫn `npm run seed`.
const CATS = [
  { name: 'Sofa & Ghế', material: ['Vải bọc', 'Da PU', 'Gỗ sồi', 'Khung thép'], dims: ['220x95x85 cm', '200x90x80 cm', '70x72x85 cm'],
    items: [['Sofa góc chữ L Oslo', 18900000], ['Sofa băng 3 chỗ Nordic', 12500000], ['Ghế bành Bergen', 6800000], ['Ghế thư giãn Lund', 5200000], ['Sofa đôi Malmö', 9400000], ['Ghế ăn gỗ sồi Aria', 1450000], ['Ghế bar Stockholm', 1890000], ['Ghế đôn Vika', 790000], ['Ghế lười Hygge', 1250000], ['Sofa giường Kiruna', 11200000]] },
  { name: 'Bàn', material: ['Gỗ sồi', 'Gỗ óc chó', 'Mặt đá', 'Gỗ MDF phủ veneer'], dims: ['160x80x75 cm', '120x60x75 cm', '90x90x45 cm'],
    items: [['Bàn ăn gỗ sồi Fjord', 8900000], ['Bàn làm việc Lofoten', 4200000], ['Bàn trà tròn Sigrid', 2350000], ['Bàn console Hedda', 3100000], ['Bàn ăn mở rộng Dalen', 12800000], ['Bàn trang điểm Freya', 3650000], ['Bàn học gấp Ole', 1190000], ['Bàn bên Elin', 890000], ['Bàn làm việc chữ L Nils', 6400000], ['Bàn trà đôi Tove', 2790000]] },
  { name: 'Giường & Tủ', material: ['Gỗ sồi', 'Gỗ công nghiệp', 'Gỗ thông', 'Khung bọc nỉ'], dims: ['200x180x95 cm', '180x50x200 cm', '60x40x55 cm'],
    items: [['Giường ngủ gỗ Haven 1m8', 14500000], ['Giường bọc nệm Luna', 11900000], ['Tủ quần áo 3 cánh Stavanger', 9800000], ['Tủ đầu giường Mio', 1650000], ['Tủ giày Bjorn', 2450000], ['Tủ sách Linnea', 4300000], ['Tủ TV Odin', 5700000], ['Kệ tủ bếp Saga', 3200000], ['Giường tầng Nova', 8600000], ['Tủ ngăn kéo Alma', 3950000]] },
  { name: 'Đèn & Trang trí', material: ['Gốm sứ', 'Vải lanh', 'Gỗ tần bì', 'Kim loại sơn tĩnh điện'], dims: ['Ø40x120 cm', '30x30x55 cm', '60x90 cm'],
    items: [['Đèn thả Aurora', 1890000], ['Đèn bàn Skog', 690000], ['Đèn sàn Vinter', 1450000], ['Đèn ngủ gốm Liv', 520000], ['Gương tròn viền gỗ Sol', 1250000], ['Tranh canvas Bắc Âu', 890000], ['Bình gốm Kari', 380000], ['Thảm lông Fjell', 2350000], ['Kệ treo tường Eik', 450000], ['Đồng hồ treo tường Tid', 590000]] },
];
const BRANDS = ['Nordic Home', 'Wood & Co', 'Hygge Studio'];
const COLORS = [['Be'], ['Nâu gỗ', 'Be'], ['Trắng'], ['Xám', 'Trắng'], ['Xanh rêu']];
const OFFS = [0, 0.1, 0.15, 0.2, 0.25, 0.3];

const products = [];
let n = 0;
CATS.forEach((c) => c.items.forEach(([name, price], i) => {
  n += 1;
  const material = c.material[i % c.material.length];
  products.push({
    id: String(n), name, price, category: c.name, brand: BRANDS[n % 3], color: COLORS[n % COLORS.length],
    material, dimensions: c.dims[i % c.dims.length],
    description: `${name} thiết kế tối giản theo phong cách Bắc Âu, chất liệu ${material.toLowerCase()}, dễ phối với nhiều không gian sống. Bảo hành 12 tháng.`,
    uri: `https://picsum.photos/seed/furworld${n}/600/600`, // TODO: thay bằng link ảnh thật
    percentOff: OFFS[n % OFFS.length], stock: 5 + ((n * 7) % 20),
  });
}));

const users = [{ id: '1', name: 'Khách Demo', email: 'demo@furworld.vn', password: '123456', phone: '0900000000', address: 'TP. Hồ Chí Minh', favorites: [], cart: [] }];

const NAMES = ['Minh Anh', 'Thu Trang', 'Quốc Bảo', 'Lan Phương', 'Hoàng Nam'];
const COMMENTS = {
  5: ['Rất đẹp, đúng như hình, giao hàng nhanh.', 'Chất lượng tuyệt vời, rất đáng tiền.'],
  4: ['Sản phẩm tốt, lắp đặt hơi lâu một chút.', 'Đẹp và chắc chắn, màu hơi khác ảnh.'],
  3: ['Tạm ổn so với mức giá.'], 2: ['Đóng gói chưa kỹ, có vài vết xước nhỏ.'], 1: ['Không giống mô tả, hơi thất vọng.'],
};
const reviews = [];
products.forEach((p) => [0, 1].forEach((k) => {
  const id = Number(p.id);
  const rating = [5, 4, 5, 3, 4, 2, 5, 1][(id * 3 + k * 5) % 8];
  const list = COMMENTS[rating];
  reviews.push({ id: `r${p.id}-${k}`, productId: p.id, userId: `seed${(id + k) % 5}`, userName: NAMES[(id + k) % 5], rating, comment: list[id % list.length], createdAt: `2026-0${1 + ((id + k) % 8)}-1${k}T09:00:00.000Z` });
}));

module.exports = { products, users, reviews };
