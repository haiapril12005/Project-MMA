import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { applyFilters } from '../utils';
import TopBar from '../components/TopBar';
import FilterBar from '../components/FilterBar';
import ProductCard from '../components/ProductCard';

// Dùng chung cho Trang chủ và Yêu thích
export default function ProductListScreen({ onlyFavorites = false }) {
  const { colors } = useTheme();
  const nav = useNavigation();
  const { products, loading, error, loadProducts, user } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Tất cả');
  const [range, setRange] = useState(0);
  const [sort, setSort] = useState('priceDesc');

  const base = useMemo(() => (onlyFavorites ? products.filter((p) => user?.favorites.includes(p.id)) : products), [products, user, onlyFavorites]);
  const data = useMemo(() => applyFilters(base, { q, cat, range, sort }), [base, q, cat, range, sort]);

  const empty = () => {
    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
    if (error) return <Center text={error} action="Thử lại" onPress={loadProducts} />;
    if (onlyFavorites && !user) return <Center text="Đăng nhập để lưu và xem các món bạn yêu thích." action="Đăng nhập" onPress={() => nav.navigate('Login')} />;
    if (onlyFavorites && base.length === 0) return <Center text="Bạn chưa có món yêu thích nào. Bấm biểu tượng trái tim trên sản phẩm để lưu." />;
    return <Center text="Không có sản phẩm phù hợp. Thử đổi từ khóa hoặc bộ lọc." />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar value={q} onChange={setQ} />
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        numColumns={2}
        renderItem={({ item }) => <ProductCard item={item} />}
        contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        refreshing={loading && products.length > 0}
        onRefresh={loadProducts}
        ListHeaderComponent={
          <View>
            <Text variant="headlineSmall" style={{ paddingHorizontal: 10, paddingTop: 6, fontWeight: '700', color: colors.primary }}>
              {onlyFavorites ? 'Yêu thích' : 'FurWorld'}
            </Text>
            <FilterBar {...{ cat, setCat, range, setRange, sort, setSort }} count={data.length} />
          </View>
        }
        ListEmptyComponent={empty}
      />
    </View>
  );
}

function Center({ text, action, onPress }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
      <Text style={{ textAlign: 'center' }}>{text}</Text>
      {action && <Button mode="contained" onPress={onPress}>{action}</Button>}
    </View>
  );
}
