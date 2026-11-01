import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { colors, radius, SCREEN_PADDING } from '../theme';
import { formatVND } from '../utils';
import { EmptyState, IconButton, ProductImage, Skeleton, Txt } from '../components/ui';

// Lịch sử đơn hàng của tài khoản đang đăng nhập, đơn mới nhất ở trên
export default function OrdersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [orders, setOrders] = useState(null); // null = đang tải
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const list = await api.orders.byUser(user.id);
      setOrders(list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    } catch (e) {
      setOrders([]);
      setError('Không tải được đơn hàng, kiểm tra kết nối mạng.');
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const header = (
    <View style={[s.head, { paddingTop: insets.top + 8 }]}>
      <IconButton icon="chevron-left" iconSize={26} onPress={() => navigation.goBack()} label="Quay lại" />
      <Txt v="display" style={{ marginTop: 12 }}>Đơn hàng</Txt>
      <Txt v="small" color={colors.inkSoft}>{orders?.length ? `${orders.length} đơn đã đặt` : ' '}</Txt>
    </View>
  );

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <EmptyState icon="receipt-text-outline" title="Đăng nhập để xem đơn hàng" action="Đăng nhập" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={orders || []}
      keyExtractor={(o) => String(o.id)}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32, flexGrow: 1 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={
        orders === null ? (
          <View style={{ paddingHorizontal: SCREEN_PADDING, gap: 12 }}>
            <Skeleton style={{ height: 140, borderRadius: radius.card }} />
            <Skeleton style={{ height: 140, borderRadius: radius.card }} />
          </View>
        ) : (
          <EmptyState
            icon={error ? 'wifi-off' : 'receipt-text-outline'}
            title={error ? 'Chưa tải được đơn hàng' : 'Chưa có đơn hàng nào'}
            text={error || 'Đơn bạn đặt sẽ hiện ở đây để tiện theo dõi.'}
            action={error ? 'Thử lại' : 'Mua sắm ngay'}
            onPress={error ? load : () => navigation.navigate('Tabs', { screen: 'Home' })}
          />
        )
      }
      renderItem={({ item: o }) => (
        <View style={s.card}>
          <View style={s.cardHead}>
            <View>
              <Txt v="bodyStrong" style={{ fontSize: 14 }}>{`Đơn #${String(o.id).slice(-6)}`}</Txt>
              <Txt v="caption" color={colors.inkMuted}>{new Date(o.createdAt).toLocaleString('vi-VN')}</Txt>
            </View>
            <View style={s.status}><Txt v="caption" color={colors.primary}>{o.status}</Txt></View>
          </View>
          {(o.items || []).map((it) => (
            <View key={`${it.productId}|${it.color || ''}`} style={s.item}>
              <ProductImage uri={it.uri} category={it.category} iconSize={20} style={s.thumb} />
              <View style={{ flex: 1 }}>
                <Txt v="small" numberOfLines={1}>{it.name}</Txt>
                <Txt v="caption" color={colors.inkMuted}>{`${it.color ? `${it.color} · ` : ''}${formatVND(it.unitPrice)} x ${it.quantity}`}</Txt>
              </View>
            </View>
          ))}
          <View style={s.foot}>
            <Txt v="caption" color={colors.inkSoft} numberOfLines={2} style={{ flex: 1 }}>{`${o.receiver} · ${o.phone}\n${o.address}`}</Txt>
            <Txt v="price" color={colors.primary}>{formatVND(o.total)}</Txt>
          </View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 18, alignItems: 'flex-start' },
  card: { marginHorizontal: SCREEN_PADDING, padding: 16, backgroundColor: colors.surface, borderRadius: radius.card, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  status: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm },
  foot: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, borderTopWidth: 1, borderTopColor: colors.bg, paddingTop: 10 },
});
