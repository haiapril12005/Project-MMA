import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, SCREEN_PADDING, shadow } from '../theme';
import {
  formatDateTime,
  formatVND,
  orderStatus,
  PAYMENT_METHODS,
  paymentLabel,
} from '../utils';
import { Button, EmptyState, Field, Icon, IconButton, ProductImage, Skeleton, Txt } from '../components/ui';

const CANCELLATION_REASONS = [
  { key: 'wrong_item', label: 'Đặt nhầm sản phẩm, màu hoặc số lượng' },
  { key: 'change_address', label: 'Muốn thay đổi địa chỉ nhận hàng' },
  { key: 'order_issue', label: 'Đơn hàng hoặc thông tin bị lỗi' },
  { key: 'no_longer_needed', label: 'Không còn nhu cầu' },
  { key: 'found_better', label: 'Tìm được sản phẩm khác phù hợp hơn' },
  { key: 'other', label: 'Khác' },
];

const cancellationReasonLabel = (key) => CANCELLATION_REASONS.find((item) => item.key === key)?.label || 'Lý do khác';

// Ghi chú database tự gắn khi đơn được hủy ngay lúc còn "Chờ xác nhận" (xem migration 202611020001_instant_cancel.sql)
const AUTO_CANCEL_NOTE_PREFIX = 'Tự động hủy';
const isAutoCancelled = (request) => request?.status === 'approved' && String(request.storeNote || '').startsWith(AUTO_CANCEL_NOTE_PREFIX);

const CANCELLATION_STATUSES = {
  auto: { label: 'Đã hủy ngay', color: '#2F7250', bg: '#DCEEE3', icon: 'check-circle-outline' },
  pending: { label: 'Đang chờ duyệt hủy', color: '#9A5B2E', bg: '#F6E7D8', icon: 'clock-outline' },
  approved: { label: 'Cửa hàng đã chấp nhận', color: '#2F7250', bg: '#DCEEE3', icon: 'check-circle-outline' },
  rejected: { label: 'Cửa hàng đã từ chối', color: '#A34E43', bg: '#F4E1DE', icon: 'close-circle-outline' },
};

function ScreenHeader({ title, subtitle, navigation, closeToHome = false }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      <IconButton
        icon={closeToHome ? 'close' : 'chevron-left'}
        iconSize={closeToHome ? 22 : 26}
        label={closeToHome ? 'Đóng' : 'Quay lại'}
        onPress={() => (closeToHome ? navigation.navigate('Tabs', { screen: 'Home' }) : navigation.goBack())}
      />
      <View style={{ flex: 1 }}>
        <Txt v="title">{title}</Txt>
        {!!subtitle && <Txt v="small" color={colors.inkSoft}>{subtitle}</Txt>}
      </View>
    </View>
  );
}

function SummaryLine({ label, value, color = colors.ink, strong = false }) {
  return (
    <View style={s.summaryLine}>
      <Txt v={strong ? 'subtitle' : 'small'} color={strong ? colors.ink : colors.inkSoft}>{label}</Txt>
      <Txt v={strong ? 'title' : 'small'} color={color}>{value}</Txt>
    </View>
  );
}

function StatusPill({ value, style }) {
  const info = orderStatus(value);
  return (
    <View style={[s.statusPill, { backgroundColor: info.bg }, style]}>
      <Icon name={info.icon} size={15} color={info.color} />
      <Txt v="caption" color={info.color}>{info.label}</Txt>
    </View>
  );
}

function CancellationPill({ value, auto = false, style }) {
  const info = auto ? CANCELLATION_STATUSES.auto : (CANCELLATION_STATUSES[value] || CANCELLATION_STATUSES.pending);
  return (
    <View style={[s.statusPill, { backgroundColor: info.bg }, style]}>
      <Icon name={info.icon} size={15} color={info.color} />
      <Txt v="caption" color={info.color}>{info.label}</Txt>
    </View>
  );
}

