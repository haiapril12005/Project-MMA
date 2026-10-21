// Dữ liệu mẫu theo định dạng mockapi.io.
// Dùng CommonJS để chạy được cả trong app lẫn lệnh `npm run seed`.
// Ảnh lấy từ Pexels (miễn phí, được dùng cho mục đích thương mại). Có thể thay bằng ảnh sản phẩm thật của bạn.

const img = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

// [tên, giá gốc (VND), thương hiệu, chất liệu, kích thước, màu, id ảnh Pexels, % giảm]
const CATALOG = {
  'Đèn chùm': [
    ['Đèn chùm pha lê Versailles 8 tay', 18500000, 'Lumière Việt', 'Pha lê K9, khung đồng', 'Ø80 x 75 cm', ['Vàng đồng', 'Trong suốt'], 9116521, 0.15],
    ['Đèn chùm pha lê Hoàng Gia 12 tay', 32900000, 'Lumière Việt', 'Pha lê K9, khung hợp kim mạ vàng', 'Ø110 x 95 cm', ['Vàng đồng'], 9797913, 0.1],
    ['Đèn chùm cổ điển Florentine', 14200000, 'Kova Home', 'Thủy tinh, sắt sơn tĩnh điện', 'Ø70 x 80 cm', ['Vàng đồng', 'Trắng ngà'], 11256573, 0],
    ['Đèn chùm đôi Aurelia', 24800000, 'Lumière Việt', 'Pha lê, khung đồng thau', 'Ø90 x 85 cm (mỗi đèn)', ['Vàng đồng'], 12024171, 0.2],
    ['Đèn chùm hiện đại Halo LED', 9600000, 'Kova Home', 'Nhôm, chụp acrylic', 'Ø60 x 40 cm', ['Vàng nhạt', 'Trắng ngà'], 28656088, 0.12],
    ['Đèn thả công nghiệp Loft (bộ 3)', 3450000, 'Nhà Nắng', 'Thép sơn mờ, bóng Edison', 'Ø25 x 30 cm', ['Đen mờ', 'Đồng rêu'], 5561129, 0],
    ['Đèn thả mây tre đan Hội An (bộ 3)', 2190000, 'Mộc An', 'Mây tre đan thủ công', 'Ø35 x 28 cm', ['Mộc tự nhiên'], 17299918, 0.18],
    ['Đèn chùm khung gỗ Thanh Đa', 5800000, 'Mộc An', 'Gỗ tần bì, vải lanh', 'Ø75 x 50 cm', ['Mộc tự nhiên', 'Trắng ngà'], 36265889, 0.08],
  ],
  Sofa: [
    ['Sofa băng 3 chỗ Đà Lạt vải lanh', 12900000, 'Nhà Nắng', 'Vải lanh, khung gỗ thông', '210 x 90 x 82 cm', ['Kem', 'Xám tro'], 6758245, 0.1],
    ['Sofa nhung xanh rêu Sài Gòn', 15400000, 'Hearth & Oak', 'Nhung cao cấp, chân gỗ sồi', '200 x 92 x 80 cm', ['Xanh rêu', 'Nâu đất'], 6580416, 0.15],
    ['Sofa 2 chỗ Mây xám', 8700000, 'Kova Home', 'Vải bố, mút D40', '160 x 85 x 78 cm', ['Xám tro', 'Kem'], 4857775, 0],
    ['Sofa góc chữ L Thảo Điền', 22500000, 'Hearth & Oak', 'Vải bố chống bám bẩn', '280 x 180 x 85 cm', ['Kem', 'Nâu đất'], 7018400, 0.2],
    ['Sofa da bò Cognac 3 chỗ', 28900000, 'Hearth & Oak', 'Da bò thật, khung gỗ dầu', '215 x 95 x 80 cm', ['Nâu cognac'], 6480707, 0.12],
    ['Sofa nhung Velour lá non', 13800000, 'Kova Home', 'Nhung velour, chân gỗ cao su', '190 x 88 x 80 cm', ['Xanh rêu'], 4846097, 0.25],
    ['Sofa module Phú Mỹ', 26400000, 'Nhà Nắng', 'Vải nỉ, mút đàn hồi', '300 x 160 x 82 cm', ['Xám tro', 'Kem'], 4112598, 0.1],
    ['Sofa Linen Cloud màu kem', 17200000, 'Kova Home', 'Vải lanh pha cotton', '220 x 95 x 78 cm', ['Kem'], 39828916, 0],
  ],
  'Ghế gỗ': [
    ['Ghế gỗ sồi tựa nan Oslo', 1650000, 'Mộc An', 'Gỗ sồi trắng', '45 x 50 x 80 cm', ['Mộc tự nhiên', 'Nâu óc chó'], 29917912, 0],
    ['Ghế gỗ tần bì Nắng Sớm', 1290000, 'Mộc An', 'Gỗ tần bì', '44 x 48 x 78 cm', ['Mộc tự nhiên'], 11736189, 0.1],
    ['Ghế gỗ mộc Đường Lâm (bộ 2)', 2380000, 'Mộc An', 'Gỗ thông tái chế', '42 x 45 x 85 cm', ['Nâu đất'], 36339342, 0.15],
    ['Ghế gỗ chạm khắc bọc nỉ Huế', 4900000, 'Hearth & Oak', 'Gỗ gụ, nỉ bọc', '55 x 55 x 95 cm', ['Xanh rêu', 'Nâu óc chó'], 15948887, 0],
    ['Ghế đẩu gỗ cao su Mộc', 590000, 'Nhà Nắng', 'Gỗ cao su', '35 x 35 x 45 cm', ['Mộc tự nhiên'], 16037587, 0.2],
    ['Ghế bành gỗ óc chó Reading', 7800000, 'Hearth & Oak', 'Gỗ óc chó, nệm vải bố', '75 x 80 x 85 cm', ['Nâu óc chó', 'Kem'], 2079246, 0.1],
    ['Ghế bành tay vịn Cà Phê (bộ 2)', 9400000, 'Hearth & Oak', 'Gỗ sồi, da PU', '70 x 75 x 82 cm', ['Nâu cognac'], 18258470, 0.12],
    ['Ghế thư giãn gỗ Chiều Vintage', 5300000, 'Nhà Nắng', 'Gỗ dầu, nệm vải nhung', '68 x 78 x 88 cm', ['Nâu đất'], 32710106, 0],
  ],
  'Bàn ghế': [
    ['Bộ bàn ăn tròn 4 ghế Nordic', 11900000, 'Kova Home', 'Gỗ sồi, mặt phủ veneer', 'Bàn Ø110 x 75 cm', ['Mộc tự nhiên', 'Trắng ngà'], 2995012, 0.15],
    ['Bộ bàn ăn gỗ 6 ghế Sum Vầy', 18600000, 'Mộc An', 'Gỗ sồi Mỹ', 'Bàn 180 x 90 x 75 cm', ['Mộc tự nhiên'], 6748972, 0.1],
    ['Bộ bàn ăn mộc Tây Bắc', 14300000, 'Mộc An', 'Gỗ thông nguyên tấm', 'Bàn 160 x 85 x 75 cm', ['Nâu đất'], 7538106, 0],
    ['Bộ bàn ghế gỗ thông Rustic', 8200000, 'Nhà Nắng', 'Gỗ thông sấy', 'Bàn 140 x 80 x 75 cm', ['Nâu đất', 'Mộc tự nhiên'], 37895915, 0.2],
    ['Bộ bàn cà phê ban công Ánh Dương', 3900000, 'Nhà Nắng', 'Gỗ keo, chân sắt', 'Bàn Ø70 x 72 cm', ['Mộc tự nhiên'], 1843653, 0.1],
    ['Bộ bàn trà kính và ghế bành Lounge', 12700000, 'Kova Home', 'Kính cường lực, khung thép', 'Bàn 100 x 60 x 45 cm', ['Kem', 'Xám tro'], 7195580, 0.18],
    ['Bộ bàn ăn bếp mở Minimal', 9900000, 'Kova Home', 'MDF chống ẩm, chân sắt', 'Bàn 120 x 75 x 75 cm', ['Trắng ngà'], 7166645, 0],
    ['Bộ bàn kính 4 ghế Indigo', 7600000, 'Hearth & Oak', 'Kính, thép sơn tĩnh điện', 'Bàn Ø90 x 74 cm', ['Xanh lam', 'Đen mờ'], 33442153, 0.12],
  ],
  'Gia dụng': [
    ['Bộ ấm siêu tốc và máy pha cà phê Noir', 3290000, 'Kova Home', 'Thép không gỉ, nhựa PP', 'Ấm 1.7 lít', ['Đen mờ'], 18071814, 0.1],
    ['Bộ gia dụng retro Kem Sữa (3 món)', 5900000, 'Nhà Nắng', 'Thép sơn men, nhựa ABS', 'Ấm 1.5 lít, máy nướng 2 ngăn', ['Kem'], 30946798, 0.15],
    ['Máy nướng bánh mì Trắng Sữa 2 ngăn', 1190000, 'Kova Home', 'Nhựa chịu nhiệt, thép', '28 x 17 x 19 cm', ['Trắng ngà'], 3997309, 0],
    ['Máy nướng bánh mì thép Slim', 1490000, 'Hearth & Oak', 'Thép không gỉ', '30 x 18 x 20 cm', ['Bạc'], 5825406, 0.1],
    ['Combo lò nướng âm tủ và bếp từ', 15900000, 'Hearth & Oak', 'Kính ceramic, thép', 'Lò 60 lít, bếp 2 vùng nấu', ['Đen mờ', 'Bạc'], 7614540, 0.2],
    ['Máy nướng bánh mì Pastel Hồng', 1090000, 'Nhà Nắng', 'Nhựa ABS sơn mờ', '27 x 16 x 19 cm', ['Hồng phấn'], 11826919, 0.25],
    ['Máy pha cà phê Espresso Barista', 7900000, 'Kova Home', 'Thép không gỉ', '30 x 28 x 35 cm, áp suất 15 bar', ['Bạc'], 4349798, 0.1],
    ['Bộ thiết bị bếp âm tủ Lux', 24900000, 'Hearth & Oak', 'Thép không gỉ', 'Tủ lạnh 350 lít, lò 70 lít', ['Bạc'], 6527057, 0],
  ],
};

