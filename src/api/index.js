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
  // Tồn kho từng màu: { 'Kem': 3, 'Xám tro': 5 }; rỗng nếu database chưa có bảng product_color_stock
  colorStock: Object.fromEntries((row.product_color_stock || []).map((item) => [item.color, Number(item.stock)])),
  warrantyMonths: Number(row.warranty_months ?? 24),
  costPrice: Number(row.cost_price || 0),
  // Database chưa có giá sỉ thì để 0 để app không hứa giảm giá
  wholesaleMinQty: Number(row.wholesale_min_qty ?? 3),
  wholesalePercent: Number(row.wholesale_percent ?? 0),
});

const reviewFromRow = (row) => ({
  id: String(row.id),
  productId: String(row.product_id),
  userId: row.user_id ? String(row.user_id) : null,
  userName: row.user_name,
  rating: Number(row.rating),
  comment: row.comment,
  createdAt: row.created_at,
  verifiedPurchase: Boolean(row.verified_purchase),
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

const reorderFromData = (data) => ({
  addedLines: Number(data?.addedLines || 0),
  addedQuantity: Number(data?.addedQuantity || 0),
  issues: (data?.issues || []).map((issue) => ({
    productId: String(issue.productId),
    name: issue.name,
    reason: issue.reason,
    requestedQuantity: Number(issue.requestedQuantity || 0),
    addedQuantity: Number(issue.addedQuantity || 0),
  })),
  cart: (data?.cart || []).map((item) => ({
    productId: String(item.productId),
    selectedColor: item.selectedColor,
    quantity: Number(item.quantity),
  })),
});

const orderFromRow = (row) => {
  const cancellationRow = Array.isArray(row.order_cancellation_requests)
    ? row.order_cancellation_requests[0]
    : row.order_cancellation_requests;
  return ({
  id: String(row.id),
  code: row.code,
  userId: String(row.user_id),
  items: (row.order_items || []).map((item) => ({
    id: String(item.id),
    productId: String(item.product_id),
    name: item.product_name,
    brand: item.brand,
    category: item.category,
    uri: item.image_url,
    selectedColor: item.selected_color,
    originalPrice: Number(item.original_price),
    unitPrice: Number(item.unit_price),
    quantity: Number(item.quantity),
    warrantyMonths: Number(item.warranty_months ?? 24),
    isGift: Boolean(item.is_gift),
  })),
  shipping: {
    name: row.shipping_name,
    phone: row.shipping_phone,
    address: row.shipping_address,
  },
  installation: row.installation_date ? {
    date: row.installation_date,
    timeSlot: row.installation_time_slot,
    note: row.installation_note || '',
  } : null,
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  status: row.status,
  statusHistory: (row.order_status_history || [])
    .map((item) => ({ status: item.status, at: item.changed_at }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at))),
  subtotal: Number(row.subtotal),
  discount: Number(row.discount),
  shippingFee: Number(row.shipping_fee),
  deliveryZone: row.delivery_zone || null,
  depositAmount: Number(row.deposit_amount || 0),
  depositStatus: row.deposit_status || 'not_required',
  total: Number(row.total),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  cancellationRequest: cancellationFromRow(cancellationRow),
  assignedStaff: row.assigned_staff_id ? {
    id: String(row.assigned_staff_id),
    name: row.assigned_staff_name || 'Nhân viên',
    phone: row.assigned_staff_phone || '',
  } : null,
  redelivery: row.redelivery_date ? { date: row.redelivery_date, timeSlot: row.redelivery_time_slot } : null,
  cashCollected: row.cash_collected == null ? null : Number(row.cash_collected),
  cashCollectedAt: row.cash_collected_at || null,
  incidents: (row.delivery_incidents || [])
    .map((incident) => ({
      id: String(incident.id),
      kind: incident.kind,
      note: incident.note,
      photoCount: Number(incident.photo_count || 0),
      reportedBy: incident.reported_by_name || '',
      reportedAt: incident.reported_at,
      lossCost: Number(incident.loss_cost || 0),
      resolvedAt: incident.resolved_at,
    }))
    .sort((a, b) => String(a.reportedAt).localeCompare(String(b.reportedAt))),
  });
};

const collectionFromRow = (row) => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  room: row.room,
  description: row.description || '',
  productIds: (row.collection_products || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => String(item.product_id)),
});

