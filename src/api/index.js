import { client } from './client';

// ---- helper: reviews nằm trong product ----
const productIdOfReview = (id) => String(id).split('-')[0].slice(1); // "r12-3" -> "12"

async function mutateReviews(productId, fn) {
  const p = await client.get('products', productId);
  const next = fn(p.reviews || []);
  await client.update('products', productId, { reviews: next });
}

// ---- helper: orders nằm trong user ----
async function findUserByOrder(orderId) {
  const users = await client.list('users');
  return users.find((u) => (u.orders || []).some((o) => String(o.id) === String(orderId)));
}

export const api = {
  products: () => client.list('products'),
  updateProduct: (id, p) => client.update('products', id, p), // chỉ gửi field cần đổi (vd: stock)

  users: {
    list: () => client.list('users'),
    create: (u) => client.create('users', { cart: [], orders: [], ...u }),
    update: (id, u) => client.update('users', id, u), // KHÔNG gửi kèm orders cũ
  },

  reviews: {
    byProduct: async (productId) => {
      const p = await client.get('products', productId);
      return p?.reviews || [];
    },
    create: async (r) => {
      const productId = String(r.productId);
      const review = {
        ...r,
        id: `r${productId}-${Date.now()}`,
        productId,
        createdAt: r.createdAt || new Date().toISOString(),
      };
      await mutateReviews(productId, (list) => [...list, review]);
      return review;
    },
    update: async (id, patch) => {
      const productId = String(patch.productId || productIdOfReview(id));
      let out;
      await mutateReviews(productId, (list) =>
        list.map((x) => (x.id === id ? (out = { ...x, ...patch, id: x.id }) : x)));
      return out;
    },
    remove: async (id) => {
      const productId = productIdOfReview(id);
      await mutateReviews(productId, (list) => list.filter((x) => x.id !== id));
      return {};
    },
  },

  orders: {
    byUser: async (userId) => {
      const u = await client.get('users', userId);
      return u?.orders || [];
    },
    create: async (o) => {
      const user = await client.get('users', o.userId);
      const order = { ...o, id: `o${Date.now()}`, createdAt: o.createdAt || new Date().toISOString() };
      await client.update('users', user.id, { orders: [...(user.orders || []), order] });
      return order;
    },
    update: async (id, patch) => {
      const user = patch.userId
        ? await client.get('users', patch.userId)
        : await findUserByOrder(id);
      let out;
      const orders = (user.orders || []).map((x) =>
        String(x.id) === String(id) ? (out = { ...x, ...patch, id: x.id }) : x);
      await client.update('users', user.id, { orders });
      return out;
    },
  },
};