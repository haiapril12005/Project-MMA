import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { SESSION_KEY } from '../config';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const normUser = (u) => ({ ...u, favorites: (u.favorites || []).map(String), cart: u.cart || [] });

export function AppProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUserState] = useState(null);
  const [ready, setReady] = useState(false);
  const userRef = useRef(null);

  const setUser = (u) => { userRef.current = u; setUserState(u); };
  // Cập nhật ngay trên máy, đồng bộ lên server (users) ở nền
  const save = (next) => { setUser(next); api.users.update(next.id, next).catch(() => {}); };

  const loadProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await api.products();
      setProducts(list.map((p) => ({ ...p, id: String(p.id), price: Number(p.price), percentOff: Number(p.percentOff || 0) })));
    } catch (e) {
      setError('Không tải được sản phẩm. Kiểm tra kết nối hoặc BASE_URL trong src/config.js.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadProducts();
    (async () => {
      try {
        const id = await AsyncStorage.getItem(SESSION_KEY);
        if (id) {
          const u = (await api.users.list()).find((x) => String(x.id) === id);
          if (u) setUser(normUser(u));
        }
      } catch (e) { /* bỏ qua, coi như chưa đăng nhập */ }
      setReady(true);
    })();
  }, [loadProducts]);

  const startSession = async (u) => { setUser(normUser(u)); await AsyncStorage.setItem(SESSION_KEY, String(u.id)); };

  const login = async (email, password) => {
    const u = (await api.users.list()).find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) throw new Error('Email hoặc mật khẩu không đúng.');
    await startSession(u);
  };
  const register = async ({ name, email, password }) => {
    const users = await api.users.list();
    if (users.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('Email này đã được đăng ký.');
    const u = await api.users.create({ name: name.trim(), email: email.trim(), password, phone: '', address: '', favorites: [], cart: [] });
    await startSession(u);
  };
  const logout = async () => { setUser(null); await AsyncStorage.removeItem(SESSION_KEY); };
  const updateProfile = (patch) => save({ ...userRef.current, ...patch });
  const changePassword = (oldPw, newPw) => {
    if (userRef.current.password !== oldPw) throw new Error('Mật khẩu hiện tại không đúng.');
    save({ ...userRef.current, password: newPw });
  };

  const isFav = (id) => !!user && user.favorites.includes(String(id));
  const toggleFavorite = (id) => {
    const u = userRef.current; const sid = String(id);
    save({ ...u, favorites: u.favorites.includes(sid) ? u.favorites.filter((x) => x !== sid) : [...u.favorites, sid] });
  };

  const addToCart = (id, qty = 1) => {
    const u = userRef.current; const sid = String(id);
    const stock = products.find((p) => p.id === sid)?.stock ?? 99;
    const has = u.cart.find((c) => c.productId === sid);
    const cart = has
      ? u.cart.map((c) => (c.productId === sid ? { ...c, quantity: Math.min(stock, c.quantity + qty) } : c))
      : [...u.cart, { productId: sid, quantity: Math.min(stock, qty) }];
    save({ ...u, cart });
  };
  const setQty = (id, qty) => {
    const u = userRef.current;
    const stock = products.find((p) => p.id === String(id))?.stock ?? 99;
    save({ ...u, cart: u.cart.map((c) => (c.productId === String(id) ? { ...c, quantity: Math.max(1, Math.min(stock, qty)) } : c)) });
  };
  const removeFromCart = (id) => save({ ...userRef.current, cart: userRef.current.cart.filter((c) => c.productId !== String(id)) });
  const clearCart = () => save({ ...userRef.current, cart: [] });
  const cartCount = user ? user.cart.reduce((s, c) => s + c.quantity, 0) : 0;

  return (
    <Ctx.Provider value={{ products, loading, error, loadProducts, user, ready, login, register, logout, updateProfile, changePassword, isFav, toggleFavorite, addToCart, setQty, removeFromCart, clearCart, cartCount }}>
      {children}
    </Ctx.Provider>
  );
}
