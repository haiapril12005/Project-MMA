import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useCollections } from '../hooks/useCollections';
import { colors, radius, SCREEN_PADDING } from '../theme';
import { finalPrice, formatVND } from '../utils';
import { Button, EmptyState, IconButton, ProductImage, Skeleton, Txt } from '../components/ui';

export default function CollectionScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { products, user, addItemsToCart } = useApp();
  const { collections, loading, error, retry } = useCollections(products);
  const [busy, setBusy] = useState(false);
  const collection = collections.find((item) => item.id === route.params?.id);

  const header = (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      <IconButton icon="chevron-left" iconSize={26} label="Quay lại" onPress={() => navigation.goBack()} />
      <Txt v="title" style={{ flex: 1 }} numberOfLines={1}>{collection?.name || 'Bộ sưu tập'}</Txt>
    </View>
  );

  if (loading && !collection) {
    return (
      <View style={s.screen}>
        {header}
        <View style={{ paddingHorizontal: SCREEN_PADDING, gap: 12 }}>
          <Skeleton style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: radius.card }} />
          <Skeleton style={{ width: '70%', height: 16 }} />
          <Skeleton style={{ width: '100%', height: 72, borderRadius: radius.card }} />
        </View>
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={s.screen}>
        {header}
        <EmptyState
          icon={error ? 'wifi-off' : 'sofa-outline'}
          title={error ? 'Chưa tải được bộ sưu tập' : 'Không tìm thấy bộ sưu tập'}
          text={error || 'Bộ sưu tập có thể đã ngừng bán.'}
          action={error ? 'Thử lại' : 'Quay lại'}
          onPress={error ? retry : () => navigation.goBack()}
        />
      </View>
    );
  }

  const inStock = collection.items.filter((product) => product.stock > 0).length;
  const addAll = async () => {
    if (!user) { navigation.navigate('Login'); return; }
    setBusy(true);
    const added = await addItemsToCart(collection.items.map((product) => product.id));
    setBusy(false);
    if (added > 0) navigation.navigate('Tabs', { screen: 'Cart' });
  };

  return (
    <View style={s.screen}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 120 }}>
        <ProductImage uri={collection.items[0].uri} category={collection.items[0].category} iconSize={56} style={s.cover} />
        <Txt v="caption" color={colors.primary} style={{ marginTop: 16 }}>{`${collection.brand} · ${collection.room}`.toUpperCase()}</Txt>
        <Txt v="display" style={{ marginTop: 4 }}>{collection.name}</Txt>
        {!!collection.description && <Txt v="body" color={colors.inkSoft} style={{ marginTop: 8 }}>{collection.description}</Txt>}

        <Txt v="subtitle" style={{ marginTop: 24, marginBottom: 10 }}>{`Trong bộ (${collection.items.length} món)`}</Txt>
        <View style={s.card}>
          {collection.items.map((product, index) => (
              <Pressable
                key={product.id}
                onPress={() => navigation.push('Detail', { id: product.id })}
                accessibilityRole="button"
                accessibilityLabel={`Xem chi tiết ${product.name}`}
                style={({ pressed }) => [s.item, index < collection.items.length - 1 && s.divider, pressed && { opacity: 0.7 }]}
              >
                <ProductImage width={200} uri={product.uri} category={product.category} iconSize={24} style={s.thumb} />
                <View style={{ flex: 1 }}>
                  <Txt v="caption" color={colors.inkMuted}>{product.category}</Txt>
                  <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14 }}>{product.name}</Txt>
                  <Txt v="caption" color={product.stock > 0 ? colors.inkSoft : colors.danger}>
                    {product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng'}
                  </Txt>
                </View>
                <Txt v="price" color={colors.primary} style={{ fontSize: 14 }}>{formatVND(finalPrice(product))}</Txt>
              </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={{ flex: 1 }}>
          <Txt v="caption" color={colors.inkSoft}>Trọn bộ, mỗi món 1 cái</Txt>
          <Txt v="title" color={colors.primary}>{formatVND(collection.total)}</Txt>
        </View>
        {/* Admin chỉ xem bộ sưu tập, không thêm vào giỏ */}
        {!user?.isAdmin && <Button title={inStock ? 'Thêm cả bộ vào giỏ' : 'Đã hết hàng'} icon="cart-plus" loading={busy} disabled={!inStock} onPress={addAll} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING - 4, paddingBottom: 12 },
  cover: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.card },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.bg },
  thumb: { width: 64, height: 64, borderRadius: radius.input },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING, paddingTop: 14, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
});
