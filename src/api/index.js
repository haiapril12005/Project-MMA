import { client } from './client';

export const api = {
  products: () => client.list('products'),
  updateProduct: (id, p) => client.update('products', id, p),
  users: {
    list: () => client.list('users'),
    create: (u) => client.create('users', u),
    update: (id, u) => client.update('users', id, u),
  },
  reviews: {
    byProduct: async (productId) => (await client.list('reviews')).filter((r) => String(r.productId) === String(productId)),
    create: (r) => client.create('reviews', r),
    update: (id, r) => client.update('reviews', id, r),
    remove: (id) => client.remove('reviews', id),
  },
  orders: {
    byUser: async (userId) => (await client.list('orders')).filter((o) => String(o.userId) === String(userId)),
    create: (o) => client.create('orders', o),
    update: (id, o) => client.update('orders', id, o),
  },
};