function CancelOrderModal({ visible, order, onClose, onSubmit }) {
  const insets = useSafeAreaInsets();
  // Đơn chưa được cửa hàng xác nhận thì hủy ngay, không cần chờ duyệt
  const instant = order?.status === 'pending_confirmation';
  const [reasonCode, setReasonCode] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setReasonCode('');
      setReasonDetail('');
      setError('');
      setBusy(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!reasonCode) {
      setError('Chọn một lý do hủy đơn.');
      return;
    }
    if (reasonCode === 'other' && !reasonDetail.trim()) {
      setError('Nhập lý do cụ thể khi chọn “Khác”.');
      return;
    }
    if (reasonDetail.trim().length > 1000) {
      setError('Nội dung lý do không được vượt quá 1000 ký tự.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ orderId: order.id, reasonCode, reasonDetail: reasonDetail.trim() });
      onClose();
    } catch (e) {
      setError(e.message || 'Chưa gửi được yêu cầu hủy đơn.');
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <View style={s.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onClose()} accessibilityLabel="Đóng hộp yêu cầu hủy đơn" />
        <View style={[s.modalSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={s.modalHandle} />
          <View style={s.modalHead}>
            <View style={{ flex: 1 }}>
              <Txt v="title">{instant ? 'Hủy đơn hàng' : 'Yêu cầu hủy đơn'}</Txt>
              <Txt v="small" color={colors.inkSoft}>{order?.code}</Txt>
            </View>
            <IconButton icon="close" onPress={() => !busy && onClose()} label="Đóng" bg={colors.sunken} />
          </View>

          <Txt v="small" color={colors.inkSoft} style={{ marginBottom: 12 }}>
            {instant
              ? 'Đơn chưa được cửa hàng xác nhận nên sẽ được hủy ngay. Chọn lý do để cửa hàng hiểu nhu cầu của bạn.'
              : 'Đơn đã được cửa hàng xác nhận. Cửa hàng sẽ xem xét yêu cầu, đơn chỉ được hủy sau khi cửa hàng chấp nhận.'}
          </Txt>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 330 }} contentContainerStyle={{ gap: 8 }}>
            {CANCELLATION_REASONS.map((reason) => {
              const selected = reasonCode === reason.key;
              return (
                <Pressable
                  key={reason.key}
                  onPress={() => { setReasonCode(reason.key); setError(''); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[s.reasonOption, selected && s.reasonOptionOn]}
                >
                  <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={selected ? colors.primary : colors.inkMuted} />
                  <Txt v="small" style={{ flex: 1 }}>{reason.label}</Txt>
                </Pressable>
              );
            })}
          </ScrollView>

          <Field
            label={reasonCode === 'other' ? 'Lý do cụ thể' : 'Mô tả thêm (không bắt buộc)'}
            value={reasonDetail}
            onChangeText={(value) => { setReasonDetail(value); setError(''); }}
            multiline
            placeholder={instant ? 'Nhập thêm nếu muốn' : 'Nhập thông tin để cửa hàng xem xét'}
            helper={`${reasonDetail.length}/1000 ký tự`}
            style={{ marginTop: 14 }}
          />
          {!!error && <Txt v="small" color={colors.danger} style={{ marginTop: 8 }}>{error}</Txt>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button title="Để sau" variant="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
            <Button title={instant ? 'Hủy đơn' : 'Gửi yêu cầu'} variant={instant ? 'danger' : 'primary'} loading={busy} onPress={submit} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function CheckoutScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, products, placeOrder } = useApp();
  // Có buyNow = đến từ nút "Mua ngay" ở trang chi tiết: chỉ đặt 1 món, không lấy giỏ hàng
  const buyNow = route?.params?.buyNow || null;
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', address: user?.address || '' });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => (buyNow ? [buyNow] : (user?.cart || [])).map((c) => {
    const product = products.find((p) => p.id === String(c.productId));
    return product ? { ...c, product, selectedColor: c.selectedColor || product.color?.[0] || '' } : null;
  }).filter(Boolean), [buyNow, user?.cart, products]);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const total = items.reduce((sum, i) => sum + Math.round(i.product.price * (1 - i.product.percentOff)) * i.quantity, 0);
  const discount = subtotal - total;

  const set = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError('');
  };

  const submit = async () => {
    const nextErrors = {};
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!form.name.trim()) nextErrors.name = 'Nhập tên người nhận.';
    if (phoneDigits.length < 9 || phoneDigits.length > 11) nextErrors.phone = 'Số điện thoại cần từ 9 đến 11 chữ số.';
    if (form.address.trim().length < 10) nextErrors.address = 'Nhập địa chỉ giao hàng đầy đủ.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true); setFormError('');
    try {
      const order = await placeOrder({
        shipping: { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() },
        paymentMethod,
        buyNowItem: buyNow ? { productId: items[0].product.id, selectedColor: items[0].selectedColor, quantity: items[0].quantity } : null,
      });
      navigation.replace('OrderSuccess', { id: order.id });
    } catch (e) {
      setFormError(e.message || 'Không gửi được đơn hàng. Vui lòng thử lại.');
      setBusy(false);
    }
  };

  if (!user || !items.length) {
    return (
      <View style={s.screen}>
        <ScreenHeader title="Đặt hàng" navigation={navigation} />
        <EmptyState icon="cart-outline" title="Không có sản phẩm để đặt" text={buyNow ? 'Sản phẩm này hiện không còn bán.' : 'Giỏ hàng của bạn đang trống.'} action="Quay lại mua sắm" onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={buyNow ? 'Mua ngay' : 'Đặt hàng'} subtitle={buyNow ? 'Chỉ đặt sản phẩm này, giỏ hàng giữ nguyên' : `${items.length} sản phẩm`} navigation={navigation} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: 190 + insets.bottom }}>
        <SectionTitle icon="map-marker-outline" title="Thông tin nhận hàng" />
        <View style={s.card}>
          <Field label="Tên người nhận" value={form.name} onChangeText={set('name')} error={errors.name} placeholder="Nguyễn Văn An" />
          <Field label="Số điện thoại" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" placeholder="0901 234 567" />
          <Field label="Địa chỉ giao hàng" value={form.address} onChangeText={set('address')} error={errors.address} multiline placeholder="Số nhà, đường, phường, quận, tỉnh/thành" />
        </View>

        <SectionTitle icon="credit-card-outline" title="Phương thức thanh toán" />
        <View style={{ gap: 10 }}>
          {PAYMENT_METHODS.map((method) => {
            const selected = paymentMethod === method.key;
            return (
              <Pressable
                key={method.key}
                onPress={() => setPaymentMethod(method.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={method.label}
                style={({ pressed }) => [s.payment, selected && s.paymentOn, pressed && { opacity: 0.88 }]}
              >
                <View style={[s.paymentIcon, selected && { backgroundColor: colors.primary }]}><Icon name={method.icon} color={selected ? colors.onPrimary : colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">{method.label}</Txt>
                  <Txt v="small" color={colors.inkSoft}>{method.note}</Txt>
                </View>
                <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} color={selected ? colors.primary : colors.inkMuted} />
              </Pressable>
            );
          })}
        </View>

        <SectionTitle icon="package-variant-closed" title="Sản phẩm" />
        <View style={s.card}>
          {items.map(({ product: p, quantity, selectedColor }, index) => (
            <View key={`${p.id}:${selectedColor}`} style={[s.checkoutItem, index < items.length - 1 && s.divider]}>
              <ProductImage uri={p.uri} category={p.category} iconSize={25} style={s.checkoutImage} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14 }}>{p.name}</Txt>
                <Txt v="caption" color={colors.inkSoft}>{selectedColor || 'Mặc định'} · SL {quantity}</Txt>
              </View>
              <Txt v="price" color={colors.primary} style={{ fontSize: 14 }}>{formatVND(Math.round(p.price * (1 - p.percentOff)) * quantity)}</Txt>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[s.checkoutBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <SummaryLine label="Tạm tính" value={formatVND(subtotal)} />
        {discount > 0 && <SummaryLine label="Giảm giá" value={`-${formatVND(discount)}`} color={colors.success} />}
        <SummaryLine label="Giao hàng và lắp đặt" value="Miễn phí" color={colors.success} />
        <SummaryLine label="Tổng thanh toán" value={formatVND(total)} color={colors.primary} strong />
        {!!formError && <Txt v="small" color={colors.danger} style={{ marginBottom: 8 }}>{formError}</Txt>}
        <Button title="Xác nhận đặt hàng" icon="check" loading={busy} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

export function OrderSuccessScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { orders } = useApp();
  const order = orders.find((o) => o.id === String(route.params?.id));

  if (!order) {
    return <View style={s.screen}><EmptyState icon="receipt-text-outline" title="Không tìm thấy đơn hàng" action="Xem đơn hàng" onPress={() => navigation.replace('OrderHistory')} /></View>;
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingTop: insets.top + 36, paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 32 }}>
      <View style={s.successIcon}><Icon name="check" size={46} color={colors.onPrimary} /></View>
      <Txt v="display" style={{ textAlign: 'center', marginTop: 20 }}>Đặt hàng thành công</Txt>
      <Txt v="body" color={colors.inkSoft} style={{ textAlign: 'center', marginTop: 8 }}>Cửa hàng sẽ liên hệ xác nhận trước khi giao và lắp đặt.</Txt>

      <View style={[s.card, { marginTop: 26 }]}>
        <SummaryLine label="Mã đơn hàng" value={order.code} strong />
        <View style={s.divider} />
        <SummaryLine label="Trạng thái" value={orderStatus(order.status).label} color={orderStatus(order.status).color} />
        <SummaryLine label="Thanh toán" value={paymentLabel(order.paymentMethod)} />
        <SummaryLine label="Tổng cộng" value={formatVND(order.total)} color={colors.primary} />
      </View>

      {order.paymentMethod === 'bank_transfer' && (
        <View style={s.infoBox}>
          <Icon name="information-outline" color={colors.primary} />
          <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>Đây là thanh toán mô phỏng. Cửa hàng sẽ liên hệ gửi hướng dẫn chuyển khoản.</Txt>
        </View>
      )}

      <View style={{ gap: 10, marginTop: 24 }}>
        <Button title="Xem chi tiết đơn" icon="receipt-text-outline" onPress={() => navigation.replace('OrderDetail', { id: order.id })} />
        <Button title="Tiếp tục mua sắm" variant="outline" onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} />
      </View>
    </ScrollView>
  );
}

