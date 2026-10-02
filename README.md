# FurWorld – ứng dụng mua bán nội thất (Expo + React Native)

## Chạy thử
```bash
npm install
npx expo install --fix     # căn chỉnh phiên bản các thư viện theo SDK Expo bạn đang dùng
npx expo start             # quét QR bằng Expo Go
```
Tài khoản thử: `demo@furworld.vn` / `123456` (hoặc tự đăng ký).

## Cấu trúc
- `src/navigation` – Native Stack + Bottom Tabs (Trang chủ, Yêu thích, Tài khoản). Giỏ hàng mở từ icon cạnh thanh tìm kiếm.
- `src/screens` – ProductList (dùng chung Trang chủ/Yêu thích), Detail (đánh giá theo sao), Cart, Profile, Login/Register, sửa thông tin, đổi mật khẩu.
- `src/context/AppContext.js` – đăng nhập (phiên lưu AsyncStorage), yêu thích, giỏ hàng; tự đồng bộ lên `users`.
- `src/api` – lớp truy cập dữ liệu giống mockapi.io (list/create/update/remove).
- `src/data/seed.js` – 40 sản phẩm, 1 user, 80 đánh giá mẫu.

## Chuyển sang mockapi.io thật
1. Tạo project trên mockapi.io và 3 resource: `products`, `users`, `reviews`.
2. Chạy `npm run seed` để sinh `seed/products.json`, `users.json`, `reviews.json`, rồi import (hoặc tạo schema theo các trường trong file).
   Gói miễn phí có giới hạn số resource và số bản ghi, nếu bị chặn thì có thể bỏ bớt `reviews` mẫu.
3. Trong `src/config.js`: đặt `USE_MOCK = false` và dán `BASE_URL` (dạng `https://xxxx.mockapi.io/api/v1`).
4. Thay link ảnh `uri` trong `products` bằng ảnh nội thất thật.

Trong `users`, các trường `favorites` (mảng id sản phẩm) và `cart` (mảng `{productId, quantity}`) được lưu nhúng trong bản ghi user.

## Ghi chú
- Chế độ mock lưu vào AsyncStorage để giả lập server. Sửa `seed.js` xong muốn nạp lại thì tăng `SEED_VERSION` trong `config.js`.
- Mật khẩu lưu text thường, chỉ phù hợp bài tập/demo.