const supportFromRow = (row) => ({
  id: String(row.id),
  orderId: String(row.order_id),
  orderItemId: String(row.order_item_id),
  orderCode: row.orders?.code || '',
  customer: row.orders ? { name: row.orders.shipping_name, phone: row.orders.shipping_phone, address: row.orders.shipping_address } : null,
  item: row.order_items ? {
    name: row.order_items.product_name,
    category: row.order_items.category,
    uri: row.order_items.image_url,
    selectedColor: row.order_items.selected_color,
    isGift: Boolean(row.order_items.is_gift),
  } : null,
  quantity: Number(row.quantity),
  description: row.description,
  photoCount: Number(row.photo_count || 0),
  earlyReport: Boolean(row.early_report),
  status: row.status,
  staff: row.assigned_staff_id ? { id: String(row.assigned_staff_id), name: row.assigned_staff_name || 'Nhân viên', phone: row.assigned_staff_phone || '' } : null,
  visit: row.visit_date ? { date: row.visit_date, timeSlot: row.visit_time_slot } : null,
  assessment: row.staff_assessment || null,
  staffNote: row.staff_note || '',
  staffPhotoCount: Number(row.staff_photo_count || 0),
  conclusion: row.conclusion || null,
  resolution: row.resolution || null,
  cost: Number(row.cost || 0),
  adminNote: row.admin_note || '',
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
});

const SUPPORT_SELECT = '*, orders(code, shipping_name, shipping_phone, shipping_address), order_items(product_name, category, image_url, selected_color, is_gift)';

// Đơn hàng kèm sự cố giao hàng; database chưa có bảng delivery_incidents thì đọc như cũ
const ORDER_SELECT_BASE = `
  *,
  order_items (*),
  order_status_history (*),
  order_cancellation_requests (*)
`;
const ORDER_SELECT = `${ORDER_SELECT_BASE}, delivery_incidents (*)`;

