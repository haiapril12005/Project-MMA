import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useAdminOrders, useManagedOrder, useStaffList } from '../hooks/useAdminOrders';
import DeliveryPanel from '../components/DeliveryPanel';
import { colors, radius, SCREEN_PADDING } from '../theme';
import {
  confirmAction, DEPOSIT_STATUS, DEPOSIT_STATUSES, deliveryZone, formatDateOnly, formatDateTime, formatVND,
  DEPOSIT_THRESHOLD, ORDER_STATUS, ORDER_STATUSES, orderStatus, paymentLabel,
} from '../utils';
import { Button, Chip, EmptyState, Field, Icon, IconButton, Skeleton, Txt } from '../components/ui';

const PENDING_CANCEL = 'pending_cancel';

const FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: PENDING_CANCEL, label: 'Yêu cầu hủy' },
  ...Object.keys(ORDER_STATUSES).map((key) => ({ key, label: ORDER_STATUSES[key].label })),
];

// Bước admin bấm trước khi xuất kho; từ "Xuất kho" trở đi nằm trong DeliveryPanel (admin và nhân viên dùng chung)
const NEXT_STEPS = {
  pending_confirmation: [{ status: ORDER_STATUS.CONFIRMED, label: 'Xác nhận đơn', icon: 'check-circle-outline' }],
  confirmed: [{ status: ORDER_STATUS.PREPARING, label: 'Bắt đầu chuẩn bị hàng', icon: 'package-variant-closed' }],
};
const STORE_CAN_CANCEL = [ORDER_STATUS.PENDING_CONFIRMATION, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING];

const hasPendingCancel = (order) => order.cancellationRequest?.status === 'pending';

function Header({ title, subtitle, navigation, hideBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      {!hideBack && <IconButton icon="chevron-left" iconSize={26} label="Quay lại" onPress={() => navigation.goBack()} />}
      <View style={{ flex: 1, paddingLeft: hideBack ? 4 : 0 }}>
        <Txt v="title" numberOfLines={1}>{title}</Txt>
        {!!subtitle && <Txt v="small" color={colors.inkSoft}>{subtitle}</Txt>}
      </View>
    </View>
  );
}

function StatusPill({ status }) {
  const info = orderStatus(status);
  return (
    <View style={[s.pill, { backgroundColor: info.bg }]}>
      <Icon name={info.icon} size={14} color={info.color} />
      <Txt v="caption" color={info.color}>{info.label}</Txt>
    </View>
  );
}

function NotAdmin({ navigation }) {
  return (
    <View style={s.screen}>
      <Header title="Quản lý đơn hàng" navigation={navigation} />
      <EmptyState icon="shield-lock-outline" title="Chỉ dành cho quản trị viên" text="Tài khoản này không có quyền quản lý đơn." action="Quay lại" onPress={() => navigation.goBack()} />
    </View>
  );
}

