import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, SCREEN_PADDING, shadow } from '../theme';
import { confirmAction, finalPrice, formatVND, SWATCHES } from '../utils';
import { Button, EmptyState, IconButton, ProductImage, QtyStepper, Txt } from '../components/ui';

export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, products, setQty, removeFromCart, clearCart, notify, placeOrder } = useApp();
  const items = (user?.cart || []).map((c) => ({ ...c, product: products.find((p) => p.id === c.productId) })).filter((i) => i.product);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const total = items.reduce((sum, i) => sum + finalPrice(i.product) * i.quantity, 0);
  const saved = subtotal - total;

  const header = (
    <View style={[s.head, { paddingTop: insets.top + 16 }]}>
      <View>
        <Txt v="display">Giỏ hàng</Txt>
        <Txt v="small" color={colors.inkSoft}>{items.length ? `${items.length} sản phẩm` : 'Chưa có sản phẩm nào'}</Txt>
      </View>
      {items.length > 0 && (
        <Pressable
          onPress={() => confirmAction({ title: 'Xóa giỏ hàng', message: 'Xóa toàn bộ sản phẩm trong giỏ?', confirmText: 'Xóa tất cả', destructive: true, onConfirm: () => { clearCart(); notify('Đã xóa giỏ hàng'); }, })}
          style={s.clear}
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

  const checkout = () => confirmAction({
    title: 'Xác nhận đặt hàng',
    message: `Tổng thanh toán ${formatVND(total)}. Giao đến: ${user.address || 'chưa có địa chỉ, cửa hàng sẽ gọi để xác nhận'}.`,
    confirmText: 'Đặt hàng',
    onConfirm: async () => {
      try {
        await placeOrder(items, total);
        notify('Đặt hàng thành công');
        navigation.navigate('Orders');
      } catch (e) {
        notify(e.message || 'Không đặt được hàng, thử lại sau');
      }
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(i) => `${i.productId}|${i.color || ''}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: items.length ? 24 : 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<EmptyState icon="sofa-outline" title="Giỏ hàng đang trống" text="Chọn vài món nội thất cho ngôi nhà của bạn nhé." action="Mua sắm ngay" onPress={() => navigation.navigate('Home')} />}
        renderItem={({ item: { product: p, quantity, color } }) => (
          <View style={s.row}>
            <Pressable onPress={() => navigation.navigate('Detail', { id: p.id })}>
              <ProductImage uri={p.uri} category={p.category} iconSize={28} style={s.thumb} />
            </Pressable>
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('Detail', { id: p.id })}>
                  <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>{p.name}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>{p.brand}</Txt>
                  {!!color && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: SWATCHES[color] || colors.sunken, borderWidth: 1, borderColor: colors.line }} />
                      <Txt v="caption" color={colors.inkSoft}>{color}</Txt>
                    </View>
                  )}
                </Pressable>
                <IconButton icon="trash-can-outline" color={colors.inkSoft} bg="transparent" size={32} iconSize={20} onPress={() => removeFromCart(p.id, color)} label="Xóa khỏi giỏ" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Txt v="price" color={colors.primary} style={{ fontSize: 15 }}>{formatVND(finalPrice(p) * quantity)}</Txt>
                <QtyStepper value={quantity} max={p.stock} onChange={(v) => setQty(p.id, v, color)} />
              </View>
            </View>
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={[s.summary, { paddingBottom: 16 }]}>
          <Line label="Tạm tính" value={formatVND(subtotal)} />
          {saved > 0 && <Line label="Giảm giá" value={`-${formatVND(saved)}`} color={colors.success} />}
          <Line label="Giao hàng và lắp đặt" value="Miễn phí" color={colors.success} />
          <View style={s.totalRow}>
            <Txt v="subtitle">Tổng cộng</Txt>
            <Txt v="display" color={colors.primary} style={{ fontSize: 22, lineHeight: 30 }}>{formatVND(total)}</Txt>
          </View>
          <Button title="Đặt hàng" icon="check" onPress={checkout} />
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
});
