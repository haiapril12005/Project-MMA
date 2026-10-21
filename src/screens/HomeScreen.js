import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, fonts, radius, SCREEN_PADDING } from '../theme';
import { applyFilters, brandsOf, CATEGORIES, greeting, SORTS } from '../utils';
import ProductCard from '../components/ProductCard';
import { Button, Chip, EmptyState, Icon, Skeleton, Txt } from '../components/ui';

const HERO = 'https://images.pexels.com/photos/6908500/pexels-photo-6908500.jpeg?auto=compress&cs=tinysrgb&w=1200';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { products, loading, error, loadProducts, user } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Tất cả');
  const [brand, setBrand] = useState(null);
  const [sort, setSort] = useState('priceDesc');

  const brands = useMemo(() => brandsOf(products), [products]);
  const data = useMemo(() => applyFilters(products, { q, cat, brand, sort }), [products, q, cat, brand, sort]);
  const sortInfo = SORTS.find((x) => x.key === sort);
  const showHero = !q && cat === 'Tất cả' && !brand;
  const firstName = user?.name?.trim().split(' ').pop();

  const resetFilters = () => { setQ(''); setCat('Tất cả'); setBrand(null); };
  const renderItem = useCallback(({ item }) => <ProductCard item={item} />, []);

  const header = (
    <View style={{ paddingTop: insets.top + 12 }}>
      {/* Lời chào */}
      <View style={s.headRow}>
        <View style={{ flex: 1 }}>
          <Txt v="small" color={colors.inkSoft}>{greeting()}{firstName ? `, ${firstName}` : ''}</Txt>
          <Txt v="display">Nội thất cho{'\n'}ngôi nhà ấm</Txt>
        </View>
        <Pressable onPress={() => navigation.navigate('Profile')} style={s.avatar} accessibilityLabel="Tài khoản">
          {user ? <Txt v="subtitle" color={colors.primary}>{user.name.trim().charAt(0).toUpperCase()}</Txt> : <Icon name="account-outline" color={colors.primary} />}
        </Pressable>
      </View>

      {/* Tìm kiếm */}
      <View style={s.search}>
        <Icon name="magnify" size={22} color={colors.inkSoft} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Tìm sofa, đèn chùm, ghế gỗ..."
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.primary}
          returnKeyType="search"
          style={[s.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
        />
        {!!q && (
          <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Xóa từ khóa">
            <Icon name="close" size={20} color={colors.inkSoft} />
          </Pressable>
        )}
      </View>

      {/* Banner */}
      {showHero && (
        <View style={s.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={s.heroScrim} />
          <View style={s.heroText}>
            <Txt v="title" color="#FFF8F2">Phòng khách mùa thu</Txt>
            <Txt v="small" color="#F6EADF" style={{ marginBottom: 12 }}>Sofa vải lanh và đèn chùm giảm đến 25%</Txt>
            <Button title="Xem sofa" size="sm" variant="soft" icon="arrow-right" onPress={() => setCat('Sofa')} style={{ alignSelf: 'flex-start' }} />
          </View>
        </View>
      )}

      {/* Danh mục */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
        {CATEGORIES.map((c) => {
          const on = cat === c.key;
          return (
            <Pressable key={c.key} onPress={() => setCat(c.key)} style={s.catItem} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <View style={[s.catIcon, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Icon name={c.icon} size={26} color={on ? colors.onPrimary : colors.primary} />
              </View>
              <Txt v="caption" color={on ? colors.primary : colors.ink} style={{ fontSize: 12.5, fontFamily: on ? fonts.semibold : fonts.medium }}>{c.key}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Thương hiệu */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.brandRow}>
        <Chip label="Mọi thương hiệu" selected={!brand} onPress={() => setBrand(null)} />
        {brands.map((b) => <Chip key={b} label={b} selected={brand === b} onPress={() => setBrand(brand === b ? null : b)} />)}
      </ScrollView>

      {/* Số kết quả + sắp xếp */}
      <View style={s.resultRow}>
        <Txt v="subtitle">{cat === 'Tất cả' ? 'Tất cả sản phẩm' : cat}<Txt v="small" color={colors.inkMuted}>{`  ${data.length} món`}</Txt></Txt>
        <Pressable onPress={() => setSort(sort === 'priceDesc' ? 'priceAsc' : 'priceDesc')} style={s.sortBtn} accessibilityLabel={`Sắp xếp: ${sortInfo.label}`}>
          <Icon name={sortInfo.icon} size={18} color={colors.primary} />
          <Txt v="caption" color={colors.primary} style={{ fontSize: 13 }}>{sortInfo.label}</Txt>
        </Pressable>
      </View>
    </View>
  );

  const empty = () => {
    if (loading) {
      return (
        <View style={s.skelGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: '50%', paddingHorizontal: 6, marginBottom: 18 }}>
              <Skeleton style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: radius.img }} />
              <Skeleton style={{ width: '50%', height: 12, marginTop: 12 }} />
              <Skeleton style={{ width: '90%', height: 14, marginTop: 8 }} />
              <Skeleton style={{ width: '40%', height: 16, marginTop: 10 }} />
            </View>
          ))}
        </View>
      );
    }
    if (error) return <EmptyState icon="wifi-off" title="Chưa tải được sản phẩm" text={error} action="Thử lại" onPress={loadProducts} />;
    return <EmptyState icon="magnify" title="Không tìm thấy món phù hợp" text="Thử từ khóa khác hoặc bỏ bớt bộ lọc." action="Xóa bộ lọc" onPress={resetFilters} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={loading ? [] : data}
        keyExtractor={(i) => i.id}
        numColumns={2}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING - 6, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        refreshControl={<RefreshControl refreshing={loading && products.length > 0} onRefresh={loadProducts} tintColor={colors.primary} colors={[colors.primary]} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 6, marginBottom: 18 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, marginHorizontal: 6, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  hero: { height: 200, marginHorizontal: 6, marginTop: 18, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.sunken },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(74, 52, 38, 0.38)' },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 18 },
  catRow: { paddingHorizontal: 6, paddingTop: 22, paddingBottom: 6, gap: 14 },
  catItem: { alignItems: 'center', gap: 8, width: 68 },
  catIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  brandRow: { paddingHorizontal: 6, paddingTop: 14, gap: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingTop: 22, paddingBottom: 14 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});
