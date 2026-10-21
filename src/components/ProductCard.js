import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { colors, radius } from '../theme';
import { finalPrice, formatVND, percentLabel } from '../utils';
import { IconButton, ProductImage, Txt } from './ui';

// Thẻ sản phẩm dạng lưới 2 cột ở trang chủ
function ProductCard({ item }) {
  const nav = useNavigation();
  const { isFav, toggleFavorite } = useApp();
  const fav = isFav(item.id);
  return (
    <Pressable
      onPress={() => nav.navigate('Detail', { id: item.id })}
      style={({ pressed }) => [s.wrap, pressed && { transform: [{ scale: 0.985 }] }]}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View>
        <ProductImage uri={item.uri} category={item.category} style={s.img} />
        <IconButton
          icon={fav ? 'heart' : 'heart-outline'}
          color={fav ? colors.primary : colors.ink}
          bg="rgba(255, 251, 246, 0.92)"
          size={36}
          iconSize={19}
          onPress={() => toggleFavorite(item.id)}
          label={fav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          style={s.heart}
        />
      </View>
      <View style={s.body}>
        <Txt v="caption" color={colors.inkMuted}>{item.brand}</Txt>
        <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20, minHeight: 40 }}>{item.name}</Txt>
        <View style={s.priceRow}>
          <Txt v="price" color={colors.primary} style={{ fontSize: 15 }}>{formatVND(finalPrice(item))}</Txt>
          {item.percentOff > 0 && <Txt v="caption" color={colors.primary} style={s.off}>{percentLabel(item)}</Txt>}
        </View>
        {item.percentOff > 0 ? (
          <Txt v="small" color={colors.inkMuted} style={{ textDecorationLine: 'line-through', fontSize: 12 }}>{formatVND(item.price)}</Txt>
        ) : <Txt v="small" color={colors.success} style={{ fontSize: 12 }}>Giá tốt mỗi ngày</Txt>}
      </View>
    </Pressable>
  );
}

export default memo(ProductCard);

const s = StyleSheet.create({
  wrap: { flex: 1, maxWidth: '50%', paddingHorizontal: 6, marginBottom: 18 },
  img: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.img },
  heart: { position: 'absolute', top: 10, right: 10 },
  body: { paddingTop: 10, paddingHorizontal: 2, gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  off: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
});
