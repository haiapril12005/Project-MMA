# FurWorld - Nội thất cho ngôi nhà ấm (Expo + React Native)

App bán nội thất: đèn chùm, sofa, ghế gỗ, bộ bàn ghế và đồ gia dụng hiện đại. Chạy được trên điện thoại (Expo Go / Android Studio) và trên trình duyệt mobile.

## Chạy thử

```bash
npm install
npx expo install --fix     # căn chỉnh phiên bản thư viện theo SDK Expo
npx expo start             # quét QR bằng Expo Go
npx expo start --web       # hoặc mở trên trình duyệt (bấm w)
```

Nếu báo lỗi cache sau khi đổi code: `npx expo start -c`.

Tài khoản thử: `demo@furworld.vn` / `123456` (màn Đăng nhập có nút "Dùng tài khoản demo").

## Giao diện

- Tone ấm, không chói, không tối: nền lanh `#F6F0E9`, thẻ `#FFFBF6`, màu nhấn đất nung `#985333`, chữ nâu cacao `#4A3A30`.
- Mọi cặp chữ/nền đạt độ tương phản tối thiểu 4.5:1.
- Font Be Vietnam Pro (hiển thị dấu tiếng Việt đẹp), icon MaterialCommunityIcons.
- Toàn bộ màu, font, bo góc nằm trong `src/theme.js`. Đổi tông cả app chỉ cần sửa file này.

## Màn hình và chức năng

| Màn hình | Chức năng |
|---|---|
| Trang chủ | Lời chào, tìm kiếm không dấu ("den chum" vẫn ra "Đèn chùm"), banner, 5 danh mục, lọc theo thương hiệu, sắp xếp giá (mặc định cao xuống thấp), lưới 2 cột, kéo để tải lại, khung chờ tải |
| Chi tiết | Ảnh lớn, giá sau giảm và % giảm, chọn màu, thông số dạng lưới, bấm dòng sao để nhảy xuống phần đánh giá, đánh giá gom theo số sao + lọc theo sao, viết/sửa/xóa đánh giá, thanh mua hàng cố định |
| Yêu thích | Lưu trên máy bằng AsyncStorage (không cần đăng nhập), bỏ từng món, xóa tất cả có xác nhận, thêm nhanh vào giỏ |
| Giỏ hàng | Tăng/giảm số lượng theo tồn kho, xóa món, xóa tất cả, tạm tính, tiền giảm, tổng cộng, đặt hàng |
| Tài khoản | Hồ sơ, số món yêu thích/trong giỏ, sửa thông tin, đổi mật khẩu, đăng xuất |
| Đăng nhập / Đăng ký | Nhãn ở trên ô nhập, lỗi hiển thị ngay dưới từng ô |

## Cấu trúc

```
App.js                     Nạp font, SafeArea, Provider, Navigation, Toast
src/
  theme.js                 Màu, font, bo góc, bóng đổ
  config.js                USE_MOCK, BASE_URL, khóa AsyncStorage
  utils.js                 Danh mục, định dạng giá, bỏ dấu, lọc + sắp xếp, hộp thoại xác nhận (chạy cả web)
  api/                     list / create / update / remove giống mockapi.io
  context/AppContext.js    Đăng nhập, yêu thích (AsyncStorage), giỏ hàng, thông báo
  navigation/index.js      Native Stack + Bottom Tabs (thanh tab tự thiết kế)
  components/ui.js         Txt, Button, IconButton, Chip, Field, Stars, ProductImage, Skeleton, EmptyState, QtyStepper
  components/              ProductCard, TabBar, Toast
  screens/                 Home, Detail, Favorites, Cart, Profile, AuthScreens
  data/seed.js             40 sản phẩm, 5 thương hiệu, 160 đánh giá mẫu
```

Các file `components/TopBar.js`, `components/FilterBar.js`, `screens/ProductListScreen.js` là file cũ, không còn dùng, có thể xóa.

## Chuyển sang mockapi.io thật

1. Tạo project trên mockapi.io với 3 resource: `products`, `users`, `reviews`.
2. Chạy `npm run seed` để sinh `seed/products.json`, `users.json`, `reviews.json`, rồi import vào mockapi.io.
3. Trong `src/config.js`: đặt `USE_MOCK = false` và dán `BASE_URL` (dạng `https://xxxx.mockapi.io/api/v1`).

Trường của `products`: `id, name, price, category, brand, color[], material, dimensions, description, uri, percentOff, stock`.

## Ghi chú

- Ảnh sản phẩm lấy từ Pexels (miễn phí). Khi mất mạng, ảnh tự thay bằng icon của danh mục.
- Chế độ mock lưu dữ liệu vào AsyncStorage để giả lập server. Sửa `seed.js` xong muốn nạp lại thì tăng `SEED_VERSION` trong `config.js`.
- Mật khẩu lưu dạng chữ thường, chỉ dùng cho bài tập/demo.