export function OrderHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, orders, ordersLoading, orderError, loadOrders } = useApp();

  useFocusEffect(useCallback(() => {
    if (user?.id) loadOrders(user.id);
  }, [user?.id, loadOrders]));

  if (!user) {
    return (
      <View style={s.screen}>
        <ScreenHeader title="Đơn hàng của tôi" navigation={navigation} />
        <EmptyState icon="receipt-text-outline" title="Đăng nhập để xem đơn hàng" action="Đăng nhập" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScreenHeader title="Đơn hàng của tôi" subtitle={orders.length ? `${orders.length} đơn hàng` : 'Theo dõi đơn đã đặt'} navigation={navigation} />
      {ordersLoading && !orders.length ? (
        <View style={{ paddingHorizontal: SCREEN_PADDING, gap: 12 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 152, borderRadius: radius.card }} />)}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={ordersLoading} onRefresh={() => loadOrders(user.id)} tintColor={colors.primary} colors={[colors.primary]} />}
          contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 28, gap: 12, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="receipt-text-outline" title={orderError ? 'Chưa tải được đơn hàng' : 'Bạn chưa có đơn hàng'} text={orderError || 'Sau khi đặt hàng, đơn sẽ xuất hiện tại đây.'} action={orderError ? 'Thử lại' : 'Mua sắm ngay'} onPress={() => (orderError ? loadOrders() : navigation.navigate('Tabs', { screen: 'Home' }))} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('OrderDetail', { id: item.id })} accessibilityRole="button" accessibilityLabel={`Xem đơn ${item.code}`} style={({ pressed }) => [s.orderCard, pressed && { opacity: 0.86 }]}>
              <View style={s.orderHead}>
                <View>
                  <Txt v="bodyStrong">{item.code}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>{formatDateTime(item.createdAt)}</Txt>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StatusPill value={item.status} />
                  {!!item.cancellationRequest && <CancellationPill value={item.cancellationRequest.status} auto={isAutoCancelled(item.cancellationRequest)} />}
                </View>
              </View>
              <View style={s.orderPreview}>
                <ProductImage uri={item.items[0]?.uri} category={item.items[0]?.category} iconSize={24} style={s.orderImage} />
                <View style={{ flex: 1 }}>
                  <Txt v="small" numberOfLines={2}>{item.items[0]?.name}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>{item.items.length > 1 ? `và ${item.items.length - 1} sản phẩm khác` : `${item.items[0]?.selectedColor || 'Mặc định'} · SL ${item.items[0]?.quantity}`}</Txt>
                </View>
              </View>
              <View style={[s.summaryLine, { marginTop: 12 }]}>
                <Txt v="small" color={colors.inkSoft}>{item.items.reduce((sum, i) => sum + i.quantity, 0)} sản phẩm</Txt>
                <Txt v="price" color={colors.primary}>{formatVND(item.total)}</Txt>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

