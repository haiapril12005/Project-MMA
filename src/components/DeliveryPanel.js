import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, radius } from '../theme';
import {
  amountDue, confirmAction, DEPOSIT_STATUS, formatDateOnly, formatDateTime, formatVND, INCIDENT_KINDS, ORDER_STATUS,
} from '../utils';
import { Button, Chip, Field, Icon, Txt } from './ui';
import { DateSlotPicker, PhotoSlots, StaffContact, StaffPicker } from './WorkflowParts';

const DELIVERING = [ORDER_STATUS.SHIPPING, ORDER_STATUS.INSTALLING, ORDER_STATUS.DELIVERY_ISSUE];

// Toàn bộ thao tác giao hàng của một đơn, dùng chung cho admin và nhân viên giao hàng.
// ops = kết quả useManagedOrder(orderId); staffList chỉ cần khi là admin (phân công, giao bù).
export default function DeliveryPanel({ order, ops, isAdmin, staffList = [] }) {
  const { notify } = useApp();
  const [error, setError] = useState('');
  const [assignTo, setAssignTo] = useState(order.assignedStaff?.id || '');
  const [reporting, setReporting] = useState(false);
  const [kind, setKind] = useState('missing');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState(0);
  const [redeliveryDate, setRedeliveryDate] = useState(order.redelivery?.date || '');
  const [redeliverySlot, setRedeliverySlot] = useState(order.redelivery?.timeSlot || '');
  const [redeliveryStaff, setRedeliveryStaff] = useState(order.assignedStaff?.id || '');
  const [lossCost, setLossCost] = useState('');

  const due = amountDue(order);
  const incidents = order.incidents || [];
  const openIncidents = incidents.filter((incident) => !incident.resolvedAt);
  const finished = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.status);
  const canDeliver = [ORDER_STATUS.PREPARING, ...DELIVERING].includes(order.status);

  const act = async (action, successText) => {
    setError('');
    try {
      await action();
      notify(successText);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const askComplete = (title) => confirmAction({
    title,
    message: due > 0 ? `Xác nhận đã thu đủ ${formatVND(due)} từ khách?` : 'Đơn đã thanh toán đủ. Xác nhận đã giao và lắp đặt xong?',
    confirmText: 'Xác nhận',
    onConfirm: () => act(() => ops.completeDelivery(due), 'Đơn đã giao & lắp đặt xong.'),
  });

  const submitIncident = async () => {
    if (note.trim().length < 3) { setError('Hãy ghi chú rõ thiếu hoặc hỏng món gì.'); return; }
    const ok = await act(() => ops.reportIncident({ kind, note: note.trim(), photoCount: photos }), 'Đã ghi nhận sự cố, đơn chuyển sang "Chờ giao bù".');
    if (ok) { setReporting(false); setNote(''); setPhotos(0); }
  };

  const submitRedelivery = () => {
    if (!redeliveryDate || !redeliverySlot) { setError('Chọn ngày và khung giờ giao bù.'); return; }
    act(() => ops.scheduleRedelivery({
      date: redeliveryDate,
      timeSlot: redeliverySlot,
      staffId: redeliveryStaff || null,
      lossCost: Number(String(lossCost).replace(/\D/g, '')) || 0,
    }), 'Đã hẹn lịch giao bù.');
  };

  return (
    <View style={s.card}>
      <StaffContact staff={order.assignedStaff} title="Nhân viên giao hàng" />

      {/* Admin phân công nhân viên */}
      {isAdmin && !finished && (
        <View style={{ gap: 8 }}>
          <Txt v="bodyStrong" style={{ fontSize: 14 }}>{order.assignedStaff ? 'Đổi nhân viên giao hàng' : 'Phân công nhân viên giao hàng'}</Txt>
          <StaffPicker staff={staffList} value={assignTo} onChange={setAssignTo} />
          {!!assignTo && assignTo !== order.assignedStaff?.id && (
            <Button title="Phân công" icon="account-check-outline" size="sm" variant="soft" loading={ops.busy === 'assign'} onPress={() => act(() => ops.assignStaff(assignTo), 'Đã phân công nhân viên.')} />
          )}
        </View>
      )}

      {/* Tiền cần thu khi giao */}
      {canDeliver && (
        <View style={s.due}>
          <Icon name="cash" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Txt v="caption" color={colors.inkMuted}>Cần thu khi giao</Txt>
            <Txt v="bodyStrong" color={colors.primary}>{formatVND(due)}</Txt>
            {order.depositStatus === DEPOSIT_STATUS.PAID && <Txt v="caption" color={colors.inkSoft}>{`Đã trừ tiền cọc ${formatVND(order.depositAmount)}`}</Txt>}
          </View>
        </View>
      )}
      {order.cashCollected != null && (
        <Txt v="small" color={colors.success}>{`Đã thu ${formatVND(order.cashCollected)} lúc ${formatDateTime(order.cashCollectedAt)}`}</Txt>
      )}

      {/* Các bước giao hàng */}
      {order.status === ORDER_STATUS.PREPARING && (
        <>
          <Button title="Xuất kho, bắt đầu giao" icon="truck-delivery-outline" loading={ops.busy === ORDER_STATUS.SHIPPING} disabled={!order.assignedStaff} onPress={() => act(() => ops.staffStep(ORDER_STATUS.SHIPPING), 'Đơn đã xuất kho, đang giao.')} />
          {!order.assignedStaff && <Txt v="caption" color={colors.inkMuted}>Cần phân công nhân viên trước khi xuất kho.</Txt>}
        </>
      )}
      {order.status === ORDER_STATUS.SHIPPING && (
        <>
          <Button title="Đã đến nơi, đang lắp đặt" icon="tools" loading={ops.busy === ORDER_STATUS.INSTALLING} onPress={() => act(() => ops.staffStep(ORDER_STATUS.INSTALLING), 'Đang lắp đặt.')} />
          <Button title="Giao xong (không cần lắp)" icon="check-circle" variant="outline" loading={ops.busy === 'complete'} onPress={() => askComplete('Giao xong')} />
        </>
      )}
      {order.status === ORDER_STATUS.INSTALLING && (
        <Button title="Hoàn tất lắp đặt" icon="check-circle" loading={ops.busy === 'complete'} onPress={() => askComplete('Hoàn tất lắp đặt')} />
      )}

      {/* Sự cố + giao bù */}
      {incidents.length > 0 && (
        <View style={{ gap: 8 }}>
          <Txt v="bodyStrong" style={{ fontSize: 14 }}>Sự cố khi giao</Txt>
          {incidents.map((incident) => (
            <View key={incident.id} style={[s.incident, incident.resolvedAt && { opacity: 0.7 }]}>
              <Txt v="small" color={colors.danger}>{`${INCIDENT_KINDS[incident.kind]?.label || 'Sự cố'}${incident.resolvedAt ? ' · đã giao bù' : ''}`}</Txt>
              <Txt v="small">{incident.note}</Txt>
              <Txt v="caption" color={colors.inkMuted}>{`${incident.reportedBy || 'Nhân viên'} · ${formatDateTime(incident.reportedAt)}${isAdmin && incident.lossCost ? ` · tổn thất ${formatVND(incident.lossCost)}` : ''}`}</Txt>
              <PhotoSlots count={incident.photoCount} />
            </View>
          ))}
        </View>
      )}
      {order.status === ORDER_STATUS.DELIVERY_ISSUE && (
        <View style={{ gap: 8 }}>
          <Txt v="small" color={colors.inkSoft}>
            {order.redelivery
              ? `Lịch giao bù: ${formatDateOnly(order.redelivery.date)} · ${order.redelivery.timeSlot}`
              : 'Chờ cửa hàng hẹn lịch giao bù.'}
          </Txt>
          {isAdmin && (
            <View style={s.form}>
              <Txt v="bodyStrong" style={{ fontSize: 14 }}>Hẹn giao bù</Txt>
              <DateSlotPicker date={redeliveryDate} onDate={setRedeliveryDate} slot={redeliverySlot} onSlot={setRedeliverySlot} />
              <Txt v="caption" color={colors.inkSoft}>Nhân viên giao bù</Txt>
              <StaffPicker staff={staffList} value={redeliveryStaff} onChange={setRedeliveryStaff} />
              <Field label="Chi phí tổn thất (đ, không bắt buộc)" value={lossCost} onChangeText={setLossCost} keyboardType="number-pad" placeholder="0" helper="Nhớ tự trừ kho hàng thay thế trong bảng product_color_stock." />
              <Button title={order.redelivery ? 'Cập nhật lịch giao bù' : 'Hẹn giao bù'} icon="calendar-check" size="sm" variant="soft" loading={ops.busy === 'redelivery'} onPress={submitRedelivery} />
            </View>
          )}
          {openIncidents.length > 0 && (
            <Button title="Đã giao bù đủ" icon="check-circle" loading={ops.busy === 'complete'} disabled={!order.redelivery} onPress={() => askComplete('Đã giao bù đủ')} />
          )}
        </View>
      )}

      {/* Ghi nhận giao thiếu / hỏng */}
      {DELIVERING.includes(order.status) && (
        reporting ? (
          <View style={s.form}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>Báo giao thiếu / hỏng</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Object.entries(INCIDENT_KINDS).map(([key, info]) => (
                <Chip key={key} icon={info.icon} label={info.label} selected={kind === key} onPress={() => setKind(key)} />
              ))}
            </View>
            <Field label="Ghi chú (thiếu / hỏng món gì, bao nhiêu cái)" value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="Ví dụ: thiếu 2 sofa màu Kem, 1 ghế nứt chân" />
            <PhotoSlots count={photos} onChange={setPhotos} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Để sau" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => setReporting(false)} />
              <Button title="Ghi nhận" variant="danger" size="sm" style={{ flex: 1 }} loading={ops.busy === 'incident'} onPress={submitIncident} />
            </View>
          </View>
        ) : (
          <Button title="Báo giao thiếu / hỏng" icon="alert-outline" variant="danger" size="sm" onPress={() => setReporting(true)} />
        )
      )}

      {!!error && <Txt v="small" color={colors.danger}>{error}</Txt>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: 10 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.input, backgroundColor: colors.bg },
  incident: { gap: 4, padding: 12, borderRadius: radius.input, backgroundColor: '#FBF1EE' },
  form: { gap: 10, padding: 12, borderRadius: radius.input, backgroundColor: colors.bg },
});