const fetchOrders = async (build) => {
  const result = await build(supabase.from('orders').select(ORDER_SELECT));
  if (!result.error) return result.data;
  return unwrap(await build(supabase.from('orders').select(ORDER_SELECT_BASE)));
};
const fetchOrder = async (orderId) => orderFromRow(await fetchOrders((query) => query.eq('id', orderId).single()));

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
    const withColors = await supabase.from('products').select('*, product_color_stock(color, stock)').order('id');
    // Database chưa chạy migration tồn kho theo màu thì vẫn tải được sản phẩm như cũ
    const rows = withColors.error ? unwrap(await supabase.from('products').select('*').order('id')) : withColors.data;
    return rows.map(productFromRow);
  },
  promotions: {
    // Database chưa có bảng gift_rules thì không có quà
    giftRules: async () => {
      const { data, error } = await supabase.from('gift_rules').select('*').eq('active', true).order('min_total');
      return error ? [] : data.map((row) => ({
        id: String(row.id),
        minTotal: Number(row.min_total),
        productId: String(row.product_id),
        quantity: Number(row.quantity),
      }));
    },
  },
  collections: {
    // Database chưa chạy migration bộ sưu tập thì trả về danh sách rỗng
    list: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*, collection_products(product_id, sort_order)')
        .order('sort_order');
      return error ? [] : data.map(collectionFromRow);
    },
  },
  admin: {
    dashboard: async (days) => unwrap(await supabase.rpc('admin_dashboard', { p_days: days })),
    // Admin đọc được mọi đơn nhờ chính sách RLS "admins read all orders"
    listOrders: async () => {
      const rows = await fetchOrders((query) => query.order('created_at', { ascending: false }).limit(100));
      return rows.map(orderFromRow);
    },
    getOrder: fetchOrder,
    updateStatus: async (orderId, status) => unwrap(await supabase.rpc('admin_update_order_status', { p_order_id: orderId, p_status: status })),
    markDepositPaid: async (orderId) => unwrap(await supabase.rpc('admin_mark_deposit_paid', { p_order_id: orderId })),
    reviewCancellation: async (orderId, approve, note) => unwrap(await supabase.rpc('admin_review_cancellation', {
      p_order_id: orderId, p_approve: approve, p_note: note || '',
    })),
    listStaff: async () => (unwrap(await supabase.rpc('admin_list_staff')) || []).map((staff) => ({
      id: String(staff.id), name: staff.name, phone: staff.phone || '',
    })),
    assignStaff: async (orderId, staffId) => unwrap(await supabase.rpc('admin_assign_staff', { p_order_id: orderId, p_staff_id: staffId })),
    scheduleRedelivery: async (orderId, { date, timeSlot, staffId, lossCost }) => unwrap(await supabase.rpc('admin_schedule_redelivery', {
      p_order_id: orderId, p_date: date, p_time_slot: timeSlot, p_staff_id: staffId || null, p_loss_cost: lossCost || 0,
    })),
    listSupport: async () => unwrap(await supabase.from('support_requests').select(SUPPORT_SELECT).order('created_at', { ascending: false }).limit(100)).map(supportFromRow),
    scheduleSupport: async (requestId, { staffId, date, timeSlot }) => unwrap(await supabase.rpc('admin_schedule_support', {
      p_request_id: requestId, p_staff_id: staffId, p_date: date, p_time_slot: timeSlot,
    })),
    resolveSupport: async (requestId, { conclusion, resolution, cost, note }) => unwrap(await supabase.rpc('admin_resolve_support', {
      p_request_id: requestId, p_conclusion: conclusion, p_resolution: resolution || null,
      p_cost: cost === '' || cost == null ? null : Number(cost), p_note: note || '',
    })),
  },
  // Nhân viên giao hàng (admin cũng gọi được các hàm giao hàng)
  staff: {
    myOrders: async (userId) => (await fetchOrders((query) => query
      .eq('assigned_staff_id', userId)
      .in('status', ['preparing', 'shipping', 'installing', 'delivery_issue'])
      .order('installation_date', { ascending: true }))).map(orderFromRow),
    myVisits: async (userId) => unwrap(await supabase.from('support_requests').select(SUPPORT_SELECT)
      .eq('assigned_staff_id', userId).in('status', ['scheduled', 'in_progress']).order('visit_date', { ascending: true })).map(supportFromRow),
    updateStatus: async (orderId, status) => unwrap(await supabase.rpc('staff_update_order_status', { p_order_id: orderId, p_status: status })),
    reportIncident: async (orderId, { kind, note, photoCount }) => unwrap(await supabase.rpc('staff_report_incident', {
      p_order_id: orderId, p_kind: kind, p_note: note, p_photo_count: photoCount || 0,
    })),
    completeDelivery: async (orderId, cash) => unwrap(await supabase.rpc('staff_complete_delivery', { p_order_id: orderId, p_cash_collected: cash })),
    submitAssessment: async (requestId, { assessment, note, photoCount }) => unwrap(await supabase.rpc('staff_submit_assessment', {
      p_request_id: requestId, p_assessment: assessment, p_note: note, p_photo_count: photoCount || 0,
    })),
  },
  // Khách: báo lỗi / bảo hành
  support: {
    mine: async (userId) => {
      const { data, error } = await supabase.from('support_requests').select(SUPPORT_SELECT).eq('customer_id', userId).order('created_at', { ascending: false });
      return error ? [] : data.map(supportFromRow);
    },
    get: async (requestId) => supportFromRow(unwrap(await supabase.from('support_requests').select(SUPPORT_SELECT).eq('id', requestId).single())),
    create: async ({ orderItemId, quantity, description, photoCount }) => unwrap(await supabase.rpc('create_support_request', {
      p_order_item_id: orderItemId, p_quantity: quantity, p_description: description, p_photo_count: photoCount || 0,
    })),
    cancel: async (requestId) => unwrap(await supabase.rpc('cancel_support_request', { p_request_id: requestId })),
  },
  account: {
    // 'admin' | 'staff' | 'customer'; database cũ chưa có my_role thì chỉ phân biệt admin
    role: async () => {
      const result = await supabase.rpc('my_role');
      if (!result.error && result.data) return result.data;
      const admin = await supabase.rpc('is_admin');
      return !admin.error && admin.data === true ? 'admin' : 'customer';
    },
    get: async (authUser) => {
      const [profile, cart, favorites] = await Promise.all([
        unwrap(await supabase.from('profiles').select('*').eq('id', authUser.id).single()),
        unwrap(await supabase.from('cart_items').select('*').eq('user_id', authUser.id).order('created_at')),
        unwrap(await supabase.from('favorites').select('product_id').eq('user_id', authUser.id).order('created_at', { ascending: false })),
      ]);
      const role = await api.account.role();
      return {
        id: authUser.id,
        email: authUser.email,
        role,
        isAdmin: role === 'admin',
        isStaff: role === 'staff',
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
    canReview: async (productId) => Boolean(unwrap(await supabase.rpc('can_review_product', {
      p_product_id: Number(productId),
    }))),
    save: async ({ productId, rating, comment }) => {
      const reviewId = unwrap(await supabase.rpc('save_verified_review', {
        p_product_id: Number(productId),
        p_rating: Number(rating),
        p_comment: comment,
      }));
      const row = unwrap(await supabase.from('reviews').select('*').eq('id', reviewId).single());
      return reviewFromRow(row);
    },
    remove: async (id) => unwrap(await supabase.rpc('delete_verified_review', { p_review_id: id })),
  },
  orders: {
    byUser: async (userId) => {
      const rows = await fetchOrders((query) => query.eq('user_id', userId).order('created_at', { ascending: false }));
      return rows.map(orderFromRow);
    },
    place: async ({ shipping, paymentMethod, installation, deliveryZone }) => {
      const orderId = unwrap(await supabase.rpc('place_order', {
        p_shipping_name: shipping.name,
        p_shipping_phone: shipping.phone,
        p_shipping_address: shipping.address,
        p_payment_method: paymentMethod,
        p_installation_date: installation.date,
        p_installation_time_slot: installation.timeSlot,
        p_installation_note: installation.note || '',
        p_delivery_zone: deliveryZone,
      }));
      return fetchOrder(orderId);
    },
    // Mua ngay: đặt đúng 1 sản phẩm, không dùng giỏ hàng
    placeBuyNow: async ({ item, shipping, paymentMethod, installation, deliveryZone }) => {
      const orderId = unwrap(await supabase.rpc('place_buy_now_order', {
        p_product_id: Number(item.productId),
        p_selected_color: item.selectedColor || '',
        p_quantity: item.quantity,
        p_shipping_name: shipping.name,
        p_shipping_phone: shipping.phone,
        p_shipping_address: shipping.address,
        p_payment_method: paymentMethod,
        p_installation_date: installation.date,
        p_installation_time_slot: installation.timeSlot,
        p_installation_note: installation.note || '',
        p_delivery_zone: deliveryZone,
      }));
      return fetchOrder(orderId);
    },
    requestCancellation: async ({ orderId, reasonCode, reasonDetail }) => {
      unwrap(await supabase.rpc('request_order_cancellation', {
        p_order_id: orderId,
        p_reason_code: reasonCode,
        p_reason_detail: reasonDetail || '',
      }));
      return fetchOrder(orderId);
    },
    reorder: async (orderId) => reorderFromData(unwrap(await supabase.rpc('reorder_delivered_order', {
      p_order_id: orderId,
    }))),
  },
};
