const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seed = require('../src/data/seed');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202610290001_initial_schema.sql'), 'utf8');
const cancellationMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202610300001_order_cancellations.sql'), 'utf8');
const verifiedReviewsMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611010001_verified_reviews.sql'), 'utf8');
const installationMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611010002_delivery_installation.sql'), 'utf8');
const reorderMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611010003_reorder.sql'), 'utf8');
const sqlSeed = fs.readFileSync(path.join(root, 'supabase', 'seed.sql'), 'utf8');

test('seed chỉ chứa catalog, không tạo đánh giá hoặc dữ liệu người dùng giả', () => {
  assert.deepEqual(Object.keys(seed).sort(), ['products', 'reviews']);
  assert.equal(seed.products.length, 40);
  assert.equal(seed.reviews.length, 0);
});

test('catalog sản phẩm hợp lệ', () => {
  const productIds = new Set(seed.products.map((product) => product.id));
  const imageUrls = new Set(seed.products.map((product) => product.uri));
  assert.equal(productIds.size, seed.products.length);
  assert.equal(imageUrls.size, seed.products.length);
  seed.products.forEach((product) => {
    assert.ok(product.name);
    assert.ok(product.price > 0);
    assert.ok(product.stock >= 0);
    assert.ok(product.percentOff >= 0 && product.percentOff <= 1);
    assert.match(product.uri, /^https:\/\/images\.pexels\.com\/photos\/\d+\/pexels-photo-\d+\.jpeg\?/);
  });
});

test('migration bật RLS cho dữ liệu cá nhân và đặt hàng qua transaction phía server', () => {
  ['profiles', 'favorites', 'cart_items', 'orders', 'order_items', 'order_status_history'].forEach((table) => {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  });
  assert.match(migration, /create or replace function public\.place_order/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /delete from public\.cart_items where user_id = v_user_id/i);
  assert.match(migration, /revoke all on function public\.place_order/i);
});

test('SQL seed không chèn tài khoản, đơn hàng hoặc đánh giá mẫu', () => {
  assert.match(sqlSeed, /insert into public\.products/i);
  assert.match(sqlSeed, /delete from public\.reviews where user_id is null/i);
  assert.doesNotMatch(sqlSeed, /insert into (auth\.users|public\.orders|public\.profiles|public\.reviews)/i);
});

test('yêu cầu hủy đơn được kiểm tra phía server và người mua chỉ có quyền đọc yêu cầu của mình', () => {
  assert.match(cancellationMigration, /create table if not exists public\.order_cancellation_requests/i);
  assert.match(cancellationMigration, /status in \('pending', 'approved', 'rejected'\)/i);
  assert.match(cancellationMigration, /create or replace function public\.request_order_cancellation/i);
  assert.match(cancellationMigration, /for update/i);
  assert.match(cancellationMigration, /v_order_status not in \('pending_confirmation', 'confirmed'\)/i);
  assert.match(cancellationMigration, /requested_by = \(select auth\.uid\(\)\)/i);
  assert.match(cancellationMigration, /new\.status = 'approved'/i);
  assert.match(cancellationMigration, /set status = 'cancelled'/i);
  assert.match(cancellationMigration, /revoke all on function public\.request_order_cancellation/i);
  assert.doesNotMatch(cancellationMigration, /for (insert|update|delete) to authenticated/i);
});

test('chỉ người mua có đơn đã giao mới được đánh giá và mọi ghi dữ liệu đi qua RPC', () => {
  assert.match(verifiedReviewsMigration, /create or replace function public\.can_review_product/i);
  assert.match(verifiedReviewsMigration, /customer_order\.status = 'delivered'/i);
  assert.match(verifiedReviewsMigration, /order_item\.product_id = p_product_id/i);
  assert.match(verifiedReviewsMigration, /create or replace function public\.save_verified_review/i);
  assert.match(verifiedReviewsMigration, /select profile\.name into v_user_name/i);
  assert.match(verifiedReviewsMigration, /verified_purchase[\s\S]*true/i);
  assert.match(verifiedReviewsMigration, /on conflict \(product_id, user_id\) where user_id is not null/i);
  assert.match(verifiedReviewsMigration, /revoke insert, update, delete on public\.reviews from authenticated/i);
  assert.doesNotMatch(verifiedReviewsMigration, /create policy[^;]+for (insert|update|delete) to authenticated/is);
});

test('đánh giá được chống spam ở database và đánh giá mẫu cũ bị xóa', () => {
  assert.match(verifiedReviewsMigration, /delete from public\.reviews review[\s\S]+review\.user_id is null/i);
  assert.match(verifiedReviewsMigration, /char_length\(v_comment\) not between 10 and 1000/i);
  assert.match(verifiedReviewsMigration, /REVIEW_LINK_NOT_ALLOWED/i);
  assert.match(verifiedReviewsMigration, /interval '60 seconds'/i);
  assert.match(verifiedReviewsMigration, /create table if not exists public\.review_write_limits/i);
  assert.match(verifiedReviewsMigration, /create or replace function public\.delete_verified_review/i);
  assert.match(verifiedReviewsMigration, /where review\.id = p_review_id and review\.user_id = v_user_id/i);
});

test('đơn mới bắt buộc lưu lịch giao và lắp đặt hợp lệ', () => {
  assert.match(installationMigration, /add column if not exists installation_date date/i);
  assert.match(installationMigration, /add column if not exists installation_time_slot text/i);
  assert.match(installationMigration, /p_installation_date date/i);
  assert.match(installationMigration, /p_installation_date < v_today \+ 1/i);
  assert.match(installationMigration, /p_installation_time_slot not in \('08:00-12:00', '13:00-17:00'\)/i);
  assert.match(installationMigration, /drop function if exists public\.place_order\(text, text, text, text\)/i);
  assert.match(installationMigration, /installation_date, installation_time_slot, installation_note/i);
  assert.match(installationMigration, /grant execute on function public\.place_order\(text, text, text, text, date, text, text\) to authenticated/i);
});

test('mua lại chỉ nhận đơn đã giao, kiểm tra dữ liệu hiện tại và gộp giỏ phía server', () => {
  assert.match(reorderMigration, /create or replace function public\.reorder_delivered_order/i);
  assert.match(reorderMigration, /customer_order\.user_id = v_user_id/i);
  assert.match(reorderMigration, /v_order_status <> 'delivered'/i);
  assert.match(reorderMigration, /v_item\.selected_color <> all\(v_product\.colors\)/i);
  assert.match(reorderMigration, /v_target_quantity := least\(v_product\.stock, v_existing_quantity \+ v_item\.quantity\)/i);
  assert.match(reorderMigration, /on conflict \(user_id, product_id, selected_color\)[\s\S]+do update set quantity = excluded\.quantity/i);
  assert.match(reorderMigration, /'addedQuantity', v_added_quantity/i);
  assert.match(reorderMigration, /'issues', v_issues/i);
  assert.match(reorderMigration, /grant execute on function public\.reorder_delivered_order\(uuid\) to authenticated/i);
});
