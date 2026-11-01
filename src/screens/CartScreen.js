import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, SCREEN_PADDING, shadow } from '../theme';
import { confirmAction, finalPrice, formatVND, isValidPhone, SWATCHES } from '../utils';
import { Button, EmptyState, Icon, IconButton, ProductImage, QtyStepper, Txt } from '../components/ui';

export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, products, setQty, removeFromCart, clearCart, maxQtyFor, placeOrder, notify } = useApp();
  const [placing, setPlacing] = useState(false);

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
          onPress={() => confirmAction({ title: 'Xóa giỏ hàng', message: 'Xóa toàn bộ sản phẩm trong giỏ?', confirmText: 'Xóa tất cả', destructive: true, onConfirm: clearCart })}
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

  // Cửa hàng cần gọi xác nhận và giao tận nơi nên bắt buộc có SĐT + địa chỉ
  const hasContact = isValidPhone(user.phone) && !!user.address?.trim();

  const checkout = () => {
    if (!hasContact) {
      confirmAction({
        title: 'Thiếu thông tin giao hàng',
        message: 'Cần số điện thoại và địa chỉ để cửa hàng gọi xác nhận và giao hàng. Cập nhật ngay?',
        confirmText: 'Cập nhật',
        onConfirm: () => navigation.navigate('EditProfile'),
      });
      return;
    }
    confirmAction({
      title: 'Xác nhận đặt hàng',
      message: `Tổng thanh toán ${formatVND(total)}.\nNgười nhận: ${user.name} - ${user.phone}\nGiao đến: ${user.address}`,
      confirmText: 'Đặt hàng',
      onConfirm: async () => {
        setPlacing(true);
        try {
          await placeOrder();
          notify('Đặt hàng thành công, cửa hàng sẽ gọi xác nhận');
          navigation.navigate('Orders');
        } catch (e) {
          if (e.code === 'MISSING_CONTACT') navigation.navigate('EditProfile');
          notify(e.message);
        }
        setPlacing(false);
      },
    });
  };

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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {color && <View style={[s.dot, { backgroundColor: SWATCHES[color] || colors.sunken }]} />}
                    <Txt v="caption" color={colors.inkMuted}>{color ? `${color} · ${p.brand}` : p.brand}</Txt>
                  </View>
                </Pressable>
                <IconButton icon="trash-can-outline" color={colors.inkSoft} bg="transparent" size={32} iconSize={20} onPress={() => removeFromCart(p.id, color)} label="Xóa khỏi giỏ" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Txt v="price" color={colors.primary} style={{ fontSize: 15 }}>{formatVND(finalPrice(p) * quantity)}</Txt>
                <QtyStepper value={quantity} max={maxQtyFor(p.id, color)} onChange={(v) => setQty(p.id, color, v)} />
              </View>
            </View>
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={[s.summary, { paddingBottom: 16 }]}>
          <Pressable onPress={() => navigation.navigate('EditProfile')} style={s.ship}>
            <Icon name={hasContact ? 'map-marker-outline' : 'alert-circle-outline'} size={20} color={hasContact ? colors.primary : colors.danger} />
            <View style={{ flex: 1 }}>
              {hasContact ? (
                <>
                  <Txt v="caption" color={colors.ink}>{`${user.name} · ${user.phone}`}</Txt>
                  <Txt v="small" color={colors.inkSoft} numberOfLines={1}>{user.address}</Txt>
                </>
              ) : <Txt v="small" color={colors.danger}>Chưa có số điện thoại hoặc địa chỉ giao hàng</Txt>}
            </View>
            <Txt v="caption" color={colors.primary}>{hasContact ? 'Sửa' : 'Thêm'}</Txt>
          </Pressable>
          <Line label="Tạm tính" value={formatVND(subtotal)} />
          {saved > 0 && <Line label="Giảm giá" value={`-${formatVND(saved)}`} color={colors.success} />}
          <Line label="Giao hàng và lắp đặt" value="Miễn phí" color={colors.success} />
          <View style={s.totalRow}>
            <Txt v="subtitle">Tổng cộng</Txt>
            <Txt v="display" color={colors.primary} style={{ fontSize: 22, lineHeight: 30 }}>{formatVND(total)}</Txt>
          </View>
          <Button title="Đặt hàng" icon="check" onPress={checkout} loading={placing} />
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
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(74, 58, 48, 0.15)' },
  ship: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 12, borderRadius: radius.input, backgroundColor: colors.bg },
  summary: { backgroundColor: colors.surface, paddingHorizontal: SCREEN_PADDING, paddingTop: 18, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, ...shadow, shadowOffset: { width: 0, height: -4 } },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 14 },
});
