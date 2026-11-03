import React, { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useStaffList } from '../hooks/useAdminOrders';
import { createSupportRequest, useSupportList, useSupportRequest } from '../hooks/useSupport';
import { colors, radius, SCREEN_PADDING } from '../theme';
import {
  ASSESSMENTS, CONCLUSIONS, confirmAction, formatDateOnly, formatDateTime, formatVND, OPEN_SUPPORT_STATUSES, RESOLUTIONS,
  SUPPORT_STATUSES, supportStatus,
} from '../utils';
import { Button, Chip, EmptyState, Field, IconButton, ProductImage, QtyStepper, Skeleton, Txt } from '../components/ui';
import { DateSlotPicker, Pill, PhotoSlots, StaffContact, StaffPicker } from '../components/WorkflowParts';

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

// Thẻ tóm tắt một yêu cầu (dùng trong danh sách của khách, admin, nhân viên)
export function SupportCard({ request, onPress, showCustomer }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Yêu cầu ${request.item?.name || ''}`} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}>
      <View style={s.row}>
        <Txt v="bodyStrong" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{request.item?.name || 'Sản phẩm'}</Txt>
        <Pill info={supportStatus(request.status)} />
      </View>
      <Txt v="caption" color={colors.inkSoft}>{`${request.orderCode} · SL ${request.quantity} · gửi ${formatDateTime(request.createdAt)}`}</Txt>
      {showCustomer && !!request.customer && <Txt v="caption" color={colors.inkSoft}>{`${request.customer.name} · ${request.customer.phone}`}</Txt>}
      {request.earlyReport && <Txt v="caption" color={colors.danger}>Báo lỗi khi nhận (trong 7 ngày đầu)</Txt>}
      {!!request.visit && <Txt v="caption" color={colors.primary}>{`Hẹn kiểm tra ${formatDateOnly(request.visit.date)} · ${request.visit.timeSlot}`}</Txt>}
    </Pressable>
  );
}

// Danh sách yêu cầu: khách xem của mình, admin xem tất cả (có lọc trạng thái)
export function SupportListScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const scope = user?.isAdmin ? 'admin' : 'mine';
  const { requests, loading, error, reload } = useSupportList(scope, user?.id);
  const [filter, setFilter] = useState('open');

  useFocusEffect(useCallback(() => { if (user) reload(); }, [user, reload]));

  const shown = requests.filter((request) => (filter === 'all' ? true : filter === 'open' ? OPEN_SUPPORT_STATUSES.includes(request.status) : request.status === filter));
  const filters = [{ key: 'open', label: 'Đang xử lý' }, { key: 'all', label: 'Tất cả' }, ...Object.keys(SUPPORT_STATUSES).map((key) => ({ key, label: SUPPORT_STATUSES[key].label }))];

  return (
    <View style={s.screen}>
      <Header title={scope === 'admin' ? 'Báo lỗi & bảo hành' : 'Yêu cầu báo lỗi của tôi'} subtitle={`${requests.length} yêu cầu`} navigation={navigation} hideBack={!!route.params?.tab} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {filters.map((item) => <Chip key={item.key} label={item.label} selected={filter === item.key} onPress={() => setFilter(item.key)} />)}
        </ScrollView>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(request) => request.id}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 32, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading && requests.length > 0} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={loading ? <Skeleton style={{ height: 90, borderRadius: radius.card }} /> : (
          <EmptyState
            icon={error ? 'alert-circle-outline' : 'shield-check-outline'}
            title={error ? 'Chưa tải được yêu cầu' : 'Chưa có yêu cầu nào'}
            text={error || (scope === 'admin' ? 'Khách báo lỗi sẽ hiện ở đây.' : 'Mở một đơn đã giao để báo lỗi hoặc yêu cầu bảo hành.')}
            action={error ? 'Thử lại' : undefined}
            onPress={error ? reload : undefined}
          />
        )}
        renderItem={({ item }) => <SupportCard request={item} showCustomer={scope === 'admin'} onPress={() => navigation.navigate('SupportDetail', { id: item.id })} />}
      />
    </View>
  );
}

// Khách gửi yêu cầu báo lỗi / bảo hành cho một món trong đơn đã giao
export function SupportCreateScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { orders, notify } = useApp();
  const order = orders.find((item) => item.id === route.params?.orderId);
  const item = order?.items.find((line) => line.id === route.params?.itemId);
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!order || !item) {
    return (
      <View style={s.screen}>
        <Header title="Báo lỗi / Bảo hành" navigation={navigation} />
        <EmptyState icon="package-variant-closed" title="Không tìm thấy sản phẩm" action="Quay lại" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const submit = async () => {
    if (description.trim().length < 10) { setError('Mô tả lỗi cần ít nhất 10 ký tự.'); return; }
    setBusy(true); setError('');
    try {
      const id = await createSupportRequest({ orderItemId: item.id, quantity, description: description.trim(), photoCount: photos });
      notify('Đã gửi yêu cầu. Cửa hàng sẽ liên hệ hẹn lịch kiểm tra.');
      navigation.replace('SupportDetail', { id });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Báo lỗi / Bảo hành" subtitle={order.code} navigation={navigation} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={[s.card, s.row]}>
          <ProductImage width={200} uri={item.uri} category={item.category} iconSize={24} style={s.thumb} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>{item.name}</Txt>
            <Txt v="caption" color={colors.inkSoft}>{`${item.selectedColor || 'Mặc định'} · đã mua ${item.quantity}${item.isGift ? ' · quà tặng' : ''}`}</Txt>
          </View>
        </View>
        <View style={s.card}>
          <View style={s.row}>
            <Txt v="bodyStrong" style={{ flex: 1 }}>Số lượng bị lỗi</Txt>
            <QtyStepper value={quantity} max={item.quantity} onChange={setQuantity} />
          </View>
          <Field label="Mô tả lỗi" value={description} onChangeText={(value) => { setDescription(value); setError(''); }} multiline maxLength={1000} placeholder="Ví dụ: chân ghế lung lay, mặt bàn bị nứt ở góc..." helper={`${description.length}/1000 ký tự`} />
          <PhotoSlots count={photos} onChange={setPhotos} />
          <Txt v="caption" color={colors.inkMuted}>Nhân viên cửa hàng sẽ tới kiểm tra. Lỗi do cửa hàng được đổi trả miễn phí; lỗi do sử dụng được xử lý theo bảo hành.</Txt>
        </View>
        {!!error && <Txt v="small" color={colors.danger}>{error}</Txt>}
        <Button title="Gửi yêu cầu" icon="send" loading={busy} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Chi tiết một yêu cầu; thao tác theo vai trò (khách hủy, admin hẹn lịch + chốt, nhân viên ghi nhận định)
export function SupportDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, notify } = useApp();
  const ops = useSupportRequest(route.params?.id);
  const { request, loading, error, reload, busy } = ops;
  const isAdmin = !!user?.isAdmin;
  const staffList = useStaffList(isAdmin);
  const [actionError, setActionError] = useState('');
  const [staffId, setStaffId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitSlot, setVisitSlot] = useState('');
  const [assessment, setAssessment] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [staffPhotos, setStaffPhotos] = useState(0);
  const [conclusion, setConclusion] = useState('');
  const [resolution, setResolution] = useState('repair');
  const [cost, setCost] = useState('');
  const [adminNote, setAdminNote] = useState('');

  if (!request) {
    return (
      <View style={s.screen}>
        <Header title="Yêu cầu báo lỗi" navigation={navigation} />
        {loading ? <View style={{ paddingHorizontal: SCREEN_PADDING }}><Skeleton style={{ height: 160, borderRadius: radius.card }} /></View>
          : <EmptyState icon="alert-circle-outline" title="Không tải được yêu cầu" text={error} action="Thử lại" onPress={reload} />}
      </View>
    );
  }

  const act = async (action, successText) => {
    setActionError('');
    try { await action(); notify(successText); } catch (e) { setActionError(e.message); }
  };
  const isAssignedStaff = !!user?.isStaff && request.staff?.id === user.id;
  const open = OPEN_SUPPORT_STATUSES.includes(request.status);

  return (
    <View style={s.screen}>
      <Header title="Yêu cầu báo lỗi" subtitle={request.orderCode} navigation={navigation} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 40, gap: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={s.card}>
          <Pill info={supportStatus(request.status)} />
          <Txt v="bodyStrong">{request.item?.name}</Txt>
          <Txt v="caption" color={colors.inkSoft}>{`${request.item?.selectedColor || 'Mặc định'} · SL lỗi ${request.quantity} · gửi ${formatDateTime(request.createdAt)}`}</Txt>
          {request.earlyReport && <Txt v="caption" color={colors.danger}>Báo lỗi khi nhận (trong 7 ngày đầu): ưu tiên kiểm tra lỗi vận chuyển</Txt>}
          <Txt v="small">{request.description}</Txt>
          <PhotoSlots count={request.photoCount} label="Ảnh của khách (minh họa)" />
          {(isAdmin || user?.isStaff) && !!request.customer && (
            <Txt v="small" color={colors.inkSoft}>{`Khách: ${request.customer.name} · ${request.customer.phone}\n${request.customer.address}`}</Txt>
          )}
        </View>

        {(!!request.staff || !!request.visit) && (
          <View style={s.card}>
            <StaffContact staff={request.staff} title="Nhân viên kiểm tra" />
            {!!request.visit && <Txt v="small">{`Lịch kiểm tra: ${formatDateOnly(request.visit.date)} · ${request.visit.timeSlot}`}</Txt>}
          </View>
        )}

        {!!request.assessment && (
          <View style={s.card}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>Nhận định của nhân viên</Txt>
            <Txt v="small" color={request.assessment === 'store_fault' ? colors.success : colors.danger}>{ASSESSMENTS[request.assessment]}</Txt>
            {!!request.staffNote && <Txt v="small">{request.staffNote}</Txt>}
            <PhotoSlots count={request.staffPhotoCount} label="Ảnh kiểm tra (minh họa)" />
          </View>
        )}

        {!!request.conclusion && (
          <View style={s.card}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>Kết luận của cửa hàng</Txt>
            <Txt v="small">{`${CONCLUSIONS[request.conclusion]}${request.resolution ? ` · ${RESOLUTIONS[request.resolution]}` : ''}`}</Txt>
            {isAdmin && request.cost > 0 && <Txt v="small" color={colors.inkSoft}>{`Chi phí xử lý: ${formatVND(request.cost)}`}</Txt>}
            {!!request.adminNote && <Txt v="small" color={colors.inkSoft}>{request.adminNote}</Txt>}
          </View>
        )}

        {/* Khách hủy khi còn chờ tiếp nhận */}
        {!isAdmin && !user?.isStaff && request.status === 'pending' && (
          <Button title="Hủy yêu cầu" variant="danger" loading={busy === 'cancel'} onPress={() => confirmAction({
            title: 'Hủy yêu cầu', message: 'Bạn muốn hủy yêu cầu báo lỗi này?', confirmText: 'Hủy yêu cầu', destructive: true,
            onConfirm: () => act(ops.cancel, 'Đã hủy yêu cầu.'),
          })}
          />
        )}

        {/* Admin: phân công + hẹn lịch kiểm tra */}
        {isAdmin && ['pending', 'scheduled'].includes(request.status) && (
          <View style={s.card}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>{request.status === 'pending' ? 'Phân công nhân viên kiểm tra' : 'Đổi lịch / nhân viên'}</Txt>
            <StaffPicker staff={staffList} value={staffId || request.staff?.id || ''} onChange={setStaffId} />
            <DateSlotPicker date={visitDate || request.visit?.date || ''} onDate={setVisitDate} slot={visitSlot || request.visit?.timeSlot || ''} onSlot={setVisitSlot} />
            <Button title="Hẹn lịch kiểm tra" icon="calendar-check" size="sm" variant="soft" loading={busy === 'schedule'} onPress={() => {
              const input = { staffId: staffId || request.staff?.id, date: visitDate || request.visit?.date, timeSlot: visitSlot || request.visit?.timeSlot };
              if (!input.staffId || !input.date || !input.timeSlot) { setActionError('Chọn nhân viên, ngày và khung giờ.'); return; }
              act(() => ops.schedule(input), 'Đã hẹn lịch kiểm tra.');
            }}
            />
          </View>
        )}

        {/* Nhân viên: ghi nhận định sau khi kiểm tra */}
        {(isAssignedStaff || isAdmin) && ['scheduled', 'in_progress'].includes(request.status) && (
          <View style={s.card}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>{request.assessment ? 'Cập nhật nhận định' : 'Ghi nhận định sau khi kiểm tra'}</Txt>
            <View style={{ gap: 8 }}>
              {Object.entries(ASSESSMENTS).map(([key, label]) => <Chip key={key} label={label} selected={(assessment || request.assessment) === key} onPress={() => setAssessment(key)} />)}
            </View>
            <Field label="Ghi chú kiểm tra" value={staffNote} onChangeText={setStaffNote} multiline maxLength={1000} placeholder={request.staffNote || 'Ví dụ: mối hàn chân lỏng, không có dấu va đập'} />
            <PhotoSlots count={staffPhotos} onChange={setStaffPhotos} />
            <Button title="Gửi nhận định" icon="clipboard-check-outline" size="sm" loading={busy === 'assess'} onPress={() => {
              const input = { assessment: assessment || request.assessment, note: staffNote.trim() || request.staffNote, photoCount: staffPhotos || request.staffPhotoCount };
              if (!input.assessment || (input.note || '').length < 3) { setActionError('Chọn nhận định và ghi chú kiểm tra.'); return; }
              act(() => ops.submitAssessment(input), 'Đã gửi nhận định.');
            }}
            />
          </View>
        )}

        {/* Admin: chốt kết luận */}
        {isAdmin && open && (
          <View style={s.card}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>Chốt kết luận</Txt>
            {request.status !== 'in_progress' && <Txt v="caption" color={colors.inkMuted}>Đổi trả / bảo hành cần nhân viên gửi nhận định trước. Từ chối thì làm được ngay.</Txt>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(CONCLUSIONS).map(([key, label]) => <Chip key={key} label={label} selected={conclusion === key} onPress={() => setConclusion(key)} />)}
            </View>
            {!!conclusion && conclusion !== 'rejected' && (
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {Object.entries(RESOLUTIONS).map(([key, label]) => <Chip key={key} label={label} selected={resolution === key} onPress={() => setResolution(key)} />)}
                </View>
                <Field label="Chi phí xử lý (đ)" value={cost} onChangeText={setCost} keyboardType="number-pad" placeholder={resolution === 'replace' ? 'Bỏ trống = giá vốn món đổi' : '0'} helper="Đổi mới: nhớ tự trừ kho trong bảng product_color_stock." />
              </>
            )}
            <Field label={conclusion === 'rejected' ? 'Lý do từ chối (bắt buộc)' : 'Ghi chú gửi khách'} value={adminNote} onChangeText={setAdminNote} multiline maxLength={500} />
            <Button title="Chốt kết luận" icon="check-decagram" size="sm" loading={busy === 'resolve'} disabled={!conclusion} onPress={() => act(() => ops.resolve({
              conclusion, resolution, cost: cost === '' ? null : Number(String(cost).replace(/\D/g, '')), note: adminNote.trim(),
            }), 'Đã chốt kết luận.')}
            />
          </View>
        )}

        {!!actionError && <Txt v="small" color={colors.danger}>{actionError}</Txt>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING - 4, paddingBottom: 12 },
  filters: { gap: 8, paddingHorizontal: SCREEN_PADDING, paddingBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 64, height: 64, borderRadius: radius.input },
});
