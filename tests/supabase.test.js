const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seed = require('../src/data/seed');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202610290001_initial_schema.sql'), 'utf8');
const cancellationMigration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202610300001_order_cancellations.sql'), 'utf8');
const sqlSeed = fs.readFileSync(path.join(root, 'supabase', 'seed.sql'), 'utf8');

test('seed chỉ chứa catalog và đánh giá mẫu, không chứa tài khoản hoặc đơn giả', () => {
  assert.deepEqual(Object.keys(seed).sort(), ['products', 'reviews']);
  assert.equal(seed.products.length, 40);
  assert.equal(seed.reviews.length, 160);
});

test('sản phẩm và đánh giá mẫu tham chiếu hợp lệ', () => {
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
  seed.reviews.forEach((review) => {
    assert.ok(productIds.has(review.productId));
    assert.ok(review.rating >= 1 && review.rating <= 5);
    assert.ok(review.comment);
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

test('SQL seed không chèn tài khoản hoặc đơn hàng mẫu', () => {
  assert.match(sqlSeed, /insert into public\.products/i);
  assert.match(sqlSeed, /insert into public\.reviews/i);
  assert.doesNotMatch(sqlSeed, /insert into (auth\.users|public\.orders|public\.profiles)/i);
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

test('mua ngay đặt đúng 1 sản phẩm qua hàm phía server và không đụng tới giỏ hàng', () => {
  const buyNow = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611010001_buy_now.sql'), 'utf8');
  assert.match(buyNow, /create or replace function public\.place_buy_now_order/i);
  assert.match(buyNow, /security definer/i);
  assert.match(buyNow, /p_quantity > v_product\.stock/i);
  assert.match(buyNow, /PRODUCT_COLOR_INVALID/);
  assert.doesNotMatch(buyNow, /cart_items/i);
  assert.match(buyNow, /revoke all on function public\.place_buy_now_order/i);
});

test('đặt hàng trừ tồn kho có khóa dòng và hủy đơn thì hoàn kho đúng một lần', () => {
  const stock = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611010002_stock_on_order.sql'), 'utf8');
  assert.match(stock, /add column if not exists stock_deducted/i);
  assert.match(stock, /create or replace function public\.place_order/i);
  assert.match(stock, /create or replace function public\.place_buy_now_order/i);
  assert.match(stock, /order by id\s+for update;/i);
  assert.match(stock, /where id = p_product_id for update;/i);
  assert.match(stock, /set stock = product\.stock - cart\.qty/i);
  assert.match(stock, /set stock = stock - p_quantity/i);
  assert.match(stock, /sum\(quantity\) as qty/i);
  assert.match(stock, /new\.status = 'cancelled' and old\.status <> 'cancelled' and old\.stock_deducted/i);
  assert.match(stock, /new\.stock_deducted := false/i);
  assert.match(stock, /delete from public\.cart_items where user_id = v_user_id/i);
});

test('đơn còn chờ xác nhận được hủy ngay, đơn đã xác nhận vẫn phải chờ cửa hàng duyệt', () => {
  const instant = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611020001_instant_cancel.sql'), 'utf8');
  assert.match(instant, /create or replace function public\.request_order_cancellation/i);
  assert.match(instant, /security definer/i);
  assert.match(instant, /where id = p_order_id\s+for update/i);
  assert.match(instant, /if v_order_status = 'pending_confirmation' then\s+update public\.order_cancellation_requests\s+set status = 'approved'/i);
  assert.match(instant, /v_order_status not in \('pending_confirmation', 'confirmed'\)/i);
  assert.match(instant, /revoke all on function public\.request_order_cancellation/i);
  assert.doesNotMatch(instant, /update public\.orders/i);
});
