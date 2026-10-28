import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { colors, fonts, radius, SCREEN_PADDING, shadow } from '../theme';
import { confirmAction, finalPrice, formatVND, percentLabel, SWATCHES } from '../utils';
import { Button, Chip, EmptyState, Icon, IconButton, ProductImage, QtyStepper, Stars, Txt } from '../components/ui';

export default function DetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { products, user, isFav, toggleFavorite, addToCart, notify } = useApp();
  const product = products.find((p) => p.id === String(route.params.id));
  const scrollRef = useRef(null);
  const reviewsY = useRef(0); // vị trí phần đánh giá, dùng cho nút "xem đánh giá"
  const sheetY = useRef(0);

  const [reviews, setReviews] = useState([]);
  const [starFilter, setStarFilter] = useState(0);
  const [color, setColor] = useState(product?.color?.[0]);
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const mine = user ? reviews.find((r) => String(r.userId) === String(user.id)) : null;
  const loadReviews = useCallback(async () => setReviews(await api.reviews.byProduct(route.params.id)), [route.params.id]);

  useEffect(() => {
    let active = true;
    api.reviews.byProduct(route.params.id).then((list) => active && setReviews(list)).catch(() => { });
    return () => { active = false; };
  }, [route.params.id]);
  useEffect(() => { setRating(mine ? mine.rating : 5); setComment(mine ? mine.comment : ''); }, [mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gom đánh giá theo số sao để người dùng xem nhanh
  const { avg, counts, groups } = useMemo(() => {
    const total = reviews.length;
    const a = total ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
    const c = [5, 4, 3, 2, 1].map((star) => ({ star, n: reviews.filter((r) => r.rating === star).length }));
    const g = c
      .filter(({ star, n }) => n > 0 && (!starFilter || star === starFilter))
      .map(({ star }) => ({ star, items: reviews.filter((r) => r.rating === star).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))) }));
    return { avg: a, counts: c, groups: g };
  }, [reviews, starFilter]);

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <EmptyState icon="package-variant-closed" title="Không tìm thấy sản phẩm" text="Sản phẩm có thể đã ngừng bán." action="Quay lại" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const fav = isFav(product.id);
  const needLogin = () => { if (!user) { navigation.navigate('Login'); return true; } return false; };
  const jumpToReviews = () => scrollRef.current?.scrollTo({ y: Math.max(0, reviewsY.current - insets.top - 64), animated: true });

  const submit = async () => {
    if (needLogin()) return;
    if (!comment.trim()) { notify('Hãy viết vài dòng nhận xét trước khi gửi'); return; }
    setBusy(true);
    try {
      const body = { productId: product.id, userId: user.id, userName: user.name, rating, comment: comment.trim(), createdAt: new Date().toISOString() };
      if (mine) await api.reviews.update(mine.id, body); else await api.reviews.create(body);
      await loadReviews();
      notify(mine ? 'Đã cập nhật đánh giá' : 'Cảm ơn bạn đã đánh giá');
    } catch (e) { notify('Không gửi được đánh giá, thử lại sau'); }
    setBusy(false);
  };
  const removeMine = () => confirmAction({
    title: 'Xóa đánh giá', message: 'Bạn muốn xóa đánh giá của mình?', confirmText: 'Xóa', destructive: true,
    onConfirm: async () => { await api.reviews.remove(mine.id); setComment(''); setRating(5); await loadReviews(); },
  });

  const specs = [
    { icon: 'texture-box', label: 'Chất liệu', value: product.material },
    { icon: 'ruler', label: 'Kích thước', value: product.dimensions },
    { icon: 'storefront-outline', label: 'Thương hiệu', value: product.brand },
    { icon: 'package-variant-closed', label: 'Tình trạng', value: product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <ProductImage uri={product.uri} category={product.category} iconSize={64} style={{ width: '100%', aspectRatio: 1 }} />

        <View style={s.sheet} onLayout={(e) => { sheetY.current = e.nativeEvent.layout.y; }}>
          <Txt v="caption" color={colors.inkMuted}>{product.category}</Txt>
          <Txt v="title" style={{ fontSize: 22, lineHeight: 30, marginTop: 2 }}>{product.name}</Txt>

          <Pressable onPress={jumpToReviews} style={s.ratingRow} accessibilityRole="button" accessibilityLabel="Xem đánh giá">
            <Stars value={avg} size={17} />
            <Txt v="small" color={colors.inkSoft}>{reviews.length ? `${avg.toFixed(1)} · ${reviews.length} đánh giá` : 'Chưa có đánh giá'}</Txt>
            <Icon name="chevron-right" size={18} color={colors.inkMuted} />
          </Pressable>

          <View style={s.priceRow}>
            <Txt v="display" color={colors.primary} style={{ fontSize: 26 }}>{formatVND(finalPrice(product))}</Txt>
            {product.percentOff > 0 && (
              <>
                <Txt v="body" color={colors.inkMuted} style={{ textDecorationLine: 'line-through' }}>{formatVND(product.price)}</Txt>
                <View style={s.offPill}><Txt v="caption" color={colors.primary}>{percentLabel(product)}</Txt></View>
              </>
            )}
          </View>

          {/* Màu sắc */}
          {product.color?.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <Txt v="bodyStrong" style={{ marginBottom: 10 }}>Màu sắc<Txt v="body" color={colors.inkSoft}>{`  ${color}`}</Txt></Txt>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {product.color.map((c) => (
                  <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={c} accessibilityState={{ selected: color === c }} style={[s.swatchRing, color === c && { borderColor: colors.primary }]}>
                    <View style={[s.swatch, { backgroundColor: SWATCHES[c] || colors.sunken }]} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Thông số dạng lưới 2 cột */}
          <View style={s.specGrid}>
            {specs.map((sp) => (
              <View key={sp.label} style={s.spec}>
                <Icon name={sp.icon} size={20} color={colors.primary} />
                <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 8 }}>{sp.label}</Txt>
                <Txt v="bodyStrong" style={{ fontSize: 14, lineHeight: 20 }}>{sp.value}</Txt>
              </View>
            ))}
          </View>

          <Txt v="subtitle" style={{ marginTop: 26, marginBottom: 6 }}>Mô tả</Txt>
          <Txt v="body" color={colors.inkSoft}>{product.description}</Txt>

          <View style={s.perks}>
            <View style={s.perk}><Icon name="truck-delivery-outline" size={20} color={colors.success} /><Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>Giao và lắp đặt miễn phí nội thành</Txt></View>
            <View style={s.perk}><Icon name="shield-check-outline" size={20} color={colors.success} /><Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>Bảo hành 24 tháng, đổi trả trong 7 ngày</Txt></View>
          </View>

          {/* ---------- Đánh giá ---------- */}
          <View onLayout={(e) => { reviewsY.current = sheetY.current + e.nativeEvent.layout.y; }} style={{ marginTop: 32 }}>
            <Txt v="title">Đánh giá từ khách hàng</Txt>

            <View style={s.summary}>
              <View style={{ alignItems: 'center', width: 96 }}>
                <Txt v="display" style={{ fontSize: 40, lineHeight: 46 }}>{reviews.length ? avg.toFixed(1) : '0'}</Txt>
                <Stars value={avg} size={14} />
                <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 4 }}>{reviews.length} đánh giá</Txt>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {counts.map(({ star, n }) => (
                  <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt v="caption" color={colors.inkSoft} style={{ width: 12 }}>{star}</Txt>
                    <View style={{ flex: 1, height: 6 }}>
                      <View style={{ width: `${reviews.length ? Math.max((n / reviews.length) * 100, n ? 6 : 0) : 0}%`, height: 6, borderRadius: 3, backgroundColor: colors.star }} />
                    </View>
                    <Txt v="caption" color={colors.inkMuted} style={{ width: 18, textAlign: 'right' }}>{n}</Txt>
                  </View>
                ))}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              <Chip label={`Tất cả (${reviews.length})`} selected={starFilter === 0} onPress={() => setStarFilter(0)} />
              {counts.map(({ star, n }) => <Chip key={star} icon="star" label={`${star} (${n})`} selected={starFilter === star} onPress={() => setStarFilter(star)} />)}
            </ScrollView>

            {groups.length === 0 && <Txt v="small" color={colors.inkMuted} style={{ marginTop: 16 }}>Chưa có đánh giá nào trong mục này.</Txt>}
            {groups.map((g) => (
              <View key={g.star} style={{ marginTop: 18 }}>
                <View style={s.groupHead}>
                  <Stars value={g.star} size={14} />
                  <Txt v="caption" color={colors.inkSoft}>{g.items.length} đánh giá</Txt>
                </View>
                {g.items.map((r) => (
                  <View key={r.id} style={s.review}>
                    <View style={s.reviewAvatar}><Txt v="caption" color={colors.primary}>{r.userName.trim().charAt(0)}</Txt></View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Txt v="bodyStrong" style={{ fontSize: 14 }}>{r.userName}{mine && r.id === mine.id ? ' (bạn)' : ''}</Txt>
                        <Txt v="caption" color={colors.inkMuted}>{new Date(r.createdAt).toLocaleDateString('vi-VN')}</Txt>
                      </View>
                      <Txt v="small" color={colors.inkSoft} style={{ marginTop: 2 }}>{r.comment}</Txt>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {/* Viết đánh giá */}
            <View style={s.writeBox}>
              <Txt v="subtitle">{mine ? 'Đánh giá của bạn' : 'Viết đánh giá'}</Txt>
              {user ? (
                <View style={{ gap: 12, marginTop: 10 }}>
                  <Stars value={rating} size={28} gap={4} onChange={setRating} />
                  <TextInput
                    multiline
                    placeholder="Chia sẻ cảm nhận của bạn về sản phẩm"
                    placeholderTextColor={colors.inkMuted}
                    value={comment}
                    onChangeText={setComment}
                    style={[s.textarea, Platform.OS === 'web' && { outlineStyle: 'none' }]}
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Button title={mine ? 'Lưu thay đổi' : 'Gửi đánh giá'} size="sm" loading={busy} onPress={submit} />
                    {mine && <Button title="Xóa" size="sm" variant="danger" icon="trash-can-outline" onPress={removeMine} />}
                  </View>
                </View>
              ) : (
                <Button title="Đăng nhập để đánh giá" variant="outline" size="sm" onPress={() => navigation.navigate('Login')} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Nút nổi trên ảnh */}
      <View style={[s.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon="chevron-left" onPress={() => navigation.goBack()} label="Quay lại" bg="rgba(255, 251, 246, 0.94)" iconSize={26} />
        <IconButton icon={fav ? 'heart' : 'heart-outline'} color={fav ? colors.primary : colors.ink} onPress={() => toggleFavorite(product.id)} label={fav ? 'Bỏ yêu thích' : 'Yêu thích'} bg="rgba(255, 251, 246, 0.94)" />
      </View>

      {/* Thanh mua hàng cố định */}
      <View style={[s.buyBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <QtyStepper value={qty} max={product.stock} onChange={setQty} />
        <Button
          title="Thêm vào giỏ"
          icon="cart-outline"
          style={{ flex: 1 }}
          disabled={product.stock <= 0}
          onPress={() => { if (!needLogin()) addToCart(product.id, qty, color); }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { marginTop: -28, backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: SCREEN_PADDING, paddingTop: 24 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, alignSelf: 'flex-start', paddingVertical: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  offPill: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  swatchRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(74, 58, 48, 0.12)' },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, marginHorizontal: -5 },
  spec: { width: '50%', padding: 5 },
  perks: { marginTop: 18, gap: 10, backgroundColor: colors.surface, borderRadius: radius.card, padding: 16 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14, marginBottom: 14, backgroundColor: colors.surface, borderRadius: radius.card, padding: 18 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  review: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  writeBox: { marginTop: 24, backgroundColor: colors.surface, borderRadius: radius.card, padding: 18 },
  textarea: { minHeight: 96, borderWidth: 1, borderColor: colors.line, borderRadius: radius.input, padding: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, textAlignVertical: 'top', backgroundColor: colors.bg },
  topBar: { position: 'absolute', left: SCREEN_PADDING - 4, right: SCREEN_PADDING - 4, flexDirection: 'row', justifyContent: 'space-between' },
  buyBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: SCREEN_PADDING, paddingTop: 14, backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, ...shadow, shadowOffset: { width: 0, height: -4 } },
});
