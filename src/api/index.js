import { client } from './client';

export const api = {
  products: () => client.list('products'),
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
};
