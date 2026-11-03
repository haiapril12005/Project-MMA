import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, SCREEN_PADDING, shadow } from '../theme';
import {
  CANCELLATION_STATUS,
  DELIVERY_ZONES,
  DEPOSIT_STATUS,
  DEPOSIT_STATUSES,
  deliveryZone as findDeliveryZone,
  depositFor,
  earliestInstallationDate,
  formatDateOnly,
  formatDateTime,
  formatVND,
  INSTALLATION_TIME_SLOTS,
  installationDateOptions,
  isValidISODate,
  ORDER_STATUS,
  orderStatus,
  PAYMENT_METHOD,
  PAYMENT_METHODS,
  paymentLabel,
  warrantyEndDate,
} from '../utils';
import { Button, EmptyState, Field, Icon, IconButton, ProductImage, Skeleton, Txt } from '../components/ui';
import DemoQR from '../components/DemoQR';

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
const isAutoCancelled = (request) => request?.status === CANCELLATION_STATUS.APPROVED && String(request.storeNote || '').startsWith(AUTO_CANCEL_NOTE_PREFIX);
const reorderResultMessage = (result) => {
  const skipped = result.issues.filter((issue) => issue.addedQuantity === 0).length;
  const limited = result.issues.filter((issue) => issue.reason === 'quantity_limited').length;
  if (!result.addedQuantity) {
    if (result.issues.some((issue) => issue.reason === 'color_unavailable')) return 'Không thể mua lại vì màu đã chọn trong đơn cũ không còn.';
    if (result.issues.some((issue) => ['out_of_stock', 'cart_at_limit'].includes(issue.reason))) return 'Không còn sản phẩm nào có thể thêm vào giỏ.';
    return 'Không có sản phẩm phù hợp để mua lại.';
  }
  const details = [];
  if (skipped) details.push(`bỏ qua ${skipped} mục không còn phù hợp`);
  if (limited) details.push(`${limited} mục được giới hạn số lượng`);
  return `Đã thêm ${result.addedQuantity} sản phẩm vào giỏ${details.length ? `; ${details.join(', ')}` : ''}.`;
};