export function AdminOrdersScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { orders, loading, error, reload } = useAdminOrders();
  const [filter, setFilter] = useState(route.params?.status || '');

  useFocusEffect(useCallback(() => { if (user?.isAdmin) reload(); }, [user?.isAdmin, reload]));

  const counts = useMemo(() => {
    const result = { '': orders.length, [PENDING_CANCEL]: orders.filter(hasPendingCancel).length };
    orders.forEach((order) => { result[order.status] = (result[order.status] || 0) + 1; });
    return result;
  }, [orders]);
  const shown = orders.filter((order) => (!filter ? true : filter === PENDING_CANCEL ? hasPendingCancel(order) : order.status === filter));

  if (!user?.isAdmin) return <NotAdmin navigation={navigation} />;

  return (
    <View style={s.screen}>
      <Header title="Quản lý đơn hàng" subtitle={`${orders.length} đơn gần nhất`} navigation={navigation} hideBack={!!route.params?.tab} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map((item) => (
            <Chip key={item.key || 'all'} label={`${item.label} (${counts[item.key] || 0})`} selected={filter === item.key} onPress={() => setFilter(item.key)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(order) => order.id}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 32, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading && orders.length > 0} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={loading ? (
          <View style={{ gap: 10 }}>
            <Skeleton style={{ height: 96, borderRadius: radius.card }} />
            <Skeleton style={{ height: 96, borderRadius: radius.card }} />
          </View>
        ) : (
          <EmptyState
            icon={error ? 'alert-circle-outline' : 'receipt-text-outline'}
            title={error ? 'Chưa tải được đơn hàng' : 'Không có đơn nào'}
            text={error || 'Chưa có đơn ở trạng thái này.'}
            action={error ? 'Thử lại' : undefined}
            onPress={error ? reload : undefined}
          />
        )}
        renderItem={({ item: order }) => (
          <Pressable
            onPress={() => navigation.navigate('AdminOrder', { id: order.id })}
            accessibilityRole="button"
            accessibilityLabel={`Đơn ${order.code}`}
            style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
          >
            <View style={s.rowBetween}>
              <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{order.code}</Txt>
              <StatusPill status={order.status} />
            </View>
            <Txt v="small" color={colors.inkSoft}>{`${order.shipping.name} · ${order.shipping.phone}`}</Txt>
            <Txt v="caption" color={colors.inkMuted}>{`Đặt ${formatDateTime(order.createdAt)}${order.installation ? ` · giao ${formatDateOnly(order.installation.date)}` : ''}${order.assignedStaff ? ` · NV ${order.assignedStaff.name}` : ''}`}</Txt>
            <View style={s.rowBetween}>
              <Txt v="caption" color={colors.inkSoft}>{`${order.items.reduce((sum, item) => sum + item.quantity, 0)} món · ${deliveryZone(order.deliveryZone)?.label || 'Chưa có khu vực'}`}</Txt>
              <Txt v="bodyStrong" color={colors.primary}>{formatVND(order.total)}</Txt>
            </View>
            {(order.depositStatus === DEPOSIT_STATUS.AWAITING || hasPendingCancel(order)) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {order.depositStatus === DEPOSIT_STATUS.AWAITING && <Badge icon="cash-lock" text={`Chờ cọc ${formatVND(order.depositAmount)}`} />}
                {hasPendingCancel(order) && <Badge icon="file-document-edit-outline" text="Khách yêu cầu hủy" danger />}
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

function Badge({ icon, text, danger }) {
  return (
    <View style={[s.badge, danger && { backgroundColor: '#F4E1DE' }]}>
      <Icon name={icon} size={14} color={danger ? colors.danger : colors.primary} />
      <Txt v="caption" color={danger ? colors.danger : colors.primary}>{text}</Txt>
    </View>
  );
}

export function AdminOrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, notify } = useApp();
  const ops = useManagedOrder(route.params?.id);
  const { order, loading, error, reload, busy, updateStatus, markDepositPaid, reviewCancellation } = ops;
  const staffList = useStaffList(!!user?.isAdmin);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState('');

  if (!user?.isAdmin) return <NotAdmin navigation={navigation} />;

  if (!order) {
    return (
      <View style={s.screen}>
        <Header title="Chi tiết đơn" navigation={navigation} />
        {loading ? (
          <View style={{ paddingHorizontal: SCREEN_PADDING, gap: 10 }}>
            <Skeleton style={{ height: 120, borderRadius: radius.card }} />
            <Skeleton style={{ height: 160, borderRadius: radius.card }} />
          </View>
        ) : (
          <EmptyState icon="alert-circle-outline" title="Không tải được đơn" text={error} action="Thử lại" onPress={reload} />
        )}
      </View>
    );
  }

  const act = async (action, successText) => {
    setActionError('');
    try {
      await action();
      notify(successText);
    } catch (e) {
      setActionError(e.message);
    }
  };
  const awaitingDeposit = order.depositStatus === DEPOSIT_STATUS.AWAITING;
  const pendingCancel = hasPendingCancel(order);
  // Đơn chờ cọc: nút "Đã nhận cọc – duyệt đơn" thay cho nút "Xác nhận đơn"
  const steps = (NEXT_STEPS[order.status] || []).filter((step) => !(awaitingDeposit && step.status === ORDER_STATUS.CONFIRMED));
  const depositInfo = DEPOSIT_STATUSES[order.depositStatus];
  const zone = deliveryZone(order.deliveryZone);
  const history = order.statusHistory?.length ? order.statusHistory : [{ status: order.status, at: order.createdAt }];

  const askStoreCancel = () => confirmAction({
    title: 'Hủy đơn',
    message: `Cửa hàng hủy đơn ${order.code}? Kho sẽ được cộng lại${order.depositStatus === DEPOSIT_STATUS.PAID ? ' và tiền cọc chuyển sang hoàn cọc' : ''}.`,
    confirmText: 'Hủy đơn',
    destructive: true,
    onConfirm: () => act(() => updateStatus(ORDER_STATUS.CANCELLED), 'Đã hủy đơn.'),
  });

  return (
    <View style={s.screen}>
      <Header title={order.code} subtitle={`Đặt ${formatDateTime(order.createdAt)}`} navigation={navigation} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={[s.card, { alignItems: 'flex-start' }]}>
          <StatusPill status={order.status} />
          <Txt v="title" color={colors.primary}>{formatVND(order.total)}</Txt>
          <Txt v="small" color={colors.inkSoft}>{`${paymentLabel(order.paymentMethod)} · ${order.paymentStatus === 'paid' ? 'đã thu đủ' : 'chưa thu đủ'}`}</Txt>
          {order.depositAmount > 0 && !!depositInfo && (
            <Txt v="small" color={depositInfo.color}>{`Cọc ${formatVND(order.depositAmount)} · ${depositInfo.label}`}</Txt>
          )}
        </View>

        {/* Thao tác của cửa hàng */}
        <Txt v="subtitle" style={s.sectionTitle}>Thao tác</Txt>
        <View style={s.card}>
          {awaitingDeposit && (
            <Button
              title={`Đã nhận cọc ${formatVND(order.depositAmount)} – duyệt đơn`}
              icon="cash-check"
              loading={busy === 'deposit'}
              onPress={() => act(markDepositPaid, order.status === ORDER_STATUS.PENDING_CONFIRMATION ? 'Đã nhận cọc, đơn chuyển sang "Đã xác nhận".' : 'Đã ghi nhận tiền cọc.')}
            />
          )}
          {pendingCancel && (
            <View style={s.cancelBox}>
              <Txt v="bodyStrong">Khách yêu cầu hủy đơn</Txt>
              {!!order.cancellationRequest.reasonDetail && <Txt v="small" color={colors.inkSoft}>{order.cancellationRequest.reasonDetail}</Txt>}
              <Txt v="caption" color={colors.inkMuted}>{`Gửi lúc ${formatDateTime(order.cancellationRequest.createdAt)}`}</Txt>
              <Field label="Ghi chú gửi khách (không bắt buộc)" value={note} onChangeText={setNote} maxLength={500} placeholder="Ví dụ: hàng đã đóng gói, không thể hủy" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Từ chối" variant="outline" size="sm" style={{ flex: 1 }} loading={busy === 'reject'} onPress={() => act(() => reviewCancellation(false, note), 'Đã từ chối yêu cầu hủy.')} />
                <Button title="Đồng ý hủy" variant="danger" size="sm" style={{ flex: 1 }} loading={busy === 'approve'} onPress={() => act(() => reviewCancellation(true, note), 'Đã hủy đơn theo yêu cầu.')} />
              </View>
            </View>
          )}
          {steps.map((step) => (
            <Button
              key={step.status}
              title={step.label}
              icon={step.icon}
              variant={step.variant || 'primary'}
              loading={busy === step.status}
              onPress={() => act(() => updateStatus(step.status), `Đã chuyển sang "${orderStatus(step.status).label}".`)}
            />
          ))}
          {awaitingDeposit && order.status === ORDER_STATUS.PENDING_CONFIRMATION && (
            <Txt v="caption" color={colors.inkMuted}>{`Đơn từ ${formatVND(DEPOSIT_THRESHOLD)} cần cọc 30%.`} Kiểm tra tài khoản nhận được tiền (nội dung "COC {order.code.replace(/-/g, '')}") rồi bấm "Đã nhận cọc" để duyệt đơn.</Txt>
          )}
          {STORE_CAN_CANCEL.includes(order.status) && (
            <Button title="Cửa hàng hủy đơn" icon="close-circle-outline" variant="danger" loading={busy === ORDER_STATUS.CANCELLED} onPress={askStoreCancel} />
          )}
          {!steps.length && !STORE_CAN_CANCEL.includes(order.status) && !awaitingDeposit && !pendingCancel && (
            <Txt v="small" color={colors.inkSoft}>
              {[ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.status) ? 'Đơn đã kết thúc, không còn thao tác.' : 'Các bước giao hàng nằm ở mục "Giao hàng" bên dưới.'}
            </Txt>
          )}
          {!!actionError && <Txt v="small" color={colors.danger}>{actionError}</Txt>}
        </View>

        {![ORDER_STATUS.PENDING_CONFIRMATION, ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED].includes(order.status) && (
          <>
            <Txt v="subtitle" style={s.sectionTitle}>Giao hàng</Txt>
            <DeliveryPanel order={order} ops={ops} isAdmin staffList={staffList} />
          </>
        )}

        <Txt v="subtitle" style={s.sectionTitle}>Khách hàng và lịch giao</Txt>
        <View style={s.card}>
          <Info icon="account-outline" text={`${order.shipping.name} · ${order.shipping.phone}`} />
          <Info icon="map-marker-outline" text={order.shipping.address} />
          {!!zone && <Info icon={zone.icon} text={`${zone.label} · phí ${order.shippingFee ? formatVND(order.shippingFee) : 'miễn phí'}`} />}
          {!!order.installation && <Info icon="calendar-clock" text={`${formatDateOnly(order.installation.date)} · ${order.installation.timeSlot}`} />}
          {!!order.installation?.note && <Info icon="note-text-outline" text={order.installation.note} />}
        </View>

        <Txt v="subtitle" style={s.sectionTitle}>{`Sản phẩm (${order.items.length})`}</Txt>
        <View style={s.card}>
          {order.items.map((item) => (
            <View key={`${item.productId}:${item.selectedColor}`} style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Txt v="small" numberOfLines={2}>{item.name}</Txt>
                <Txt v="caption" color={colors.inkSoft}>{`${item.selectedColor || 'Mặc định'} · SL ${item.quantity}${item.isGift ? ' · Quà tặng' : ''}`}</Txt>
              </View>
              <Txt v="small" color={item.isGift ? colors.success : colors.ink}>{item.isGift ? 'Tặng' : formatVND(item.unitPrice * item.quantity)}</Txt>
            </View>
          ))}
        </View>

        <Txt v="subtitle" style={s.sectionTitle}>Lịch sử trạng thái</Txt>
        <View style={s.card}>
          {history.map((event) => (
            <View key={`${event.status}:${event.at}`} style={s.rowBetween}>
              <Txt v="small" color={orderStatus(event.status).color}>{orderStatus(event.status).label}</Txt>
              <Txt v="caption" color={colors.inkMuted}>{formatDateTime(event.at)}</Txt>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Info({ icon, text }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Txt v="small" style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING - 4, paddingBottom: 12 },
  filterRow: { gap: 8, paddingHorizontal: SCREEN_PADDING, paddingBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.primarySoft },
  sectionTitle: { marginTop: 20, marginBottom: 10 },
  cancelBox: { gap: 8, padding: 12, borderRadius: radius.input, backgroundColor: '#FBF1EE' },
});
