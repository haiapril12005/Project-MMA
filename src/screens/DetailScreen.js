import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, View } from 'react-native';
import { Button, Chip, Divider, Text, TextInput, useTheme } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { finalPrice, formatVND } from '../utils';
import Stars from '../components/Stars';

export default function DetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { products, user, isFav, toggleFavorite, addToCart } = useApp();
  const product = products.find((p) => p.id === String(route.params.id));
  const [reviews, setReviews] = useState([]);
  const [starFilter, setStarFilter] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const mine = user ? reviews.find((r) => String(r.userId) === String(user.id)) : null;
  const loadReviews = useCallback(async () => setReviews(await api.reviews.byProduct(route.params.id)), [route.params.id]);

  useEffect(() => { loadReviews().catch(() => {}); }, [loadReviews]);
  useEffect(() => { setRating(mine ? mine.rating : 5); setComment(mine ? mine.comment : ''); }, [mine?.id]); // eslint-disable-line

  if (!product) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Không tìm thấy sản phẩm.</Text></View>;

  const needLogin = () => { if (!user) { navigation.navigate('Login'); return true; } return false; };
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const counts = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.rating === s).length }));
  const shown = (starFilter ? reviews.filter((r) => r.rating === starFilter) : reviews).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const submit = async () => {
    if (needLogin()) return;
    if (!comment.trim()) { Alert.alert('Chưa có nội dung', 'Hãy nhập nhận xét của bạn.'); return; }
    setBusy(true);
    try {
      const body = { productId: product.id, userId: user.id, userName: user.name, rating, comment: comment.trim(), createdAt: new Date().toISOString() };
      if (mine) await api.reviews.update(mine.id, body); else await api.reviews.create(body);
      await loadReviews();
    } catch (e) { Alert.alert('Lỗi', 'Không gửi được đánh giá. Thử lại sau.'); }
    setBusy(false);
  };
  const removeMine = () => Alert.alert('Xóa đánh giá', 'Bạn muốn xóa đánh giá của mình?', [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Xóa', style: 'destructive', onPress: async () => { await api.reviews.remove(mine.id); setComment(''); setRating(5); await loadReviews(); } },
  ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Image source={{ uri: product.uri }} style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceVariant }} />
      <View style={{ padding: 16, gap: 8 }}>
        <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>{product.brand} · {product.category}</Text>
        <Text variant="headlineSmall" style={{ fontWeight: '700' }}>{product.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Stars value={avg} />
          <Text variant="bodySmall">{reviews.length ? `${avg.toFixed(1)} (${reviews.length} đánh giá)` : 'Chưa có đánh giá'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text variant="headlineSmall" style={{ color: colors.primary, fontWeight: '700' }}>{formatVND(finalPrice(product))}</Text>
          {product.percentOff > 0 && <>
            <Text style={{ textDecorationLine: 'line-through', color: colors.onSurfaceVariant }}>{formatVND(product.price)}</Text>
            <Chip compact>-{Math.round(product.percentOff * 100)}%</Chip>
          </>}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginVertical: 6 }}>
          <Button mode="contained" icon="cart-plus" style={{ flex: 1 }} onPress={() => { if (!needLogin()) { addToCart(product.id); Alert.alert('Đã thêm vào giỏ', product.name); } }}>Thêm vào giỏ</Button>
          <Button mode="outlined" icon={isFav(product.id) ? 'heart' : 'heart-outline'} onPress={() => { if (!needLogin()) toggleFavorite(product.id); }}>{isFav(product.id) ? 'Đã thích' : 'Yêu thích'}</Button>
        </View>

        <Text variant="titleMedium" style={{ marginTop: 8 }}>Thông tin sản phẩm</Text>
        <Text>{product.description}</Text>
        <Spec label="Chất liệu" value={product.material} />
        <Spec label="Kích thước" value={product.dimensions} />
        <Spec label="Màu sắc" value={(product.color || []).join(', ')} />
        <Spec label="Còn lại" value={`${product.stock} sản phẩm`} />

        <Divider style={{ marginVertical: 12 }} />
        <Text variant="titleMedium">Đánh giá từ khách hàng</Text>
        {counts.map(({ s, n }) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ width: 34 }}>{s} sao</Text>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceVariant }}>
              <View style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%`, height: 8, borderRadius: 4, backgroundColor: '#C99A2E' }} />
            </View>
            <Text style={{ width: 24, textAlign: 'right' }}>{n}</Text>
          </View>
        ))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          <Chip selected={starFilter === 0} onPress={() => setStarFilter(0)} showSelectedCheck={false}>Tất cả ({reviews.length})</Chip>
          {counts.map(({ s, n }) => <Chip key={s} selected={starFilter === s} onPress={() => setStarFilter(s)} showSelectedCheck={false} icon="star">{s} sao ({n})</Chip>)}
        </ScrollView>

        {shown.length === 0 && <Text style={{ color: colors.onSurfaceVariant }}>Chưa có đánh giá nào trong mục này.</Text>}
        {shown.map((r) => (
          <View key={r.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.outline }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700' }}>{r.userName}{mine && r.id === mine.id ? ' (bạn)' : ''}</Text>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{new Date(r.createdAt).toLocaleDateString('vi-VN')}</Text>
            </View>
            <Stars value={r.rating} size={14} />
            <Text>{r.comment}</Text>
          </View>
        ))}

        <Text variant="titleMedium" style={{ marginTop: 16 }}>{mine ? 'Đánh giá của bạn' : 'Viết đánh giá'}</Text>
        {user ? (
          <View style={{ gap: 8 }}>
            <Stars value={rating} size={26} onChange={setRating} />
            <TextInput mode="outlined" multiline numberOfLines={3} placeholder="Chia sẻ trải nghiệm của bạn" value={comment} onChangeText={setComment} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button mode="contained" loading={busy} disabled={busy} onPress={submit}>{mine ? 'Lưu thay đổi' : 'Gửi đánh giá'}</Button>
              {mine && <Button mode="outlined" textColor="#B3261E" onPress={removeMine}>Xóa đánh giá</Button>}
            </View>
          </View>
        ) : (
          <Button mode="outlined" onPress={() => navigation.navigate('Login')}>Đăng nhập để viết đánh giá</Button>
        )}
      </View>
    </ScrollView>
  );
}

function Spec({ label, value }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{ width: 100, opacity: 0.7 }}>{label}</Text>
      <Text style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}