const DESC = {
  'Đèn chùm': 'ánh sáng vàng ấm, phù hợp phòng khách, phòng ăn hoặc sảnh. Có dịch vụ lắp đặt tận nơi.',
  Sofa: 'ngồi êm, đệm có thể tháo rời để giặt. Hợp với phòng khách từ 15 m² trở lên.',
  'Ghế gỗ': 'gỗ được sấy và xử lý chống mối mọt, bề mặt phủ dầu tự nhiên an toàn.',
  'Bàn ghế': 'thiết kế chắc chắn, dễ lau chùi, hợp với phòng ăn và góc cà phê trong nhà.',
  'Gia dụng': 'thiết kế hiện đại, tiết kiệm điện, bảo hành chính hãng tại nhà.',
};

const products = [];
let n = 0;
Object.entries(CATALOG).forEach(([category, items]) =>
  items.forEach(([name, price, brand, material, dimensions, color, photo, percentOff]) => {
    n += 1;
    products.push({
      id: String(n),
      name,
      price,
      category,
      brand,
      color,
      material,
      dimensions,
      description: `${name} làm từ ${material.toLowerCase()}, ${DESC[category]} Bảo hành 24 tháng.`,
      uri: img(photo),
      percentOff,
      stock: 3 + ((n * 7) % 18),
    });
  })
);