const CANCELLATION_STATUSES = {
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

// Khung chuyển khoản tiền cọc: mã QR minh họa + số tiền + nội dung chuyển khoản
function DepositPayment({ order }) {
  const transferNote = `COC ${order.code.replace(/-/g, '')}`;
  return (
    <View style={s.depositBox}>
      <Txt v="subtitle">Chuyển khoản tiền cọc</Txt>
      <Txt v="small" color={colors.inkSoft} style={{ textAlign: 'center' }}>Quét mã bằng ứng dụng ngân hàng để cọc 30% giá trị đơn.</Txt>
      <DemoQR value={transferNote} />
      <Txt v="caption" color={colors.inkMuted}>Mã QR minh họa (bản demo)</Txt>
      <View style={{ alignSelf: 'stretch', gap: 6 }}>
        <SummaryLine label="Số tiền cọc" value={formatVND(order.depositAmount)} color={colors.primary} strong />
        <SummaryLine label="Nội dung chuyển khoản" value={transferNote} />
      </View>
      <View style={[s.infoBox, { marginTop: 4, alignSelf: 'stretch' }]}>
        <Icon name="information-outline" color={colors.primary} />
        <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>Khi cửa hàng xác nhận đã nhận cọc, đơn sẽ tự chuyển sang "Đã xác nhận" và được chuẩn bị giao.</Txt>
      </View>
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

function CancellationPill({ value, style }) {
  const info = CANCELLATION_STATUSES[value] || CANCELLATION_STATUSES.pending;
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
  const instant = order?.status === ORDER_STATUS.PENDING_CONFIRMATION;
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
  const { user, products, placeOrder, updateProfile } = useApp();
  // Có buyNow = đến từ nút "Mua ngay" ở trang chi tiết: chỉ đặt 1 món, không lấy giỏ hàng
  const buyNow = route?.params?.buyNow || null;
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', address: user?.address || '' });
  const [saveAsDefault, setSaveAsDefault] = useState(!user?.phone || !user?.address);
  const [installationDate, setInstallationDate] = useState(earliestInstallationDate());
  const [installationTimeSlot, setInstallationTimeSlot] = useState('');
  const dateOptions = useMemo(() => installationDateOptions(14), []);
  const [installationNote, setInstallationNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD.COD);
  const [zoneKey, setZoneKey] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => (buyNow ? [buyNow] : (user?.cart || [])).map((c) => {
    const product = products.find((p) => p.id === String(c.productId));
    return product ? { ...c, product, selectedColor: c.selectedColor || product.color?.[0] || '' } : null;
  }).filter(Boolean), [buyNow, user?.cart, products]);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const itemsTotal = items.reduce((sum, i) => sum + Math.round(i.product.price * (1 - i.product.percentOff)) * i.quantity, 0);
  const discount = subtotal - itemsTotal;
  const zone = findDeliveryZone(zoneKey);
  const shippingFee = zone?.fee || 0;
  const total = itemsTotal + shippingFee;
  const deposit = depositFor(total);

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
    if (!isValidISODate(installationDate) || installationDate < earliestInstallationDate()) {
      nextErrors.installationDate = `Chọn ngày từ ${formatDateOnly(earliestInstallationDate())}.`;
    }
    if (!zone) nextErrors.zone = 'Chọn khu vực giao hàng.';
    if (!INSTALLATION_TIME_SLOTS.some((slot) => slot.key === installationTimeSlot)) {
      nextErrors.installationTimeSlot = 'Chọn khung giờ giao và lắp đặt.';
    }
    if (installationNote.trim().length > 500) nextErrors.installationNote = 'Ghi chú không được vượt quá 500 ký tự.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true); setFormError('');
    try {
      const order = await placeOrder({
        shipping: { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() },
        paymentMethod,
        deliveryZone: zoneKey,
        installation: {
          date: installationDate,
          timeSlot: installationTimeSlot,
          note: installationNote.trim(),
        },
        buyNowItem: buyNow ? { productId: items[0].product.id, selectedColor: items[0].selectedColor, quantity: items[0].quantity } : null,
      });
      if (saveAsDefault) {
        await updateProfile({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() });
      }
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
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: 230 + insets.bottom }}>
        <SectionTitle icon="map-marker-outline" title="Thông tin nhận hàng" />
        <View style={s.card}>
          <Field label="Tên người nhận" value={form.name} onChangeText={set('name')} error={errors.name} placeholder="Nguyễn Văn An" />
          <Field label="Số điện thoại" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" placeholder="0901 234 567" />
          <Field label="Địa chỉ giao hàng" value={form.address} onChangeText={set('address')} error={errors.address} multiline placeholder="Số nhà, đường, phường, quận, tỉnh/thành" />
          <Pressable
            onPress={() => setSaveAsDefault((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: saveAsDefault }}
            style={s.saveAddressRow}
          >
            <Icon name={saveAsDefault ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={saveAsDefault ? colors.primary : colors.inkMuted} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong" style={{ fontSize: 14 }}>Lưu làm thông tin nhận hàng mặc định</Txt>
              <Txt v="caption" color={colors.inkMuted}>Lần đặt hàng sau sẽ tự động điền thông tin này.</Txt>
            </View>
          </Pressable>
        </View>

        <SectionTitle icon="truck-delivery-outline" title="Khu vực giao và lắp đặt" />
        <View style={{ gap: 10 }}>
          {DELIVERY_ZONES.map((item) => {
            const selected = zoneKey === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => { setZoneKey(item.key); setErrors((current) => ({ ...current, zone: undefined })); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={item.label}
                style={[s.scheduleOption, selected && s.scheduleOptionOn]}
              >
                <View style={[s.paymentIcon, selected && { backgroundColor: colors.primary }]}><Icon name={item.icon} color={selected ? colors.onPrimary : colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">{item.label}</Txt>
                  <Txt v="small" color={item.fee ? colors.inkSoft : colors.success}>{item.fee ? `Phí giao và lắp đặt ${formatVND(item.fee)}` : 'Miễn phí giao và lắp đặt'}</Txt>
                </View>
                <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} color={selected ? colors.primary : colors.inkMuted} />
              </Pressable>
            );
          })}
          {!!errors.zone && <Txt v="small" color={colors.danger}>{errors.zone}</Txt>}
        </View>

        <SectionTitle icon="calendar-clock" title="Lịch giao và lắp đặt" />
        <View style={s.card}>
          <View style={{ gap: 8 }}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>Ngày giao và lắp đặt</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {dateOptions.map((option) => {
                const selected = installationDate === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => { setInstallationDate(option.value); setErrors((current) => ({ ...current, installationDate: undefined })); }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={formatDateOnly(option.value)}
                    style={[s.dateChip, selected && s.dateChipOn]}
                  >
                    <Txt v="caption" color={selected ? colors.onPrimary : colors.inkSoft}>{option.weekday}</Txt>
                    <Txt v="bodyStrong" color={selected ? colors.onPrimary : colors.ink}>{option.label}</Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Txt v="small" color={errors.installationDate ? colors.danger : colors.inkSoft}>
              {errors.installationDate || `Đã chọn: ${formatDateOnly(installationDate)}`}
            </Txt>
          </View>
          <Txt v="bodyStrong" style={{ fontSize: 14 }}>Khung giờ lắp đặt</Txt>
          <View style={{ gap: 10 }}>
            {INSTALLATION_TIME_SLOTS.map((slot) => {
              const selected = installationTimeSlot === slot.key;
              return (
                <Pressable
                  key={slot.key}
                  onPress={() => { setInstallationTimeSlot(slot.key); setErrors((current) => ({ ...current, installationTimeSlot: undefined })); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[s.scheduleOption, selected && s.scheduleOptionOn]}
                >
                  <View style={[s.paymentIcon, selected && { backgroundColor: colors.primary }]}><Icon name={slot.icon} color={selected ? colors.onPrimary : colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong">{slot.label}</Txt>
                    <Txt v="small" color={colors.inkSoft}>{slot.note}</Txt>
                  </View>
                  <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} color={selected ? colors.primary : colors.inkMuted} />
                </Pressable>
              );
            })}
          </View>
          {!!errors.installationTimeSlot && <Txt v="small" color={colors.danger}>{errors.installationTimeSlot}</Txt>}
          <Field
            label="Ghi chú lắp đặt (không bắt buộc)"
            value={installationNote}
            onChangeText={(value) => { setInstallationNote(value); setErrors((current) => ({ ...current, installationNote: undefined })); }}
            error={errors.installationNote}
            helper={`${installationNote.length}/500 ký tự`}
            maxLength={500}
            multiline
            placeholder="Ví dụ: gọi trước khi đến, chung cư cần đăng ký thang máy..."
          />
          <View style={s.scheduleNotice}>
            <Icon name="information-outline" size={20} color={colors.primary} />
            <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>Đây là thời gian mong muốn. Cửa hàng sẽ liên hệ xác nhận lịch trước khi giao.</Txt>
          </View>
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

        {deposit > 0 && (
          <View style={s.infoBox}>
            <Icon name="cash-lock" color={colors.primary} />
            <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>
              Đơn từ {formatVND(20000000)} cần đặt cọc 30% ({formatVND(deposit)}) bằng chuyển khoản. Cửa hàng chỉ xác nhận đơn sau khi nhận cọc; phần còn lại thanh toán theo phương thức bạn chọn.
            </Txt>
          </View>
        )}

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
        <SummaryLine
          label="Giao hàng và lắp đặt"
          value={!zone ? 'Chọn khu vực' : shippingFee ? formatVND(shippingFee) : 'Miễn phí'}
          color={!zone ? colors.inkMuted : shippingFee ? colors.ink : colors.success}
        />
        <SummaryLine label="Tổng thanh toán" value={formatVND(total)} color={colors.primary} strong />
        {deposit > 0 && <SummaryLine label="Đặt cọc trước (30%)" value={formatVND(deposit)} color={colors.primary} />}
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
        {!!order.installation && <SummaryLine label="Lịch lắp đặt" value={`${formatDateOnly(order.installation.date)} · ${order.installation.timeSlot}`} />}
        {!!order.deliveryZone && <SummaryLine label="Khu vực giao" value={findDeliveryZone(order.deliveryZone)?.label || ''} />}
        <SummaryLine label="Tổng cộng" value={formatVND(order.total)} color={colors.primary} />
        {order.depositAmount > 0 && <SummaryLine label="Cần đặt cọc (30%)" value={formatVND(order.depositAmount)} color={colors.primary} />}
      </View>

      {order.depositStatus === DEPOSIT_STATUS.AWAITING && <DepositPayment order={order} />}

      {order.paymentMethod === PAYMENT_METHOD.BANK_TRANSFER && (
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
  const { user, orders, ordersLoading, orderError, loadOrders, reorderOrder, notify } = useApp();
  const [reorderingId, setReorderingId] = useState(null);

  const buyAgain = async (event, orderId) => {
    event?.stopPropagation?.();
    setReorderingId(orderId);
    try {
      const result = await reorderOrder(orderId);
      notify(reorderResultMessage(result));
      if (result.addedQuantity > 0) navigation.navigate('Tabs', { screen: 'Cart' });
    } catch (e) {
      notify(e.message || 'Chưa thể mua lại đơn hàng.');
    } finally {
      setReorderingId(null);
    }
  };

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
                  {/* Yêu cầu hủy đã được chấp nhận thì đơn đã là "Đã hủy", không cần nhãn thứ hai */}
                  {!!item.cancellationRequest && item.cancellationRequest.status !== CANCELLATION_STATUS.APPROVED && <CancellationPill value={item.cancellationRequest.status} />}
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
              {item.status === ORDER_STATUS.DELIVERED && (
                <Button
                  title="Mua lại"
                  icon="cart-plus"
                  size="sm"
                  variant="outline"
                  loading={reorderingId === item.id}
                  disabled={Boolean(reorderingId && reorderingId !== item.id)}
                  onPress={(event) => buyAgain(event, item.id)}
                  style={{ alignSelf: 'flex-end', marginTop: 12 }}
                />
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

export function OrderDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, orders, ordersLoading, loadOrders, requestOrderCancellation, reorderOrder, notify } = useApp();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
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
  const zone = findDeliveryZone(order.deliveryZone);
  const deliveredAt = history.find((event) => event.status === ORDER_STATUS.DELIVERED)?.at;
  const depositInfo = DEPOSIT_STATUSES[order.depositStatus];
  // Đơn "Chờ xác nhận": hủy ngay (kể cả khi đang có yêu cầu cũ còn chờ duyệt). Đơn "Đã xác nhận": gửi yêu cầu.
  const instantCancel = order.status === ORDER_STATUS.PENDING_CONFIRMATION && (!cancellation || cancellation.status === CANCELLATION_STATUS.PENDING);
  const canRequestCancellation = instantCancel || (!cancellation && order.status === ORDER_STATUS.CONFIRMED);
  const buyAgain = async () => {
    setReordering(true);
    try {
      const result = await reorderOrder(order.id);
      notify(reorderResultMessage(result));
      if (result.addedQuantity > 0) navigation.navigate('Tabs', { screen: 'Cart' });
    } catch (e) {
      notify(e.message || 'Chưa thể mua lại đơn hàng.');
    } finally {
      setReordering(false);
    }
  };
  return (
    <View style={s.screen}>
      <ScreenHeader title="Chi tiết đơn" subtitle={order.code} navigation={navigation} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 36 }}
        refreshControl={<RefreshControl refreshing={ordersLoading} onRefresh={() => user && loadOrders(user.id)} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={s.heroStatus}>
          <StatusPill value={order.status} style={{ alignSelf: 'center' }} />
          <Txt v="small" color={colors.inkSoft} style={{ marginTop: 8 }}>Cập nhật {formatDateTime(order.updatedAt || order.createdAt)}</Txt>
        </View>

        {order.depositStatus === DEPOSIT_STATUS.AWAITING && <DepositPayment order={order} />}

        {order.status === ORDER_STATUS.DELIVERED && (
          <View style={s.reorderBox}>
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong">Bạn muốn mua lại đơn này?</Txt>
              <Txt v="small" color={colors.inkSoft}>Sản phẩm hợp lệ sẽ được thêm vào giỏ theo màu cũ và giá hiện tại.</Txt>
            </View>
            <Button title="Mua lại" icon="cart-plus" size="sm" loading={reordering} onPress={buyAgain} />
          </View>
        )}

        {!!cancellation && (
          <>
            <SectionTitle icon="file-document-edit-outline" title="Yêu cầu hủy đơn" />
            <View style={s.card}>
              {!isAutoCancelled(cancellation) && <CancellationPill value={cancellation.status} />}
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
          <InfoRow icon="map-marker-outline" label="Địa chỉ" value={order.shipping.address} last={!zone} />
          {!!zone && <InfoRow icon={zone.icon} label="Khu vực giao" value={zone.label} last />}
        </View>

        {!!order.installation && (
          <>
            <SectionTitle icon="calendar-clock" title="Lịch giao và lắp đặt" />
            <View style={s.card}>
              <InfoRow icon="calendar" label="Ngày mong muốn" value={formatDateOnly(order.installation.date)} />
              <InfoRow icon="clock-outline" label="Khung giờ" value={order.installation.timeSlot} last={!order.installation.note} />
              {!!order.installation.note && <InfoRow icon="note-text-outline" label="Ghi chú" value={order.installation.note} last />}
              <View style={s.scheduleNotice}>
                <Icon name="information-outline" size={20} color={colors.primary} />
                <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>Cửa hàng sẽ liên hệ xác nhận lịch trước khi giao.</Txt>
              </View>
            </View>
          </>
        )}

        <SectionTitle icon="package-variant-closed" title={`Sản phẩm (${order.items.length})`} />
        <View style={s.card}>
          {order.items.map((item, index) => (
            <Pressable
              key={`${item.productId}:${item.selectedColor}`}
              onPress={() => navigation.push('Detail', { id: item.productId, color: item.selectedColor })}
              accessibilityRole="button"
              accessibilityLabel={`Xem chi tiết ${item.name}`}
              style={({ pressed }) => [s.checkoutItem, index < order.items.length - 1 && s.divider, pressed && { opacity: 0.7 }]}
            >
              <ProductImage uri={item.uri} category={item.category} iconSize={25} style={s.checkoutImage} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14 }}>{item.name}</Txt>
                <Txt v="caption" color={colors.inkSoft}>{item.selectedColor || 'Mặc định'} · SL {item.quantity}</Txt>
                <Txt v="caption" color={colors.success}>
                  {!item.warrantyMonths
                    ? 'Không bảo hành'
                    : deliveredAt
                      ? `Bảo hành đến ${warrantyEndDate(deliveredAt, item.warrantyMonths)}`
                      : `Bảo hành ${item.warrantyMonths} tháng kể từ ngày lắp đặt`}
                </Txt>
              </View>
              <Txt v="price" color={colors.primary} style={{ fontSize: 14 }}>{formatVND(item.unitPrice * item.quantity)}</Txt>
            </Pressable>
          ))}
        </View>

        <SectionTitle icon="credit-card-outline" title="Thanh toán" />
        <View style={s.card}>
          <SummaryLine label="Phương thức" value={paymentLabel(order.paymentMethod)} />
          <SummaryLine label="Tạm tính" value={formatVND(order.subtotal)} />
          {order.discount > 0 && <SummaryLine label="Giảm giá" value={`-${formatVND(order.discount)}`} color={colors.success} />}
          <SummaryLine label="Giao hàng và lắp đặt" value={order.shippingFee > 0 ? formatVND(order.shippingFee) : 'Miễn phí'} color={order.shippingFee > 0 ? colors.ink : colors.success} />
          <View style={[s.divider, { marginVertical: 10 }]} />
          <SummaryLine label="Tổng cộng" value={formatVND(order.total)} color={colors.primary} strong />
          {order.depositAmount > 0 && <SummaryLine label="Đặt cọc (30%)" value={formatVND(order.depositAmount)} />}
          {order.depositAmount > 0 && !!depositInfo && <SummaryLine label="Tình trạng cọc" value={depositInfo.label} color={depositInfo.color} />}
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
  saveAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.bg, paddingTop: 12 },
  dateChip: { width: 64, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  dateChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  scheduleOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: 12, backgroundColor: colors.surface },
  scheduleOptionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  scheduleNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.input, padding: 12 },
  checkoutItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  checkoutImage: { width: 62, height: 62, borderRadius: radius.img - 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.bg, paddingBottom: 14 },
  checkoutBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, paddingHorizontal: SCREEN_PADDING, paddingTop: 14, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, ...shadow, shadowOffset: { width: 0, height: -4 } },
  summaryLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  successIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  depositBox: { alignItems: 'center', gap: 10, marginTop: 16, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primarySoft },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: colors.primarySoft, borderRadius: radius.input, padding: 14, marginTop: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  orderCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16 },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  orderPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  orderImage: { width: 58, height: 58, borderRadius: radius.img - 4 },
  heroStatus: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, alignItems: 'center' },
  cancelBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8EAE6', borderRadius: radius.card, padding: 16, marginTop: 14 },
  reorderBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft, borderRadius: radius.card, padding: 16, marginTop: 14 },
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
