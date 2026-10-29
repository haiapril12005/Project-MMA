const seed = require('../src/data/seed.js'); // chỉnh đường dẫn cho đúng
const BASE_URL = 'https://67dff3547635238f9aabf4f9.mockapi.io';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return []; // collection rỗng
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json();
}

async function clearAll(resource) {
  const old = await call('GET', `/${resource}`);
  for (const o of old) {
    await call('DELETE', `/${resource}/${o.id}`);
    await sleep(250);
  }
  console.log(`Đã xóa ${old.length} bản ghi mẫu của ${resource}`);
}

(async () => {
  await clearAll('products');
  await clearAll('users');

  for (const { id: _oldId, reviews, ...rest } of seed.products) {
    const created = await call('POST', '/products', { ...rest, reviews: [] });
    const fixedReviews = reviews.map((r, k) => ({
      ...r,
      id: `r${created.id}-${k}`,
      productId: String(created.id),
    }));
    await call('PUT', `/products/${created.id}`, { reviews: fixedReviews });
    console.log('product', created.id, created.name);
    await sleep(250);
  }

  for (const { id: _oldId, ...rest } of seed.users) {
    const created = await call('POST', '/users', rest);
    console.log('user', created.id, created.email);
    await sleep(250);
  }
  console.log('Xong!');
})();