const users = [
  { id: '1', name: 'Nguyễn Minh Khôi', email: 'demo@furworld.vn', password: '123456', phone: '0908 214 573', address: '12 Nguyễn Văn Hưởng, Thảo Điền, TP. Thủ Đức', cart: [] },
];

const NAMES = ['Ngọc Hân', 'Đức Huy', 'Bảo Trâm', 'Thanh Tùng', 'Mai Chi', 'Gia Khánh', 'Phương Linh', 'Quang Vinh'];
const COMMENTS = {
  5: ['Hàng đẹp y như ảnh, giao và lắp đặt rất cẩn thận.', 'Chất lượng tốt hơn mong đợi, cả nhà đều thích.', 'Màu ấm, hợp với phòng khách nhà mình.'],
  4: ['Sản phẩm chắc chắn, giao hàng chậm hơn hẹn một ngày.', 'Đẹp, màu ngoài thực tế nhạt hơn ảnh một chút.'],
  3: ['Tạm ổn so với giá, đóng gói có thể kỹ hơn.'],
  2: ['Có vài vết xước nhỏ, shop đã hỗ trợ đổi.'],
  1: ['Giao sai màu, mất thời gian đổi trả.'],
};
const PATTERN = [5, 4, 5, 3, 5, 4, 2, 5, 4, 1, 5, 4];

const reviews = [];
products.forEach((p) => {
  const id = Number(p.id);
  const count = 3 + (id % 3);
  for (let k = 0; k < count; k += 1) {
    const rating = PATTERN[(id * 5 + k * 7) % PATTERN.length];
    const list = COMMENTS[rating];
    const month = String(1 + ((id + k * 3) % 9)).padStart(2, '0');
    const day = String(10 + ((id + k) % 18));
    reviews.push({
      id: `r${p.id}-${k}`,
      productId: p.id,
      userId: `seed${(id + k) % NAMES.length}`,
      userName: NAMES[(id + k) % NAMES.length],
      rating,
      comment: list[(id + k) % list.length],
      createdAt: `2026-${month}-${day}T09:00:00.000Z`,
    });
  }
});

module.exports = { products, users, reviews };
