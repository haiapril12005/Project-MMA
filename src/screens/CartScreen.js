import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, SCREEN_PADDING, shadow } from '../theme';
import { confirmAction, formatVND, priceLines } from '../utils';
import { useGiftRules } from '../hooks/useGiftRules';
import GiftNotice from '../components/GiftNotice';
import { Button, EmptyState, Icon, IconButton, ProductImage, QtyStepper, Txt } from '../components/ui';

export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, products, setQty, removeFromCart, clearCart, maxQtyFor } = useApp();
  const items = (user?.cart || []).map((c) => {
    const product = products.find((p) => p.id === c.productId);
    const selectedColor = c.selectedColor || product?.color?.[0] || '';
    // maxQty: số lượng tối đa còn đặt được cho dòng này (tồn kho tính chung mọi màu)
    return { ...c, selectedColor, product, maxQty: product ? maxQtyFor(product.id, selectedColor) : 0 };
  }).filter((i) => i.product);
  // Có dòng vượt tồn kho (do kho vừa giảm) thì chưa cho sang bước đặt hàng
  const overStock = items.some((i) => i.quantity > i.maxQty);
  // Giá từng dòng đã tính giá sỉ (mua từ N cái cùng sản phẩm)
  const { lines, subtotal, itemsTotal: total, discount: saved } = priceLines(items);
  const giftRules = useGiftRules(products);

  const header = (
    <View style={[s.head, { paddingTop: insets.top + 16 }]}>
      <View>
        <Txt v="display">Giỏ hàng</Txt>
        <Txt v="small" color={colors.inkSoft}>{items.length ? `${items.length} sản phẩm` : 'Chưa có sản phẩm nào'}</Txt>
      </View>
      {items.length > 0 && (
        <Pressable
          onPress={() => confirmAction({ title: 'Xóa giỏ hàng', message: 'Xóa toàn bộ sản phẩm trong giỏ?', confirmText: 'Xóa tất cả', destructive: true, onConfirm: clearCart })}
          style={s.clear}
          accessibilityRole="button"
          accessibilityLabel="Xóa tất cả sản phẩm trong giỏ"
        >
          <Txt v="caption" color={colors.danger} style={{ fontSize: 13 }}>Xóa tất cả</Txt>
        </Pressable>
      )}
    </View>
  );

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <EmptyState icon="cart-outline" title="Đăng nhập để xem giỏ hàng" text="Giỏ hàng được lưu theo tài khoản để bạn mua tiếp trên mọi thiết bị." action="Đăng nhập" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        keyExtractor={(i) => `${i.productId}:${i.selectedColor}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: items.length ? 230 : 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<EmptyState icon="sofa-outline" title="Giỏ hàng đang trống" text="Chọn vài món nội thất cho ngôi nhà của bạn nhé." action="Mua sắm ngay" onPress={() => navigation.navigate('Home')} />}
        data={lines}
        renderItem={({ item: { product: p, quantity, selectedColor, maxQty, wholesale, lineTotal } }) => (
          <View style={s.row}>
            <Pressable onPress={() => navigation.navigate('Detail', { id: p.id, color: selectedColor })} accessibilityRole="button" accessibilityLabel={`Xem ảnh ${p.name}`}>
              <ProductImage width={200} uri={p.uri} category={p.category} iconSize={28} style={s.thumb} />
            </Pressable>
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('Detail', { id: p.id, color: selectedColor })} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${p.name}`}>
                  <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>{p.name}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>{p.brand}</Txt>
                  {!!selectedColor && <Txt v="caption" color={colors.inkSoft}>Màu: {selectedColor} · còn {maxQty}</Txt>}
                  {quantity > maxQty && (
                    <Txt v="caption" color={colors.danger}>{maxQty > 0 ? `Chỉ còn đặt được ${maxQty}, hãy giảm số lượng` : 'Đã hết hàng, hãy xóa khỏi giỏ'}</Txt>
                  )}
                </Pressable>
                <IconButton icon="trash-can-outline" color={colors.inkSoft} bg="transparent" size={32} iconSize={20} onPress={() => removeFromCart(p.id, selectedColor)} label="Xóa khỏi giỏ" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <View>
                  <Txt v="price" color={colors.primary} style={{ fontSize: 15 }}>{formatVND(lineTotal)}</Txt>
                  {p.wholesalePercent > 0 && (
                    <Txt v="caption" color={wholesale ? colors.success : colors.inkMuted}>
                      {wholesale ? 'Đã áp dụng giá sỉ' : `Từ ${p.wholesaleMinQty} cái giảm thêm ${Math.round(p.wholesalePercent * 100)}%`}
                    </Txt>
                  )}
                </View>
                <QtyStepper value={quantity} max={maxQty} onChange={(v) => setQty(p.id, selectedColor, v)} />
              </View>
            </View>
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={[s.summary, { paddingBottom: 16 }]}>
          <GiftNotice rules={giftRules} itemsTotal={total} style={{ marginBottom: 10 }} />
          <Line label="Tạm tính" value={formatVND(subtotal)} />
          {saved > 0 && <Line label="Giảm giá" value={`-${formatVND(saved)}`} color={colors.success} />}
          <Line label="Giao hàng và lắp đặt" value="Tính theo khu vực" color={colors.inkSoft} />
          <View style={s.totalRow}>
            <Txt v="subtitle">Tổng tiền hàng</Txt>
            <Txt v="display" color={colors.primary} style={{ fontSize: 22, lineHeight: 30 }}>{formatVND(total)}</Txt>
          </View>
          {overStock && (
            <View style={s.warn}>
              <Icon name="alert-circle-outline" size={18} color={colors.danger} />
              <Txt v="small" color={colors.danger} style={{ flex: 1 }}>Có món vượt số lượng còn trong kho. Giảm số lượng để tiếp tục.</Txt>
            </View>
          )}
          <Button title="Tiếp tục đặt hàng" icon="arrow-right" disabled={overStock} onPress={() => navigation.navigate('Checkout')} />
        </View>
      )}
    </View>
  );
}

function Line({ label, value, color = colors.ink }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Txt v="small" color={colors.inkSoft}>{label}</Txt>
      <Txt v="small" color={color}>{value}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: SCREEN_PADDING, paddingBottom: 18 },
  clear: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#F3E1DC' },
  row: { flexDirection: 'row', gap: 14, marginHorizontal: SCREEN_PADDING, padding: 12, backgroundColor: colors.surface, borderRadius: radius.card },
  thumb: { width: 88, height: 88, borderRadius: radius.img - 2 },
  summary: { backgroundColor: colors.surface, paddingHorizontal: SCREEN_PADDING, paddingTop: 18, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, ...shadow, shadowOffset: { width: 0, height: -4 } },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 14 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
});
