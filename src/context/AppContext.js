import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { colorStockOf, ORDER_STATUS } from '../utils';

const Ctx = createContext(null);

const MIGRATION_MISSING = 'Database chưa cập nhật nghiệp vụ mới. Hãy chạy file supabase/migrations/202611030001_furniture_flows.sql trong Supabase SQL Editor.';

// Mã lỗi database khi đặt hàng -> câu báo cho khách
const ORDER_ERRORS = [
  ['DELIVERY_ZONE_INVALID', 'Chọn khu vực giao hàng để tính phí giao và lắp đặt.'],
  ['COLOR_STOCK_INVALID', 'Màu bạn chọn không còn đủ hàng. Hãy giảm số lượng hoặc chọn màu khác.'],
  ['CART_QUANTITY_INVALID', 'Số lượng vượt quá hàng còn trong kho. Hãy giảm số lượng rồi thử lại.'],
  ['CART_EMPTY', 'Giỏ hàng đang trống.'],
  ['PRODUCT_NOT_FOUND', 'Sản phẩm này đã ngừng bán.'],
  ['PRODUCT_COLOR_INVALID', 'Màu đã chọn không còn bán, hãy chọn màu khác.'],
  ['SHIPPING_PHONE_INVALID', 'Số điện thoại cần từ 9 đến 11 chữ số.'],
  ['SHIPPING_ADDRESS_INVALID', 'Địa chỉ giao hàng cần ít nhất 10 ký tự.'],
  ['INSTALLATION_DATE_INVALID', 'Ngày lắp đặt phải bắt đầu từ ngày kế tiếp.'],
  ['INSTALLATION_TIME_SLOT_INVALID', 'Khung giờ lắp đặt không hợp lệ. Vui lòng chọn lại.'],
  ['AUTH_REQUIRED', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'],
  ['JWT', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'],
];

const orderErrorMessage = (e, fallback) => {
  const message = String(e?.message || '');
  if (e?.code === 'PGRST202' || message.includes('Could not find the function')) return MIGRATION_MISSING;
  return ORDER_ERRORS.find(([code]) => message.includes(code))?.[1] || fallback;
};

export const useApp = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp phải được dùng bên trong <AppProvider>');
  return ctx;
};

export function AppProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUserState] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);
  const userRef = useRef(null);

  const setUser = useCallback((next) => {
    userRef.current = next;
    setUserState(next);
  }, []);
  const notify = useCallback((text) => setToast({ id: Date.now(), text }), []);

  const clearAccount = useCallback(() => {
    setUser(null);
    setFavorites([]);
    setOrders([]);
    setOrderError(null);
  }, [setUser]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await api.products());
    } catch (e) {
      setError('Không tải được sản phẩm từ Supabase. Hãy kiểm tra kết nối và migration database.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Tải lại tồn kho sau khi đặt hàng, không hiện màn chờ; lỗi thì giữ số cũ
  const refreshProductsSilently = useCallback(async () => {
    try {
      setProducts(await api.products());
    } catch (e) { /* giữ dữ liệu cũ */ }
  }, []);

  const loadOrders = useCallback(async (userId = userRef.current?.id) => {
    if (!userId) {
      setOrders([]);
      return true;
    }
    setOrdersLoading(true);
    setOrderError(null);
    try {
      setOrders(await api.orders.byUser(userId));
      return true;
    } catch (e) {
      setOrderError('Không tải được đơn hàng. Vui lòng thử lại.');
      return false;
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadAccount = useCallback(async (authUser) => {
    const account = await api.account.get(authUser);
    const { favorites: nextFavorites, ...nextUser } = account;
    setUser(nextUser);
    setFavorites(nextFavorites);
    await loadOrders(nextUser.id);
    return nextUser;
  }, [loadOrders, setUser]);

  useEffect(() => {
    let active = true;
    loadProducts();

    const restoreSession = async () => {
      try {
        const { session } = await api.auth.getSession();
        if (active && session?.user) await loadAccount(session.user);
      } catch (e) {
        if (active) clearAccount();
      } finally {
        if (active) setReady(true);
      }
    };
    restoreSession();

    const { data: authListener } = api.auth.onChange((event, session) => {
      if (!active || event === 'INITIAL_SESSION') return;
      if (!session?.user) {
        clearAccount();
        return;
      }
      // Supabase yêu cầu callback Auth kết thúc nhanh; truy vấn account chạy ở lượt event kế tiếp.
      setTimeout(() => {
        if (!active) return;
        loadAccount(session.user).catch(() => clearAccount());
      }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [clearAccount, loadAccount, loadProducts]);

  // ---------- Đăng nhập và hồ sơ ----------
  const login = async (email, password) => {
    try {
      const { user: authUser } = await api.auth.login(email.trim(), password);
      await loadAccount(authUser);
    } catch (e) {
      const error = new Error(
        e.code === 'email_not_confirmed'
          ? 'Tài khoản chưa xác nhận email. Hãy mở email Supabase đã gửi rồi bấm liên kết xác nhận.'
          : 'Email hoặc mật khẩu không đúng.',
      );
      error.code = e.code || 'login_failed';
      throw error;
    }
  };

  const register = async ({ name, email, password }) => {
    try {
      const { user: authUser, session } = await api.auth.register({ name, email: email.trim(), password });
      if (session?.user) await loadAccount(session.user);
      return { needsEmailConfirmation: Boolean(authUser && !session) };
    } catch (e) {
      if (String(e.message).toLowerCase().includes('already')) throw new Error('Email này đã được đăng ký.');
      throw new Error('Không tạo được tài khoản. Vui lòng kiểm tra email và thử lại.');
    }
  };

  const logout = async () => {
    await api.auth.logout();
    clearAccount();
  };

  const resendConfirmation = async (email) => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Nhập email hợp lệ để gửi lại xác nhận.');
    try {
      await api.auth.resendConfirmation(email);
      return true;
    } catch (e) {
      if (e.code === 'over_email_send_rate_limit') {
        throw new Error('Bạn đã yêu cầu email quá nhanh. Vui lòng chờ vài phút rồi thử lại.');
      }
      throw new Error('Chưa gửi lại được email xác nhận. Vui lòng thử lại sau.');
    }
  };

  // Kiểm tra lại vai trò (vừa được cấp quyền admin / nhân viên trong Supabase thì không cần đăng nhập lại)
  const refreshRole = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;
    const role = await api.account.role();
    if (userRef.current?.id === current.id && userRef.current.role !== role) {
      setUser({ ...userRef.current, role, isAdmin: role === 'admin', isStaff: role === 'staff' });
    }
  }, [setUser]);

  const updateProfile = async (patch) => {
    const current = userRef.current;
    if (!current) return false;
    try {
      await api.account.updateProfile(current.id, patch);
      setUser({ ...current, ...patch });
      return true;
    } catch (e) {
      notify('Không cập nhật được thông tin. Vui lòng thử lại.');
      return false;
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    const current = userRef.current;
    if (!current) return false;
    try {
      await api.auth.changePassword({ email: current.email, oldPassword, newPassword });
      return true;
    } catch (e) {
      throw new Error('Mật khẩu hiện tại không đúng hoặc phiên đăng nhập đã hết hạn.');
    }
  };

  // ---------- Yêu thích (lưu theo tài khoản Supabase) ----------
  const isFav = (id) => favorites.includes(String(id));

  const toggleFavorite = async (id) => {
    const current = userRef.current;
    if (!current) {
      notify('Đăng nhập để lưu sản phẩm yêu thích');
      return false;
    }
    const productId = String(id);
    const adding = !favorites.includes(productId);
    const previous = favorites;
    const next = adding ? [productId, ...favorites] : favorites.filter((item) => item !== productId);
    setFavorites(next);
    try {
      if (adding) await api.favorites.add(current.id, productId);
      else await api.favorites.remove(current.id, productId);
      notify(adding ? 'Đã lưu vào Yêu thích' : 'Đã bỏ khỏi Yêu thích');
      return true;
    } catch (e) {
      setFavorites(previous);
      notify('Không đồng bộ được danh sách yêu thích. Vui lòng thử lại.');
      return false;
    }
  };

  const clearFavorites = async () => {
    const current = userRef.current;
    if (!current) return false;
    const previous = favorites;
    setFavorites([]);
    try {
      await api.favorites.clear(current.id);
      notify('Đã xóa toàn bộ danh sách yêu thích');
      return true;
    } catch (e) {
      setFavorites(previous);
      notify('Không xóa được danh sách yêu thích. Vui lòng thử lại.');
      return false;
    }
  };

  // ---------- Giỏ hàng (lưu theo tài khoản Supabase) ----------
  const saveCart = async (nextCart, operation, failureText) => {
    const current = userRef.current;
    if (!current) return false;
    const previous = current;
    const next = { ...current, cart: nextCart };
    setUser(next);
    try {
      await operation();
      return true;
    } catch (e) {
      if (userRef.current === next) setUser(previous);
      notify(failureText);
      return false;
    }
  };

  // Có tồn kho theo màu: tối đa = số còn của màu đó (database cũng kiểm tra khi thêm giỏ và đặt hàng).
  // Chưa có dữ liệu theo màu: tối đa = tồn kho chung - số lượng các màu khác đang có trong giỏ
  const maxQtyFor = (id, selectedColor, cart = userRef.current?.cart || []) => {
    const productId = String(id);
    const product = products.find((item) => item.id === productId);
    const color = selectedColor || product?.color?.[0] || '';
    if (product && Object.keys(product.colorStock || {}).length) return Math.max(0, colorStockOf(product, color));
    const otherColors = cart
      .filter((item) => item.productId === productId && item.selectedColor !== color)
      .reduce((sum, item) => sum + item.quantity, 0);
    return Math.max(0, (product?.stock ?? 0) - otherColors);
  };

  const addToCart = async (id, qty = 1, selectedColor = '') => {
    const current = userRef.current;
    const productId = String(id);
    const product = products.find((item) => item.id === productId);
    if (!current || !product) {
      notify(current ? 'Không tìm thấy sản phẩm' : 'Đăng nhập để thêm sản phẩm vào giỏ');
      return false;
    }
    const color = selectedColor || product.color?.[0] || '';
    const stock = maxQtyFor(productId, color, current.cart);
    if (stock <= 0) {
      notify(color ? `Màu ${color} đang tạm hết hàng` : 'Sản phẩm đang tạm hết hàng');
      return false;
    }
    const sameLine = (item) => item.productId === productId && item.selectedColor === color;
    const existing = current.cart.find(sameLine);
    const room = maxQtyFor(productId, color, current.cart);
    const wanted = (existing?.quantity || 0) + Math.max(1, qty);
    const quantity = Math.min(room, wanted);
    if (quantity <= (existing?.quantity || 0)) {
      notify(`Giỏ đã có đủ ${stock} sản phẩm ${color ? `màu ${color} ` : ''}còn trong kho`);
      return false;
    }
    const cart = existing
      ? current.cart.map((item) => (sameLine(item) ? { ...item, quantity } : item))
      : [...current.cart, { productId, selectedColor: color, quantity }];
    const ok = await saveCart(
      cart,
      () => api.cart.add({ userId: current.id, productId, selectedColor: color, quantity }),
      'Không thêm được vào giỏ. Vui lòng thử lại.',
    );
    if (ok) notify(quantity < wanted ? `Đã thêm, giỏ đạt tối đa ${stock} sản phẩm còn trong kho` : 'Đã thêm vào giỏ hàng');
    return ok;
  };

  const setQty = async (id, selectedColor, qty) => {
    const current = userRef.current;
    if (!current) return false;
    const productId = String(id);
    const product = products.find((item) => item.id === productId);
    const color = selectedColor || product?.color?.[0] || '';
    const quantity = Math.max(1, Math.min(maxQtyFor(productId, color, current.cart), qty));
    const cart = current.cart.map((item) => (
      item.productId === productId && item.selectedColor === color ? { ...item, quantity } : item
    ));
    return saveCart(
      cart,
      () => api.cart.setQty({ userId: current.id, productId, selectedColor: color, quantity }),
      'Không cập nhật được số lượng. Vui lòng thử lại.',
    );
  };

  const removeFromCart = async (id, selectedColor = '') => {
    const current = userRef.current;
    if (!current) return false;
    const productId = String(id);
    const product = products.find((item) => item.id === productId);
    const color = selectedColor || product?.color?.[0] || '';
    const cart = current.cart.filter((item) => !(item.productId === productId && item.selectedColor === color));
    return saveCart(
      cart,
      () => api.cart.remove({ userId: current.id, productId, selectedColor: color }),
      'Không xóa được sản phẩm. Vui lòng thử lại.',
    );
  };

  // Thêm nhiều món một lần (ví dụ cả bộ sưu tập): mỗi món 1 cái, màu đầu tiên còn hàng
  const addItemsToCart = async (productIds) => {
    const current = userRef.current;
    if (!current) {
      notify('Đăng nhập để thêm sản phẩm vào giỏ');
      return 0;
    }
    let cart = current.cart;
    const writes = [];
    let skipped = 0;
    productIds.forEach((id) => {
      const productId = String(id);
      const product = products.find((item) => item.id === productId);
      if (!product) return;
      const colorsList = product.color?.length ? product.color : [''];
      const inCart = (c) => cart.find((item) => item.productId === productId && item.selectedColor === c)?.quantity || 0;
      const color = colorsList.find((c) => maxQtyFor(productId, c, cart) > inCart(c)) ?? colorsList[0];
      const sameLine = (item) => item.productId === productId && item.selectedColor === color;
      const existing = cart.find(sameLine);
      const quantity = Math.min(maxQtyFor(productId, color, cart), (existing?.quantity || 0) + 1);
      if (quantity <= (existing?.quantity || 0)) {
        skipped += 1;
        return;
      }
      cart = existing
        ? cart.map((item) => (sameLine(item) ? { ...item, quantity } : item))
        : [...cart, { productId, selectedColor: color, quantity }];
      writes.push({ productId, selectedColor: color, quantity });
    });
    if (!writes.length) {
      notify('Các món trong bộ đã hết hàng hoặc giỏ đã đủ số lượng.');
      return 0;
    }
    const ok = await saveCart(
      cart,
      async () => {
        for (const item of writes) await api.cart.add({ userId: current.id, ...item });
      },
      'Không thêm được cả bộ vào giỏ. Vui lòng thử lại.',
    );
    if (!ok) return 0;
    notify(skipped ? `Đã thêm ${writes.length} món vào giỏ, ${skipped} món đã hết hàng.` : `Đã thêm ${writes.length} món vào giỏ hàng.`);
    return writes.length;
  };

  const clearCart = async () => {
    const current = userRef.current;
    if (!current) return false;
    return saveCart(current.cart.length ? [] : current.cart, () => api.cart.clear(current.id), 'Không xóa được giỏ hàng. Vui lòng thử lại.');
  };

  const cartCount = user ? user.cart.reduce((sum, item) => sum + item.quantity, 0) : 0;

  // ---------- Đơn hàng ----------
  // installation = { date, timeSlot, note }: lịch giao và lắp đặt, bắt buộc cho mọi đơn
  // buyNowItem = { productId, selectedColor, quantity }: "Mua ngay" chỉ đặt món này, giỏ hàng giữ nguyên
  // Đặt từ giỏ, hoặc "Mua ngay" khi có buyNowItem (không đụng tới giỏ)
  const placeOrder = async ({ shipping, paymentMethod, installation, deliveryZone, buyNowItem = null }) => {
    const current = userRef.current;
    if (!current) throw new Error('Bạn cần đăng nhập để đặt hàng.');
    if (!buyNowItem && !current.cart.length) throw new Error('Giỏ hàng đang trống.');
    const details = { shipping, paymentMethod, installation, deliveryZone };
    try {
      const order = buyNowItem
        ? await api.orders.placeBuyNow({ item: buyNowItem, ...details })
        : await api.orders.place(details);
      setOrders((items) => [order, ...items]);
      if (!buyNowItem) setUser({ ...current, cart: [] });
      refreshProductsSilently(); // database đã trừ kho, cập nhật lại "Còn N sản phẩm"
      return order;
    } catch (e) {
      if (__DEV__) console.warn('[Đặt hàng] lỗi:', e?.code, e?.message);
      if (/STOCK|QUANTITY/.test(String(e?.message))) refreshProductsSilently();
      throw new Error(orderErrorMessage(e, buyNowItem
        ? 'Không gửi được đơn hàng. Vui lòng thử lại.'
        : 'Không gửi được đơn hàng. Giỏ hàng vẫn được giữ lại để bạn thử lại.'));
    }
  };

  const requestOrderCancellation = async ({ orderId, reasonCode, reasonDetail }) => {
    if (!userRef.current) throw new Error('Bạn cần đăng nhập để gửi yêu cầu hủy đơn.');
    try {
      const updatedOrder = await api.orders.requestCancellation({ orderId, reasonCode, reasonDetail });
      setOrders((items) => items.map((item) => (item.id === updatedOrder.id ? updatedOrder : item)));
      if (updatedOrder.status === ORDER_STATUS.CANCELLED) {
        // Đơn còn "Chờ xác nhận" được hủy ngay và database đã hoàn kho
        refreshProductsSilently();
        notify('Đã hủy đơn hàng.');
      } else {
        notify('Đã gửi yêu cầu hủy đơn. Cửa hàng sẽ xem xét và phản hồi.');
      }
      return updatedOrder;
    } catch (e) {
      const message = String(e?.message || '');
      if (message.includes('CANCELLATION_REQUEST_ALREADY_EXISTS')) {
        throw new Error('Đơn hàng này đã có yêu cầu hủy.');
      }
      if (message.includes('ORDER_CANNOT_BE_CANCELLED')) {
        throw new Error('Đơn đã chuyển sang giai đoạn không thể yêu cầu hủy.');
      }
      throw new Error('Chưa gửi được yêu cầu hủy đơn. Vui lòng thử lại.');
    }
  };

  const reorderOrder = async (orderId) => {
    const current = userRef.current;
    if (!current) throw new Error('Bạn cần đăng nhập để mua lại đơn hàng.');
    try {
      const result = await api.orders.reorder(orderId);
      setUser({ ...current, cart: result.cart });
      return result;
    } catch (e) {
      const message = String(e?.message || '');
      if (message.includes('REORDER_REQUIRES_DELIVERED_ORDER')) {
        throw new Error('Chỉ đơn đã giao mới có thể mua lại.');
      }
      if (message.includes('ORDER_NOT_FOUND')) {
        throw new Error('Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.');
      }
      throw new Error('Chưa thể thêm lại sản phẩm vào giỏ. Vui lòng thử lại.');
    }
  };

  return (
    <Ctx.Provider
      value={{
        products, loading, error, loadProducts, user, ready,
        login, register, resendConfirmation, logout, updateProfile, changePassword, refreshRole,
        favorites, isFav, toggleFavorite, clearFavorites,
        addToCart, addItemsToCart, setQty, removeFromCart, clearCart, cartCount, maxQtyFor,
        orders, ordersLoading, orderError, loadOrders, placeOrder, requestOrderCancellation, reorderOrder,
        toast, notify,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
