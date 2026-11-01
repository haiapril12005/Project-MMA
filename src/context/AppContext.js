import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { FAVORITES_KEY, SESSION_KEY } from '../config';
import { finalPrice, isValidPhone } from '../utils';

const Ctx = createContext(null);
export const useApp = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp phải được dùng bên trong <AppProvider>');
  return ctx;
};

// Mỗi dòng giỏ hàng = 1 sản phẩm + 1 màu: { productId, color, quantity }
const normUser = (u) => ({
  ...u,
  cart: (u.cart || []).map((c) => ({ productId: String(c.productId), color: c.color || null, quantity: Number(c.quantity) || 1 })),
});
const normProduct = (p) => ({ ...p, id: String(p.id), price: Number(p.price), percentOff: Number(p.percentOff || 0), stock: Number(p.stock ?? 99) });
const sameLine = (c, productId, color) => c.productId === String(productId) && (c.color || null) === (color || null);
// Số lượng của cùng sản phẩm nhưng ở các màu khác (tồn kho tính chung cho mọi màu)
const otherColorsQty = (cart, productId, color) =>
  cart.filter((c) => c.productId === String(productId) && !sameLine(c, productId, color)).reduce((s, c) => s + c.quantity, 0);

export function AppProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUserState] = useState(null);
  const [favorites, setFavorites] = useState([]); // mảng id sản phẩm, lưu AsyncStorage
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null); // { id, text }
  const userRef = useRef(null);

  const setUser = (u) => { userRef.current = u; setUserState(u); };
  const notify = useCallback((text) => setToast({ id: Date.now(), text }), []);

  // Lưu user lên server.
  // optimistic = true: đổi trên màn hình ngay, server lỗi thì trả lại như cũ (dùng cho giỏ hàng).
  // optimistic = false: chờ server lưu xong mới đổi (dùng cho hồ sơ, mật khẩu).
  // Lỗi luôn được ném ra để màn hình báo cho người dùng, không im lặng nuốt lỗi.
  const save = async (next, { optimistic = true } = {}) => {
    const prev = userRef.current;
    if (optimistic) setUser(next);
    try {
      await api.users.update(next.id, next);
      if (!optimistic) setUser(next);
    } catch (e) {
      if (optimistic && userRef.current === next) setUser(prev);
      throw new Error('Không lưu được lên máy chủ. Kiểm tra kết nối mạng rồi thử lại.');
    }
  };
  const saveCart = (cart) => save({ ...userRef.current, cart }).catch((e) => notify(e.message));

  const loadProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await api.products.list();
      setProducts(list.map(normProduct));
    } catch (e) {
      setError('Không tải được sản phẩm. Kiểm tra kết nối mạng hoặc BASE_URL trong src/config.js.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadProducts();
    (async () => {
      try {
        const [id, favRaw] = await Promise.all([AsyncStorage.getItem(SESSION_KEY), AsyncStorage.getItem(FAVORITES_KEY)]);
        if (favRaw) setFavorites(JSON.parse(favRaw));
        if (id) {
          const u = (await api.users.list()).find((x) => String(x.id) === id);
          if (u) setUser(normUser(u));
        }
      } catch (e) { /* bỏ qua, coi như chưa đăng nhập */ }
      setReady(true);
    })();
  }, [loadProducts]);

  // ---------- Đăng nhập ----------
  const startSession = async (u) => { setUser(normUser(u)); await AsyncStorage.setItem(SESSION_KEY, String(u.id)); };

  const login = async (email, password) => {
    const u = (await api.users.list()).find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) throw new Error('Email hoặc mật khẩu không đúng.');
    await startSession(u);
  };
  const register = async ({ name, email, password }) => {
    const users = await api.users.list();
    if (users.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('Email này đã được đăng ký.');
    const u = await api.users.create({ name: name.trim(), email: email.trim(), password, phone: '', address: '', cart: [] });
    await startSession(u);
  };
  const logout = async () => { setUser(null); await AsyncStorage.removeItem(SESSION_KEY); };
  // Chờ server lưu xong; lỗi sẽ được ném ra cho màn hình hiển thị
  const updateProfile = (patch) => save({ ...userRef.current, ...patch }, { optimistic: false });
  const changePassword = async (oldPw, newPw) => {
    if (userRef.current.password !== oldPw) throw new Error('Mật khẩu hiện tại không đúng.');
    await save({ ...userRef.current, password: newPw }, { optimistic: false });
  };

  // ---------- Yêu thích (AsyncStorage, không cần đăng nhập) ----------
  const persistFav = (next) => { setFavorites(next); AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {}); };
  const isFav = (id) => favorites.includes(String(id));
  const toggleFavorite = (id) => {
    const sid = String(id);
    const adding = !favorites.includes(sid);
    persistFav(adding ? [sid, ...favorites] : favorites.filter((x) => x !== sid));
    notify(adding ? 'Đã lưu vào Yêu thích' : 'Đã bỏ khỏi Yêu thích');
  };
  const clearFavorites = () => { persistFav([]); notify('Đã xóa toàn bộ danh sách yêu thích'); };

  // ---------- Giỏ hàng (lưu theo tài khoản, phân biệt theo màu) ----------
  const stockOf = (id) => products.find((p) => p.id === String(id))?.stock ?? 0;
  // Số lượng tối đa được đặt cho 1 dòng (sản phẩm + màu), đã trừ phần các màu khác đang giữ
  const maxQtyFor = (id, color) => Math.max(0, stockOf(id) - otherColorsQty(userRef.current?.cart || [], id, color));

  const addToCart = (id, qty = 1, color = null) => {
    const u = userRef.current; const sid = String(id);
    const line = u.cart.find((c) => sameLine(c, sid, color));
    const room = maxQtyFor(sid, color) - (line?.quantity || 0);
    const add = Math.min(qty, room);
    if (add <= 0) { notify('Giỏ đã có đủ số lượng còn trong kho'); return 0; }
    const cart = line
      ? u.cart.map((c) => (sameLine(c, sid, color) ? { ...c, quantity: c.quantity + add } : c))
      : [...u.cart, { productId: sid, color: color || null, quantity: add }];
    saveCart(cart);
    notify(add < qty ? `Chỉ thêm được ${add} món vì kho không còn đủ` : 'Đã thêm vào giỏ hàng');
    return add;
  };
  const setQty = (id, color, qty) => {
    const u = userRef.current;
    const max = maxQtyFor(id, color);
    saveCart(u.cart.map((c) => (sameLine(c, id, color) ? { ...c, quantity: Math.max(1, Math.min(max, qty)) } : c)));
  };
  const removeFromCart = (id, color) => saveCart(userRef.current.cart.filter((c) => !sameLine(c, id, color)));
  const clearCart = () => saveCart([]);
  const cartCount = user ? user.cart.reduce((s, c) => s + c.quantity, 0) : 0;

  // ---------- Đặt hàng ----------
  // 1. Bắt buộc có SĐT + địa chỉ  2. Kiểm tra tồn kho mới nhất trên server
  // 3. Tạo đơn (orders)  4. Trừ tồn kho  5. Xóa giỏ
  const placeOrder = async () => {
    const u = userRef.current;
    if (!isValidPhone(u.phone) || !u.address?.trim()) {
      const e = new Error('Cần số điện thoại và địa chỉ giao hàng trước khi đặt hàng.');
      e.code = 'MISSING_CONTACT';
      throw e;
    }
    if (!u.cart.length) throw new Error('Giỏ hàng đang trống.');

    const latest = (await api.products.list()).map(normProduct);
    const byId = Object.fromEntries(latest.map((p) => [p.id, p]));
    const need = {};
    u.cart.forEach((c) => { need[c.productId] = (need[c.productId] || 0) + c.quantity; });
    const problems = Object.entries(need)
      .filter(([id, q]) => !byId[id] || byId[id].stock < q)
      .map(([id]) => (byId[id] ? `${byId[id].name} (còn ${byId[id].stock})` : 'một sản phẩm đã ngừng bán'));
    if (problems.length) {
      setProducts(latest);
      throw new Error(`Không đủ hàng: ${problems.join(', ')}. Hãy chỉnh lại giỏ hàng.`);
    }

    const items = u.cart.map((c) => {
      const p = byId[c.productId];
      return { productId: p.id, name: p.name, uri: p.uri, category: p.category, color: c.color, quantity: c.quantity, unitPrice: finalPrice(p) };
    });
    const order = await api.orders.create({
      userId: u.id,
      receiver: u.name,
      phone: u.phone,
      address: u.address,
      items,
      total: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      status: 'Chờ xác nhận',
      createdAt: new Date().toISOString(),
    });

    // Trừ tồn kho lần lượt từng món (chạy song song sẽ ghi đè nhau ở chế độ mock)
    for (const [id, q] of Object.entries(need)) {
      // eslint-disable-next-line no-await-in-loop
      await api.products.update(id, { ...byId[id], stock: byId[id].stock - q });
    }
    setProducts(latest.map((p) => (need[p.id] ? { ...p, stock: p.stock - need[p.id] } : p)));

    // Đơn đã tạo xong: nếu chưa xóa được giỏ trên server thì vẫn xóa trên máy để tránh đặt trùng
    await save({ ...userRef.current, cart: [] }).catch(() => setUser({ ...userRef.current, cart: [] }));
    return order;
  };

  return (
    <Ctx.Provider
      value={{
        products, loading, error, loadProducts, user, ready,
        login, register, logout, updateProfile, changePassword,
        favorites, isFav, toggleFavorite, clearFavorites,
        addToCart, setQty, removeFromCart, clearCart, cartCount, maxQtyFor,
        placeOrder,
        toast, notify,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
