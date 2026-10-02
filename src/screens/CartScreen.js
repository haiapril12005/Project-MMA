import React from 'react';
import { Alert, FlatList, Image, Pressable, View } from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import { finalPrice, formatVND } from '../utils';

export default function CartScreen({ navigation }) {
  const { colors } = useTheme();
  const { user, products, setQty, removeFromCart, clearCart } = useApp();
  const items = (user?.cart || []).map((c) => ({ ...c, product: products.find((p) => p.id === c.productId) })).filter((i) => i.product);
  const total = items.reduce((s, i) => s + finalPrice(i.product) * i.quantity, 0);

  const confirmClear = () => Alert.alert('Xóa tất cả', 'Xóa toàn bộ sản phẩm trong giỏ hàng?', [
    { text: 'Hủy', style: 'cancel' }, { text: 'Xóa tất cả', style: 'destructive', onPress: clearCart },
  ]);

  if (!user) return <Empty text="Đăng nhập để xem giỏ hàng." action="Đăng nhập" onPress={() => navigation.navigate('Login')} />;
  if (items.length === 0) return <Empty text="Giỏ hàng đang trống. Hãy chọn vài món nội thất cho ngôi nhà của bạn." action="Xem sản phẩm" onPress={() => navigation.navigate('Tabs')} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 }}>
        <Text>{items.length} sản phẩm</Text>
        <Button icon="delete-sweep-outline" textColor="#B3261E" onPress={confirmClear}>Xóa tất cả</Button>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.productId}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        renderItem={({ item: { product: p, quantity } }) => (
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.outline, padding: 10, gap: 12 }}>
            <Pressable onPress={() => navigation.navigate('Detail', { id: p.id })}>
              <Image source={{ uri: p.uri }} style={{ width: 88, height: 88, borderRadius: 10, backgroundColor: colors.surfaceVariant }} />
            </Pressable>
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <Pressable onPress={() => navigation.navigate('Detail', { id: p.id })}>
                <Text variant="titleSmall" numberOfLines={2}>{p.name}</Text>
                <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>{p.category}</Text>
              </Pressable>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{formatVND(finalPrice(p))}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton icon="minus" size={16} mode="outlined" disabled={quantity <= 1} onPress={() => setQty(p.id, quantity - 1)} style={{ margin: 0 }} />
                <Text style={{ minWidth: 32, textAlign: 'center' }}>{quantity}</Text>
                <IconButton icon="plus" size={16} mode="outlined" disabled={quantity >= p.stock} onPress={() => setQty(p.id, quantity + 1)} style={{ margin: 0 }} />
                <View style={{ flex: 1 }} />
                <IconButton icon="trash-can-outline" iconColor="#B3261E" size={20} onPress={() => removeFromCart(p.id)} accessibilityLabel="Xóa sản phẩm" />
              </View>
            </View>
          </View>
        )}
      />
      <View style={{ padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.outline, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="titleMedium">Tổng cộng</Text>
        <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '700' }}>{formatVND(total)}</Text>
      </View>
    </View>
  );
}

function Empty({ text, action, onPress }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <Text style={{ textAlign: 'center' }}>{text}</Text>
      <Button mode="contained" onPress={onPress}>{action}</Button>
    </View>
  );
}
