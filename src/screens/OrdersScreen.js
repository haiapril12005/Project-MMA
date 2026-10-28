import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { colors, radius, SCREEN_PADDING } from '../theme';
import { confirmAction, formatVND, ORDER_STATUS } from '../utils';
import { Button, EmptyState, IconButton, ProductImage, Skeleton, Txt } from '../components/ui';

export default function OrdersScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { user, notify, cancelOrder } = useApp();
    const [orders, setOrders] = useState(null); // null = loading

    const load = useCallback(async () => {
        try {
            const list = await api.orders.byUser(user.id);
            setOrders(list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
        } catch (e) {
            setOrders([]);
            notify('Không tải được đơn hàng');
        }
    }, [user.id, notify]);

    // Reload every time the screen is focused (e.g. right after checkout)
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const cancel = (order) => confirmAction({
        title: 'Hủy đơn hàng',
        message: 'Bạn muốn hủy đơn hàng này?',
        confirmText: 'Hủy đơn',
        destructive: true,
        onConfirm: async () => {
            try {
                await cancelOrder(order);
                notify('Đã hủy đơn hàng');
                load();
            } catch (e) { notify('Không hủy được đơn, thử lại sau'); }
        },
    });

    const header = (
        <View style={[s.head, { paddingTop: insets.top + 12 }]}>
            <IconButton icon="chevron-left" iconSize={26} onPress={() => navigation.goBack()} label="Quay lại" />
            <Txt v="display">Đơn hàng của tôi</Txt>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <FlatList
                data={orders || []}
                keyExtractor={(o) => String(o.id)}
                ListHeaderComponent={header}
                contentContainerStyle={{ paddingBottom: 40, gap: 14, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    orders === null ? (
                        <View style={{ paddingHorizontal: SCREEN_PADDING, gap: 12 }}>
                            <Skeleton style={{ height: 160, borderRadius: radius.card }} />
                            <Skeleton style={{ height: 160, borderRadius: radius.card }} />
                        </View>
                    ) : (
                        <EmptyState icon="package-variant-closed" title="Chưa có đơn hàng nào" text="Các đơn bạn đặt sẽ hiện ở đây." action="Mua sắm ngay" onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} />
                    )
                }
                renderItem={({ item: o }) => {
                    const st = ORDER_STATUS[o.status] || ORDER_STATUS.processing;
                    return (
                        <View style={s.card}>
                            <View style={s.topRow}>
                                <View>
                                    <Txt v="bodyStrong">Đơn #{String(o.id).slice(-6)}</Txt>
                                    <Txt v="caption" color={colors.inkMuted}>{new Date(o.createdAt).toLocaleString('vi-VN')}</Txt>
                                </View>
                                <View style={[s.pill, { backgroundColor: st.bg }]}>
                                    <Txt v="caption" color={st.color}>{st.label}</Txt>
                                </View>
                            </View>

                            {o.items.map((it, i) => (
                                <View key={`${it.productId}-${i}`} style={s.item}>
                                    <ProductImage uri={it.uri} category={it.category} iconSize={20} style={s.thumb} />
                                    <View style={{ flex: 1 }}>
                                        <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>{it.name}</Txt>
                                        <Txt v="caption" color={colors.inkMuted}>{it.color ? `${it.color} · ` : ''}SL: {it.quantity}</Txt>
                                    </View>
                                    <Txt v="small" color={colors.inkSoft}>{formatVND(it.price * it.quantity)}</Txt>
                                </View>
                            ))}

                            <View style={s.totalRow}>
                                <Txt v="small" color={colors.inkSoft}>Tổng cộng</Txt>
                                <Txt v="price" color={colors.primary}>{formatVND(o.total)}</Txt>
                            </View>
                            {!!o.address && <Txt v="caption" color={colors.inkMuted}>Giao đến: {o.address}</Txt>}

                            {o.status === 'processing' && (
                                <Button title="Hủy đơn" size="sm" variant="danger" onPress={() => cancel(o)} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                            )}
                        </View>
                    );
                }}
            />
        </View>
    );
}

const s = StyleSheet.create({
    head: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 18, gap: 10, alignItems: 'flex-start' },
    card: { marginHorizontal: SCREEN_PADDING, padding: 16, gap: 10, backgroundColor: colors.surface, borderRadius: radius.card },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    thumb: { width: 52, height: 52, borderRadius: 10 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.bg, paddingTop: 10 },
});