export function OrderDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { orders, requestOrderCancellation } = useApp();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const order = orders.find((o) => o.id === String(route.params?.id));

  if (!order) {
    return (
      <View style={s.screen}>
        <ScreenHeader title="Chi tiết đơn" navigation={navigation} />
        <EmptyState icon="receipt-text-remove-outline" title="Không tìm thấy đơn hàng" text="Đơn có thể chưa được đồng bộ. Hãy quay lại danh sách và thử tải lại." action="Quay lại" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const history = order.statusHistory?.length ? order.statusHistory : [{ status: order.status, at: order.updatedAt || order.createdAt }];
  const cancellation = order.cancellationRequest;
  // Đơn "Chờ xác nhận": hủy ngay (kể cả khi đang có yêu cầu cũ còn chờ duyệt). Đơn "Đã xác nhận": gửi yêu cầu.
  const instantCancel = order.status === 'pending_confirmation' && (!cancellation || cancellation.status === 'pending');
  const canRequestCancellation = instantCancel || (!cancellation && order.status === 'confirmed');
  return (
    <View style={s.screen}>
      <ScreenHeader title="Chi tiết đơn" subtitle={order.code} navigation={navigation} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 36 }}>
        <View style={s.heroStatus}>
          <StatusPill value={order.status} style={{ alignSelf: 'center' }} />
          <Txt v="small" color={colors.inkSoft} style={{ marginTop: 8 }}>Cập nhật {formatDateTime(order.updatedAt || order.createdAt)}</Txt>
        </View>

        {!!cancellation && (
          <>
            <SectionTitle icon="file-document-edit-outline" title="Yêu cầu hủy đơn" />
            <View style={s.card}>
              <CancellationPill value={cancellation.status} auto={isAutoCancelled(cancellation)} />
              <InfoRow icon="account-outline" label="Người yêu cầu" value="Bạn" />
              <InfoRow icon="message-text-outline" label="Lý do" value={cancellationReasonLabel(cancellation.reasonCode)} />
              {!!cancellation.reasonDetail && <InfoRow icon="text-box-outline" label="Mô tả thêm" value={cancellation.reasonDetail} />}
              <InfoRow icon="clock-outline" label="Thời gian yêu cầu" value={formatDateTime(cancellation.createdAt)} last={!cancellation.storeNote} />
              {!!cancellation.storeNote && <InfoRow icon="store-outline" label={isAutoCancelled(cancellation) ? 'Ghi chú' : 'Ghi chú của cửa hàng'} value={cancellation.storeNote} last />}
            </View>
          </>
        )}

        {canRequestCancellation && (
          <View style={s.cancelBox}>
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong">Bạn cần hủy đơn?</Txt>
              <Txt v="small" color={colors.inkSoft}>
                {instantCancel
                  ? 'Đơn chưa được cửa hàng xác nhận nên bạn có thể hủy ngay.'
                  : 'Đơn đã được xác nhận. Gửi lý do để cửa hàng xem xét trước khi chuẩn bị hàng.'}
              </Txt>
            </View>
            <Button title={instantCancel ? 'Hủy đơn' : 'Yêu cầu hủy'} size="sm" variant="danger" onPress={() => setCancelModalOpen(true)} />
          </View>
        )}

        <SectionTitle icon="timeline-check-outline" title="Theo dõi đơn hàng" />
        <View style={s.card}>
          {history.map((event, index) => {
            const info = orderStatus(event.status);
            return (
              <View key={`${event.status}:${event.at}`} style={s.timelineRow}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[s.timelineDot, { backgroundColor: info.color }]}><Icon name={info.icon} size={15} color="#fff" /></View>
                  {index < history.length - 1 && <View style={[s.timelineLine, { backgroundColor: info.color }]} />}
                </View>
                <View style={{ flex: 1, paddingBottom: index < history.length - 1 ? 18 : 0 }}>
                  <Txt v="bodyStrong" style={{ fontSize: 14 }}>{info.label}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>{formatDateTime(event.at)}</Txt>
                </View>
              </View>
            );
          })}
        </View>

        <SectionTitle icon="map-marker-outline" title="Thông tin nhận hàng" />
        <View style={s.card}>
          <InfoRow icon="account-outline" label="Người nhận" value={order.shipping.name} />
          <InfoRow icon="phone-outline" label="Số điện thoại" value={order.shipping.phone} />
          <InfoRow icon="map-marker-outline" label="Địa chỉ" value={order.shipping.address} last />
        </View>

        <SectionTitle icon="package-variant-closed" title={`Sản phẩm (${order.items.length})`} />
        <View style={s.card}>
          {order.items.map((item, index) => (
            <View key={`${item.productId}:${item.selectedColor}`} style={[s.checkoutItem, index < order.items.length - 1 && s.divider]}>
              <ProductImage uri={item.uri} category={item.category} iconSize={25} style={s.checkoutImage} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14 }}>{item.name}</Txt>
                <Txt v="caption" color={colors.inkSoft}>{item.selectedColor || 'Mặc định'} · SL {item.quantity}</Txt>
              </View>
              <Txt v="price" color={colors.primary} style={{ fontSize: 14 }}>{formatVND(item.unitPrice * item.quantity)}</Txt>
            </View>
          ))}
        </View>

        <SectionTitle icon="credit-card-outline" title="Thanh toán" />
        <View style={s.card}>
          <SummaryLine label="Phương thức" value={paymentLabel(order.paymentMethod)} />
          <SummaryLine label="Tạm tính" value={formatVND(order.subtotal)} />
          {order.discount > 0 && <SummaryLine label="Giảm giá" value={`-${formatVND(order.discount)}`} color={colors.success} />}
          <SummaryLine label="Giao hàng và lắp đặt" value="Miễn phí" color={colors.success} />
          <View style={[s.divider, { marginVertical: 10 }]} />
          <SummaryLine label="Tổng cộng" value={formatVND(order.total)} color={colors.primary} strong />
        </View>
      </ScrollView>
      <CancelOrderModal
        visible={cancelModalOpen}
        order={order}
        onClose={() => setCancelModalOpen(false)}
        onSubmit={requestOrderCancellation}
      />
    </View>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <View style={s.sectionTitle}>
      <Icon name={icon} size={19} color={colors.primary} />
      <Txt v="subtitle">{title}</Txt>
    </View>
  );
}

function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[s.infoRow, !last && s.divider]}>
      <View style={s.smallIcon}><Icon name={icon} size={18} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Txt v="caption" color={colors.inkMuted}>{label}</Txt>
        <Txt v="small">{value}</Txt>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING - 4, paddingBottom: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 14 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: 14, backgroundColor: colors.surface },
  paymentOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  paymentIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  checkoutItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  checkoutImage: { width: 62, height: 62, borderRadius: radius.img - 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.bg, paddingBottom: 14 },
  checkoutBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, paddingHorizontal: SCREEN_PADDING, paddingTop: 14, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, ...shadow, shadowOffset: { width: 0, height: -4 } },
  summaryLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  successIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: colors.primarySoft, borderRadius: radius.input, padding: 14, marginTop: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  orderCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16 },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  orderPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  orderImage: { width: 58, height: 58, borderRadius: radius.img - 4 },
  heroStatus: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, alignItems: 'center' },
  cancelBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8EAE6', borderRadius: radius.card, padding: 16, marginTop: 14 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, minHeight: 24, opacity: 0.35 },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 2 },
  smallIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(49, 36, 28, 0.42)' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: SCREEN_PADDING, paddingTop: 10 },
  modalHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 12 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  reasonOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface },
  reasonOptionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
