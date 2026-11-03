import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useManagedOrder, useStaffTasks } from '../hooks/useAdminOrders';
import { colors, radius, SCREEN_PADDING } from '../theme';
import { amountDue, formatDateOnly, formatVND, ORDER_STATUS, orderStatus } from '../utils';
import { EmptyState, Icon, IconButton, Skeleton, Txt } from '../components/ui';
import { Pill } from '../components/WorkflowParts';
import DeliveryPanel from '../components/DeliveryPanel';
import { SupportCard } from './SupportScreens';

const scheduleOf = (order) => {
  const plan = order.status === ORDER_STATUS.DELIVERY_ISSUE ? order.redelivery : order.installation;
  return plan ? `${formatDateOnly(plan.date)} · ${plan.timeSlot}` : 'Chưa hẹn lịch';
};

function OrderTask({ order, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Đơn ${order.code}`} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}>
      <View style={s.row}>
        <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{order.code}</Txt>
        <Pill info={orderStatus(order.status)} />
      </View>
      <Txt v="small">{`${order.shipping.name} · ${order.shipping.phone}`}</Txt>
      <Txt v="caption" color={colors.inkSoft} numberOfLines={2}>{order.shipping.address}</Txt>
      <View style={s.row}>
        <Icon name="calendar-clock" size={16} color={colors.primary} />
        <Txt v="caption" color={colors.primary} style={{ flex: 1 }}>{scheduleOf(order)}</Txt>
        <Txt v="caption" color={colors.inkSoft}>{`${order.items.reduce((sum, item) => sum + item.quantity, 0)} món · thu ${formatVND(amountDue(order))}`}</Txt>
      </View>
    </Pressable>
  );
}

// Tab "Việc của tôi" của nhân viên giao hàng
export function StaffTasksScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { orders, visits, loading, error, reload } = useStaffTasks(user?.id);

  useFocusEffect(useCallback(() => { if (user?.isStaff) reload(); }, [user?.isStaff, reload]));

  if (!user?.isStaff) {
    return <View style={s.screen}><EmptyState icon="shield-lock-outline" title="Chỉ dành cho nhân viên giao hàng" /></View>;
  }

  const toDeliver = orders.filter((order) => order.status !== ORDER_STATUS.DELIVERY_ISSUE);
  const redeliver = orders.filter((order) => order.status === ORDER_STATUS.DELIVERY_ISSUE);
  const groups = [
    { key: 'deliver', title: 'Cần giao', icon: 'truck-delivery-outline', empty: 'Chưa có đơn cần giao.', data: toDeliver },
    { key: 'redeliver', title: 'Chờ giao bù', icon: 'truck-alert-outline', empty: 'Không có đơn chờ giao bù.', data: redeliver },
  ];

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: SCREEN_PADDING, paddingBottom: 32, gap: 10 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <Txt v="display">Việc của tôi</Txt>
      <Txt v="small" color={colors.inkSoft}>{`${orders.length} đơn · ${visits.length} lịch kiểm tra lỗi`}</Txt>
      {!!error && <Txt v="small" color={colors.danger}>{error}</Txt>}
      {loading && !orders.length && !visits.length && <Skeleton style={{ height: 110, borderRadius: radius.card }} />}

      {groups.map((group) => (
        <View key={group.key} style={{ gap: 10 }}>
          <View style={s.section}><Icon name={group.icon} size={19} color={colors.primary} /><Txt v="subtitle">{`${group.title} (${group.data.length})`}</Txt></View>
          {group.data.length ? group.data.map((order) => (
            <OrderTask key={order.id} order={order} onPress={() => navigation.navigate('StaffOrder', { id: order.id })} />
          )) : <Txt v="small" color={colors.inkMuted}>{group.empty}</Txt>}
        </View>
      ))}

      <View style={s.section}><Icon name="wrench-outline" size={19} color={colors.primary} /><Txt v="subtitle">{`Kiểm tra lỗi (${visits.length})`}</Txt></View>
      {visits.length ? visits.map((request) => (
        <SupportCard key={request.id} request={request} showCustomer onPress={() => navigation.navigate('SupportDetail', { id: request.id })} />
      )) : <Txt v="small" color={colors.inkMuted}>Không có lịch kiểm tra lỗi.</Txt>}
    </ScrollView>
  );
}

// Chi tiết một đơn được giao cho nhân viên
export function StaffOrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const ops = useManagedOrder(route.params?.id);
  const { order, loading, error, reload } = ops;

  const header = (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      <IconButton icon="chevron-left" iconSize={26} label="Quay lại" onPress={() => navigation.goBack()} />
      <Txt v="title" style={{ flex: 1 }} numberOfLines={1}>{order?.code || 'Đơn giao'}</Txt>
    </View>
  );

  if (!order) {
    return (
      <View style={s.screen}>
        {header}
        {loading ? <View style={{ paddingHorizontal: SCREEN_PADDING }}><Skeleton style={{ height: 160, borderRadius: radius.card }} /></View>
          : <EmptyState icon="alert-circle-outline" title="Không tải được đơn" text={error} action="Thử lại" onPress={reload} />}
      </View>
    );
  }

  return (
    <View style={s.screen}>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 40, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={s.card}>
          <Pill info={orderStatus(order.status)} />
          <Txt v="bodyStrong">{`${order.shipping.name} · ${order.shipping.phone}`}</Txt>
          <Txt v="small" color={colors.inkSoft}>{order.shipping.address}</Txt>
          <Txt v="small" color={colors.primary}>{scheduleOf(order)}</Txt>
          {!!order.installation?.note && <Txt v="small" color={colors.inkSoft}>{`Ghi chú: ${order.installation.note}`}</Txt>}
        </View>

        <View style={s.card}>
          <Txt v="subtitle">{`Hàng cần giao (${order.items.length})`}</Txt>
          {order.items.map((item) => (
            <View key={item.id || `${item.productId}:${item.selectedColor}`} style={s.row}>
              <Txt v="small" style={{ flex: 1 }}>{item.name}</Txt>
              <Txt v="caption" color={colors.inkSoft}>{`${item.selectedColor || 'Mặc định'} · SL ${item.quantity}${item.isGift ? ' · quà' : ''}`}</Txt>
            </View>
          ))}
        </View>

        <DeliveryPanel order={order} ops={ops} isAdmin={false} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING - 4, paddingBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
});
