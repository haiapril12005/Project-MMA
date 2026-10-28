import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { FAVORITES_KEY, SESSION_KEY } from '../config';
import { finalPrice } from '../utils';

const Ctx = createContext(null);
export const useApp = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp phải được dùng bên trong <AppProvider>');
  return ctx;
};
const normProduct = (p) => ({ ...p, id: String(p.id), price: Number(p.price), percentOff: Number(p.percentOff || 0), stock: Number(p.stock ?? 99) });
const normUser = (u) => ({ ...u, cart: u.cart || [] });
const sameLine = (c, productId, color) =>
  c.productId === productId && (c.color || null) === (color || null);

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
  // Cập nhật ngay trên máy, đồng bộ lên server (users) ở nền
  const save = (next) => { setUser(next); api.users.update(next.id, next).catch(() => { }); };

  const notify = useCallback((text) => setToast({ id: Date.now(), text }), []);

  const loadProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await api.products();
      setProducts(list.map((p) => ({ ...p, id: String(p.id), price: Number(p.price), percentOff: Number(p.percentOff || 0), stock: Number(p.stock ?? 99) })));
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
  const updateProfile = (patch) => save({ ...userRef.current, ...patch });
  const changePassword = (oldPw, newPw) => {
    if (userRef.current.password !== oldPw) throw new Error('Mật khẩu hiện tại không đúng.');
    save({ ...userRef.current, password: newPw });
  };

  // ---------- Yêu thích (AsyncStorage, không cần đăng nhập) ----------
  const persistFav = (next) => { setFavorites(next); AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => { }); };
  const isFav = (id) => favorites.includes(String(id));
  const toggleFavorite = (id) => {
    const sid = String(id);
    const adding = !favorites.includes(sid);
    persistFav(adding ? [sid, ...favorites] : favorites.filter((x) => x !== sid));
    notify(adding ? 'Đã lưu vào Yêu thích' : 'Đã bỏ khỏi Yêu thích');
  };
  const clearFavorites = () => { persistFav([]); notify('Đã xóa toàn bộ danh sách yêu thích'); };

  // ---------- Giỏ hàng (lưu theo tài khoản) ----------
  const addToCart = (id, qty = 1, color = null) => {
    const u = userRef.current; const sid = String(id);
    const product = products.find((p) => p.id === sid);
    const stock = product?.stock ?? 99;
    if (stock <= 0) { notify('Sản phẩm đã hết hàng'); return; }
    const chosen = color ?? product?.color?.[0] ?? null; // default to first color (e.g. from Favorites)
    const has = u.cart.find((c) => sameLine(c, sid, chosen));
    const cart = has
      ? u.cart.map((c) => (sameLine(c, sid, chosen) ? { ...c, quantity: Math.min(stock, c.quantity + qty) } : c))
      : [...u.cart, { productId: sid, color: chosen, quantity: Math.min(stock, qty) }];
    save({ ...u, cart });
    notify('Đã thêm vào giỏ hàng');
  };

  const setQty = (id, qty, color = null) => {
    const u = userRef.current; const sid = String(id);
    const stock = products.find((p) => p.id === sid)?.stock ?? 99;
    save({ ...u, cart: u.cart.map((c) => (sameLine(c, sid, color) ? { ...c, quantity: Math.max(1, Math.min(stock, qty)) } : c)) });
  };

  const removeFromCart = (id, color = null) =>
    save({ ...userRef.current, cart: userRef.current.cart.filter((c) => !sameLine(c, String(id), color)) });

  const clearCart = () => save({ ...userRef.current, cart: [] });

  const placeOrder = async (lines, total) => {
    const u = userRef.current;
    const fresh = (await api.products()).map(normProduct); // latest stock, not the possibly stale local copy

    // Total quantity per product (the same product in 2 colors counts together)
    const need = {};
    lines.forEach((l) => { need[l.productId] = (need[l.productId] || 0) + l.quantity; });

    // 1. Check stock before creating anything
    const problem = Object.keys(need).map((pid) => {
      const p = fresh.find((x) => x.id === pid);
      if (!p) return 'Có sản phẩm đã ngừng bán.';
      return p.stock < need[pid] ? `"${p.name}" chỉ còn ${p.stock} sản phẩm.` : null;
    }).find(Boolean);
    if (problem) { setProducts(fresh); throw new Error(problem); }

    // 2. Create the order (snapshot of items)
    const order = await api.orders.create({
      userId: u.id,
      userName: u.name,
      phone: u.phone || '',
      address: u.address || '',
      items: lines.map((l) => ({
        productId: l.productId,
        name: l.product.name,
        uri: l.product.uri,
        category: l.product.category,
        color: l.color || null,
        price: finalPrice(l.product),
        quantity: l.quantity,
      })),
      total,
      status: 'processing',
      createdAt: new Date().toISOString(),
    });

    // 3. Subtract stock (one by one, see note below)
    const updated = fresh.map((p) => (need[p.id] ? { ...p, stock: p.stock - need[p.id] } : p));
    for (const pid of Object.keys(need)) {
      // eslint-disable-next-line no-await-in-loop
      await api.updateProduct(pid, updated.find((p) => p.id === pid));
    }
    setProducts(updated);
    clearCart();
    return order;
  };

  const cancelOrder = async (order) => {
    await api.orders.update(order.id, { ...order, status: 'cancelled' });

    // Give the stock back
    const back = {};
    order.items.forEach((i) => { back[i.productId] = (back[i.productId] || 0) + i.quantity; });
    const fresh = (await api.products()).map(normProduct);
    const updated = fresh.map((p) => (back[p.id] ? { ...p, stock: p.stock + back[p.id] } : p));
    for (const pid of Object.keys(back)) {
      const p = updated.find((x) => x.id === pid);
      // eslint-disable-next-line no-await-in-loop
      if (p) await api.updateProduct(pid, p);
    }
    setProducts(updated);
  };
  const cartCount = user ? user.cart.reduce((s, c) => s + c.quantity, 0) : 0;

  return (
    <Ctx.Provider
      value={{
        products, loading, error, loadProducts, user, ready,
        login, register, logout, updateProfile, changePassword,
        favorites, isFav, toggleFavorite, clearFavorites,
        addToCart, setQty, removeFromCart, clearCart, cartCount,
        toast, notify, placeOrder, cancelOrder,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
