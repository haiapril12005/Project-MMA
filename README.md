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

Project cần chạy chín file theo đúng thứ tự trong **Supabase Dashboard → SQL Editor**:

1. `supabase/migrations/202610290001_initial_schema.sql`
2. `supabase/migrations/202610300001_order_cancellations.sql`
3. `supabase/migrations/202611010001_verified_reviews.sql`
4. `supabase/migrations/202611010002_delivery_installation.sql`
5. `supabase/migrations/202611010003_reorder.sql`
6. `supabase/migrations/202611020001_instant_cancel.sql`
7. `supabase/migrations/202611020002_stock_on_order.sql`
8. `supabase/migrations/202611020003_buy_now.sql`
9. `supabase/migrations/202611030001_furniture_flows.sql`
10. `supabase/migrations/202611030002_color_stock.sql`
11. `supabase/migrations/202611030003_collections_admin.sql`
12. `supabase/migrations/202611030004_admin_orders.sql`
13. `supabase/migrations/202611030005_deposit_approves_order.sql` (admin bấm "Đã nhận cọc" là đơn tự chuyển sang Đã xác nhận)
14. `supabase/migrations/202611030006_dashboard_deposits.sql` (thống kê tiền cọc; chạy lại file này nếu lỡ chạy lại 0003/0004)
15. `supabase/seed.sql` (database mới tạo: chạy lại `202611030003` sau seed để gắn sản phẩm vào bộ sưu tập)

Migration tạo các bảng nghiệp vụ, trigger, RLS và các RPC đặt/hủy đơn/đánh giá. Seed chỉ thêm 40 sản phẩm; không tạo tài khoản, đơn hàng hoặc đánh giá giả. Migration đánh giá sẽ xóa đánh giá mẫu ẩn danh và các đánh giá cũ không chứng minh được bằng một đơn đã giao.

Nếu database đã chạy các migration cũ, chỉ cần chạy thêm `202611010001_verified_reviews.sql` trong SQL Editor. Migration này giữ lại đánh giá thật có đơn `delivered`, xóa đánh giá mẫu/không hợp lệ và không ảnh hưởng sản phẩm, tài khoản hay đơn hàng.

Sau đó chạy `202611010002_delivery_installation.sql`. Migration này giữ nguyên đơn cũ, nhưng bắt buộc mọi đơn mới phải có ngày giao/lắp đặt từ ngày kế tiếp và một trong hai khung `08:00–12:00` hoặc `13:00–17:00`.

Tiếp theo chạy `202611010003_reorder.sql` để bật RPC mua lại an toàn cho các đơn `delivered`.

Cuối cùng chạy lần lượt `202611020001_instant_cancel.sql` (hủy ngay đơn còn chờ xác nhận), `202611020002_stock_on_order.sql` (trừ/hoàn tồn kho, phải chạy sau `202611010002_delivery_installation.sql`) và `202611020003_buy_now.sql` (Mua ngay). Các file này chạy lại nhiều lần vẫn an toàn và tự xóa các bản hàm cũ không còn dùng.

Sau cùng chạy `202611030001_furniture_flows.sql`: phí giao theo khu vực (nội thành miễn phí, ngoại thành 300.000đ, tỉnh khác 800.000đ), đặt cọc 30% cho đơn từ 20 triệu (cửa hàng chỉ xác nhận được đơn khi `deposit_status = 'paid'`), trạng thái `installing` (Đang lắp đặt) và bảo hành theo sản phẩm. Nếu sau đó lỡ chạy lại `202611020002` hoặc `202611020003` thì chạy lại `202611030001` để khóa các hàm đặt hàng cũ.

Tiếp theo chạy `202611030002_color_stock.sql`: tồn kho theo từng màu nằm ở bảng `product_color_stock` (lần đầu chạy, tồn kho hiện có được chia đều cho các màu). `products.stock` tự động bằng tổng các màu, nên muốn đổi tồn kho thì sửa trong bảng `product_color_stock`.

Cuối cùng chạy `202611030003_collections_admin.sql`: bộ sưu tập theo thương hiệu (bảng `collections`, `collection_products`), giá vốn `products.cost_price` (mẫu = 60% giá niêm yết) và thống kê cho admin (RPC `admin_dashboard`). Cấp quyền admin cho một tài khoản bằng SQL Editor:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'email-tai-khoan-admin@example.com'
on conflict do nothing;
```

Sau đó chạy `202611030004_admin_orders.sql`: admin xem mọi đơn và thao tác ngay trong app (Tài khoản → Quản trị cửa hàng → Quản lý đơn hàng): chuyển trạng thái theo đúng luồng, xác nhận đã nhận cọc, duyệt/từ chối yêu cầu hủy, cửa hàng hủy đơn; màn Thống kê có thêm biểu đồ thu chi theo ngày/tháng.

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
- RPC `place_buy_now_order` dùng cho nút **Mua ngay** ở trang chi tiết: đặt đúng 1 sản phẩm (màu, số lượng đang chọn), bắt buộc lịch giao/lắp đặt như đặt từ giỏ, kiểm tra màu và tồn kho phía server, tính giá từ database và **không đọc/xóa giỏ hàng**.
- **Tồn kho**: cả `place_order` và `place_buy_now_order` khóa dòng sản phẩm (`FOR UPDATE`) rồi trừ `stock` trong cùng transaction tạo đơn, nên hai người mua cùng lúc không bán quá kho. Giỏ hàng được kiểm tra theo tổng số lượng mọi màu của một sản phẩm. Khi đơn chuyển sang `cancelled` (ví dụ cửa hàng duyệt yêu cầu hủy), trigger `orders_restore_stock` cộng lại kho; cột `orders.stock_deducted` giúp đơn cũ chưa trừ kho không bị hoàn sai.
- **Hủy đơn**: đơn còn `pending_confirmation` (Chờ xác nhận) được khách **hủy ngay**. RPC `request_order_cancellation` tạo yêu cầu hủy rồi tự duyệt với ghi chú "Tự động hủy…", đi qua các trigger sẵn có nên đơn chuyển `cancelled`, ghi lịch sử và hoàn kho. Đơn đã `confirmed` vẫn phải gửi yêu cầu và chờ cửa hàng duyệt hoặc từ chối.
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
