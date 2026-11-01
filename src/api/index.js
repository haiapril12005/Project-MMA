import { supabase } from '../lib/supabase';

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const productFromRow = (row) => ({
  id: String(row.id),
  name: row.name,
  price: Number(row.price),
  category: row.category,
  brand: row.brand,
  color: row.colors || [],
  material: row.material,
  dimensions: row.dimensions,
  description: row.description,
  uri: row.image_url,
  percentOff: Number(row.percent_off || 0),
  stock: Number(row.stock ?? 0),
});

const reviewFromRow = (row) => ({
  id: String(row.id),
  productId: String(row.product_id),
  userId: row.user_id ? String(row.user_id) : null,
  userName: row.user_name,
  rating: Number(row.rating),
  comment: row.comment,
  createdAt: row.created_at,
});

const cancellationFromRow = (row) => (row ? {
  id: String(row.id),
  orderId: String(row.order_id),
  requestedBy: String(row.requested_by),
  reasonCode: row.reason_code,
  reasonDetail: row.reason_detail || '',
  status: row.status,
  storeNote: row.store_note || '',
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
  updatedAt: row.updated_at,
} : null);

const orderFromRow = (row) => {
  const cancellationRow = Array.isArray(row.order_cancellation_requests)
    ? row.order_cancellation_requests[0]
    : row.order_cancellation_requests;
  return ({
  id: String(row.id),
  code: row.code,
  userId: String(row.user_id),
  items: (row.order_items || []).map((item) => ({
    productId: String(item.product_id),
    name: item.product_name,
    brand: item.brand,
    category: item.category,
    uri: item.image_url,
    selectedColor: item.selected_color,
    originalPrice: Number(item.original_price),
    unitPrice: Number(item.unit_price),
    quantity: Number(item.quantity),
  })),
  shipping: {
    name: row.shipping_name,
    phone: row.shipping_phone,
    address: row.shipping_address,
  },
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  status: row.status,
  statusHistory: (row.order_status_history || [])
    .map((item) => ({ status: item.status, at: item.changed_at }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at))),
  subtotal: Number(row.subtotal),
  discount: Number(row.discount),
  shippingFee: Number(row.shipping_fee),
  total: Number(row.total),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  cancellationRequest: cancellationFromRow(cancellationRow),
  });
};

const reviewPayload = (review) => ({
  product_id: Number(review.productId),
  user_id: review.userId,
  user_name: review.userName,
  rating: Number(review.rating),
  comment: review.comment,
});

const orderSelect = `
  *,
  order_items (*),
  order_status_history (*),
  order_cancellation_requests (*)
`;

export const api = {
  auth: {
    getSession: async () => unwrap(await supabase.auth.getSession()),
    onChange: (callback) => supabase.auth.onAuthStateChange(callback),
    login: async (email, password) => unwrap(await supabase.auth.signInWithPassword({ email, password })),
    register: async ({ name, email, password }) => unwrap(await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    })),
    resendConfirmation: async (email) => unwrap(await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    })),
    logout: async () => unwrap(await supabase.auth.signOut()),
    changePassword: async ({ email, oldPassword, newPassword }) => {
      unwrap(await supabase.auth.signInWithPassword({ email, password: oldPassword }));
      return unwrap(await supabase.auth.updateUser({ password: newPassword }));
    },
  },
  products: async () => {
    const rows = unwrap(await supabase.from('products').select('*').order('id'));
    return rows.map(productFromRow);
  },
  account: {
    get: async (authUser) => {
      const [profile, cart, favorites] = await Promise.all([
        unwrap(await supabase.from('profiles').select('*').eq('id', authUser.id).single()),
        unwrap(await supabase.from('cart_items').select('*').eq('user_id', authUser.id).order('created_at')),
        unwrap(await supabase.from('favorites').select('product_id').eq('user_id', authUser.id).order('created_at', { ascending: false })),
      ]);
      return {
        id: authUser.id,
        email: authUser.email,
        name: profile.name,
        phone: profile.phone || '',
        address: profile.address || '',
        cart: cart.map((item) => ({
          productId: String(item.product_id),
          selectedColor: item.selected_color,
          quantity: Number(item.quantity),
        })),
        favorites: favorites.map((item) => String(item.product_id)),
      };
    },
    updateProfile: async (id, patch) => unwrap(await supabase
      .from('profiles')
      .update({ name: patch.name, phone: patch.phone, address: patch.address })
      .eq('id', id)
      .select()
      .single()),
  },
  cart: {
    add: async ({ userId, productId, selectedColor, quantity }) => unwrap(await supabase
      .from('cart_items')
      .upsert({
        user_id: userId,
        product_id: Number(productId),
        selected_color: selectedColor,
        quantity,
      }, { onConflict: 'user_id,product_id,selected_color' })
      .select()
      .single()),
    setQty: async ({ userId, productId, selectedColor, quantity }) => unwrap(await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('user_id', userId)
      .eq('product_id', Number(productId))
      .eq('selected_color', selectedColor)
      .select()
      .single()),
    remove: async ({ userId, productId, selectedColor }) => unwrap(await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', Number(productId))
      .eq('selected_color', selectedColor)),
    clear: async (userId) => unwrap(await supabase.from('cart_items').delete().eq('user_id', userId)),
  },
  favorites: {
    add: async (userId, productId) => unwrap(await supabase.from('favorites').insert({ user_id: userId, product_id: Number(productId) })),
    remove: async (userId, productId) => unwrap(await supabase.from('favorites').delete().eq('user_id', userId).eq('product_id', Number(productId))),
    clear: async (userId) => unwrap(await supabase.from('favorites').delete().eq('user_id', userId)),
  },
  reviews: {
    byProduct: async (productId) => {
      const rows = unwrap(await supabase.from('reviews').select('*').eq('product_id', Number(productId)).order('created_at', { ascending: false }));
      return rows.map(reviewFromRow);
    },
    create: async (review) => reviewFromRow(unwrap(await supabase.from('reviews').insert(reviewPayload(review)).select().single())),
    update: async (id, review) => reviewFromRow(unwrap(await supabase.from('reviews').update(reviewPayload(review)).eq('id', id).select().single())),
    remove: async (id) => unwrap(await supabase.from('reviews').delete().eq('id', id)),
  },
  orders: {
    byUser: async (userId) => {
      const rows = unwrap(await supabase.from('orders').select(orderSelect).eq('user_id', userId).order('created_at', { ascending: false }));
      return rows.map(orderFromRow);
    },
    place: async ({ shipping, paymentMethod }) => {
      const orderId = unwrap(await supabase.rpc('place_order', {
        p_shipping_name: shipping.name,
        p_shipping_phone: shipping.phone,
        p_shipping_address: shipping.address,
        p_payment_method: paymentMethod,
      }));
      const row = unwrap(await supabase.from('orders').select(orderSelect).eq('id', orderId).single());
      return orderFromRow(row);
    },
    requestCancellation: async ({ orderId, reasonCode, reasonDetail }) => {
      unwrap(await supabase.rpc('request_order_cancellation', {
        p_order_id: orderId,
        p_reason_code: reasonCode,
        p_reason_detail: reasonDetail || '',
      }));
      const row = unwrap(await supabase.from('orders').select(orderSelect).eq('id', orderId).single());
      return orderFromRow(row);
    },
  },
};
