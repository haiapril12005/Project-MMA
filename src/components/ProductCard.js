import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { finalPrice, formatVND } from '../utils';

export default function ProductCard({ item }) {
  const nav = useNavigation();
  const { colors } = useTheme();
  const { user, isFav, toggleFavorite, addToCart } = useApp();
  const guard = (fn) => () => (user ? fn() : nav.navigate('Login'));
  return (
    <Pressable style={s.wrap} onPress={() => nav.navigate('Detail', { id: item.id })}>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
        <Image source={{ uri: item.uri }} style={[s.img, { backgroundColor: colors.surfaceVariant }]} />
        {item.percentOff > 0 && (
          <View style={[s.badge, { backgroundColor: colors.primary }]}><Text style={s.badgeTxt}>-{Math.round(item.percentOff * 100)}%</Text></View>
        )}
        <IconButton icon={isFav(item.id) ? 'heart' : 'heart-outline'} iconColor={isFav(item.id) ? '#C0392B' : colors.onSurface} containerColor="rgba(255,255,255,0.9)" size={20} style={s.heart} onPress={guard(() => toggleFavorite(item.id))} accessibilityLabel="Yêu thích" />
        <View style={s.body}>
          <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>{item.category}</Text>
          <Text variant="titleSmall" numberOfLines={2} style={{ minHeight: 40 }}>{item.name}</Text>
          <View style={s.priceRow}>
            <View style={{ flex: 1 }}>
              <Text variant="titleSmall" style={{ color: colors.primary, fontWeight: '700' }}>{formatVND(finalPrice(item))}</Text>
              {item.percentOff > 0 && <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant, textDecorationLine: 'line-through' }}>{formatVND(item.price)}</Text>}
            </View>
            <IconButton icon="cart-plus" size={20} mode="contained-tonal" onPress={guard(() => addToCart(item.id))} accessibilityLabel="Thêm vào giỏ" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { width: '50%', padding: 6 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  img: { width: '100%', aspectRatio: 1 },
  badge: { position: 'absolute', top: 10, left: 10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  heart: { position: 'absolute', top: 2, right: 2, margin: 4 },
  body: { padding: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});
