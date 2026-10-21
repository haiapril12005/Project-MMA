import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, SCREEN_PADDING } from '../theme';
import { confirmAction, finalPrice, formatVND, percentLabel } from '../utils';
import { EmptyState, IconButton, ProductImage, Txt } from '../components/ui';

// Danh sách yêu thích lưu trên máy (AsyncStorage)
export default function FavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { products, favorites, toggleFavorite, clearFavorites, addToCart, user } = useApp();
  // Giữ thứ tự: món vừa thích nằm trên cùng
  const items = useMemo(() => favorites.map((id) => products.find((p) => p.id === id)).filter(Boolean), [favorites, products]);

  const askClear = () => confirmAction({
    title: 'Xóa tất cả yêu thích',
    message: `Bỏ ${items.length} sản phẩm khỏi danh sách yêu thích?`,
    confirmText: 'Xóa tất cả',
    destructive: true,
    onConfirm: clearFavorites,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.head, { paddingTop: insets.top + 16 }]}>
        <View>
          <Txt v="display">Yêu thích</Txt>
          <Txt v="small" color={colors.inkSoft}>{items.length ? `${items.length} món bạn đã lưu` : 'Lưu lại những món bạn ưng ý'}</Txt>
        </View>
        {items.length > 0 && (
          <Pressable onPress={askClear} style={s.clear} accessibilityRole="button">
            <Txt v="caption" color={colors.danger} style={{ fontSize: 13 }}>Xóa tất cả</Txt>
          </Pressable>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: 32, gap: 12, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="Chưa có món nào"
            text="Bấm vào biểu tượng trái tim trên sản phẩm để lưu lại và xem sau."
            action="Khám phá sản phẩm"
            onPress={() => navigation.navigate('Home')}
          />
        }
        renderItem={({ item: p }) => (
          <Pressable onPress={() => navigation.navigate('Detail', { id: p.id })} style={({ pressed }) => [s.row, pressed && { opacity: 0.9 }]}>
            <ProductImage uri={p.uri} category={p.category} iconSize={28} style={s.thumb} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="caption" color={colors.inkMuted}>{p.brand}</Txt>
              <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>{p.name}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Txt v="price" color={colors.primary} style={{ fontSize: 15 }}>{formatVND(finalPrice(p))}</Txt>
                {p.percentOff > 0 && <Txt v="caption" color={colors.inkMuted}>{percentLabel(p)}</Txt>}
              </View>
            </View>
            <View style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <IconButton icon="heart" color={colors.primary} bg={colors.primarySoft} size={38} iconSize={19} onPress={() => toggleFavorite(p.id)} label="Bỏ yêu thích" />
              <IconButton icon="cart-plus" color={colors.ink} bg={colors.sunken} size={38} iconSize={19} onPress={() => (user ? addToCart(p.id) : navigation.navigate('Login'))} label="Thêm vào giỏ" />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: SCREEN_PADDING, paddingBottom: 18 },
  clear: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#F3E1DC' },
  row: { flexDirection: 'row', gap: 14, padding: 12, backgroundColor: colors.surface, borderRadius: radius.card },
  thumb: { width: 96, height: 96, borderRadius: radius.img - 2 },
});
