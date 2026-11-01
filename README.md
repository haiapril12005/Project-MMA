# FurWorld — ứng dụng mua nội thất (Expo + Supabase)

Ứng dụng người mua chạy trên Expo/React Native và web. Dữ liệu thật được lưu trên Supabase PostgreSQL; tài khoản dùng Supabase Auth, không lưu mật khẩu trong code hoặc bảng public.

## Chức năng chính

- Catalog 40 sản phẩm, tìm kiếm, lọc, sắp xếp và xem đánh giá đã xác minh mua hàng.
- Đăng ký/đăng nhập email, hồ sơ và đổi mật khẩu bằng Supabase Auth.
- Yêu thích và giỏ hàng đồng bộ theo tài khoản trên nhiều thiết bị.
- Chọn màu, số lượng, thông tin nhận hàng và COD/chuyển khoản.
- Tự điền địa chỉ mặc định từ hồ sơ, cho phép sửa tại checkout và tùy chọn lưu lại cho lần sau.
- Bắt buộc chọn ngày giao/lắp đặt từ ngày kế tiếp và khung giờ sáng hoặc chiều.
- Tạo đơn atomically ở PostgreSQL, sinh mã đơn phía server và giữ snapshot sản phẩm/giá/màu.
- Lịch sử, chi tiết và tiến trình trạng thái đơn hàng.
- Mua lại đơn đã giao: giữ màu/số lượng cũ, dùng giá hiện tại, gộp giỏ và báo rõ mục không còn phù hợp.
- Gửi yêu cầu hủy có lý do khi đơn còn chờ xác nhận/đã xác nhận; cửa hàng duyệt hoặc từ chối và để lại ghi chú.
- Chỉ người mua có đơn đã giao mới được đánh giá; mỗi tài khoản một đánh giá/sản phẩm và có giới hạn chống spam phía database.
- RLS giới hạn người mua chỉ đọc/sửa hồ sơ, giỏ, yêu thích, đánh giá và đơn của chính họ.

## Khởi tạo Supabase lần đầu

Project cần chạy sáu file theo đúng thứ tự trong **Supabase Dashboard → SQL Editor**:

1. `supabase/migrations/202610290001_initial_schema.sql`
2. `supabase/migrations/202610300001_order_cancellations.sql`
3. `supabase/migrations/202611010001_verified_reviews.sql`
4. `supabase/migrations/202611010002_delivery_installation.sql`
5. `supabase/migrations/202611010003_reorder.sql`
6. `supabase/seed.sql`

Migration tạo các bảng nghiệp vụ, trigger, RLS và các RPC đặt/hủy đơn/đánh giá. Seed chỉ thêm 40 sản phẩm; không tạo tài khoản, đơn hàng hoặc đánh giá giả. Migration đánh giá sẽ xóa đánh giá mẫu ẩn danh và các đánh giá cũ không chứng minh được bằng một đơn đã giao.

Nếu database đã chạy các migration cũ, chỉ cần chạy thêm `202611010001_verified_reviews.sql` trong SQL Editor. Migration này giữ lại đánh giá thật có đơn `delivered`, xóa đánh giá mẫu/không hợp lệ và không ảnh hưởng sản phẩm, tài khoản hay đơn hàng.

Sau đó chạy `202611010002_delivery_installation.sql`. Migration này giữ nguyên đơn cũ, nhưng bắt buộc mọi đơn mới phải có ngày giao/lắp đặt từ ngày kế tiếp và một trong hai khung `08:00–12:00` hoặc `13:00–17:00`.

Cuối cùng chạy `202611010003_reorder.sql` để bật RPC mua lại an toàn cho các đơn `delivered`.

Khi sửa `src/data/seed.js`, chạy:

```bash
npm run supabase:seed
```

Sau đó chạy lại file `supabase/seed.sql` trong SQL Editor.

## Cấu hình môi trường

Sao chép `.env.example` thành `.env` và điền public project URL cùng anon key:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

`anon key` được phép dùng ở client; bảo mật dữ liệu do RLS đảm nhiệm. Tuyệt đối không đưa `service_role key` vào Expo/web.

Nếu **Confirm email** đang bật trong Supabase Auth, người dùng phải bấm liên kết xác nhận trước khi đăng nhập. Cấu hình Site URL/Redirect URLs và SMTP riêng trước khi đưa lên production.

## Chạy project

```bash
npm install
npm test
npx expo start
npx expo start --web
```

## Cấu trúc dữ liệu

- `src/lib/supabase.js`: client Supabase và session storage cho web/mobile.
- `src/api/index.js`: mapping dữ liệu database sang model giao diện.
- `src/context/AppContext.js`: Auth, hồ sơ, yêu thích, giỏ và đơn hàng.
- `supabase/migrations/`: schema, constraints, trigger, RLS và RPC.
- `supabase/seed.sql`: dữ liệu catalog sản phẩm được sinh tự động, không chứa đánh giá mẫu.

## Lưu ý nghiệp vụ

- Ứng dụng không quản lý nhập/xuất kho; chỉ hiển thị và giới hạn số lượng theo trường `stock` như yêu cầu giao diện người mua.
- RPC `place_order` tính lại giá từ database, tạo đơn + chi tiết đơn và xóa giỏ trong cùng một transaction. Nếu có lỗi, giỏ hàng vẫn còn nguyên.
- RPC đánh giá xác minh sản phẩm thuộc đơn `delivered`, lấy tên từ hồ sơ, giới hạn nội dung 10–1.000 ký tự, chặn link và giới hạn một lần ghi mỗi 60 giây.
- Thông tin nhận hàng và lịch lắp đặt được lưu dạng snapshot trong đơn; thay đổi hồ sơ sau đó không làm đổi đơn cũ.
- RPC mua lại không dùng giá snapshot để đặt hàng mới; nó chỉ gộp sản phẩm/màu hợp lệ vào giỏ, còn checkout luôn tính lại giá hiện tại từ database.
- Chuyển khoản hiện là lựa chọn thanh toán và trạng thái `unpaid`; chưa tích hợp cổng thanh toán ngân hàng.
- Cập nhật trạng thái giao hàng cần thực hiện bằng dashboard hoặc một ứng dụng quản trị/service backend riêng.

## Duyệt yêu cầu hủy trong Supabase Dashboard

Người mua chỉ được gửi và đọc yêu cầu của chính mình. Cửa hàng duyệt trong SQL Editor bằng `id` của yêu cầu:

```sql
update public.order_cancellation_requests
set status = 'approved', store_note = 'Cửa hàng đã xác nhận hủy đơn.'
where id = 'REQUEST_UUID';
```

Khi duyệt, trigger tự chuyển đơn sang `cancelled` và ghi lịch sử trạng thái. Để từ chối, dùng `status = 'rejected'` và điền lý do vào `store_note`. Mỗi đơn chỉ được gửi một yêu cầu hủy.
