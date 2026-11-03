import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { formatDateOnly, INSTALLATION_TIME_SLOTS, installationDateOptions } from '../utils';
import { Chip, Icon, Txt } from './ui';

// Ảnh MINH HỌA (demo): bấm "Chụp ảnh" thêm một ô xám, tối đa 3 ô; database chỉ lưu số ảnh
export function PhotoSlots({ count, onChange, max = 3, label = 'Ảnh tình trạng (minh họa)' }) {
  const editable = typeof onChange === 'function';
  if (!editable && !count) return null;
  return (
    <View style={{ gap: 8 }}>
      <Txt v="caption" color={colors.inkSoft}>{label}</Txt>
      <View style={s.photoRow}>
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={s.photo}>
            <Icon name="image-outline" size={22} color={colors.inkMuted} />
            <Txt v="caption" color={colors.inkMuted} style={{ fontSize: 10.5 }}>{`Ảnh ${index + 1}`}</Txt>
            {editable && (
              <Pressable onPress={() => onChange(count - 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Xóa ảnh ${index + 1}`} style={s.photoRemove}>
                <Icon name="close" size={14} color={colors.onPrimary} />
              </Pressable>
            )}
          </View>
        ))}
        {editable && count < max && (
          <Pressable onPress={() => onChange(count + 1)} accessibilityRole="button" accessibilityLabel="Chụp ảnh" style={[s.photo, s.photoAdd]}>
            <Icon name="camera-plus-outline" size={22} color={colors.primary} />
            <Txt v="caption" color={colors.primary} style={{ fontSize: 10.5 }}>Chụp ảnh</Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Chọn ngày (14 ngày tới) + khung giờ
export function DateSlotPicker({ date, onDate, slot, onSlot }) {
  const options = useMemo(() => installationDateOptions(14), []);
  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((option) => {
          const selected = date === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onDate(option.value)}
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
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {INSTALLATION_TIME_SLOTS.map((item) => (
          <Chip key={item.key} label={`${item.label} ${item.note}`} selected={slot === item.key} onPress={() => onSlot(item.key)} />
        ))}
      </View>
    </View>
  );
}

// Chọn nhân viên giao hàng
export function StaffPicker({ staff, value, onChange }) {
  if (!staff.length) {
    return <Txt v="small" color={colors.danger}>Chưa có nhân viên giao hàng. Cấp quyền nhân viên trong Supabase (bảng delivery_staff).</Txt>;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {staff.map((person) => (
        <Chip key={person.id} icon="account-hard-hat-outline" label={person.name} selected={value === person.id} onPress={() => onChange(person.id)} />
      ))}
    </View>
  );
}

// Tên + số điện thoại nhân viên phụ trách
export function StaffContact({ staff, title = 'Nhân viên phụ trách' }) {
  if (!staff) return null;
  return (
    <View style={s.contact}>
      <Icon name="account-hard-hat-outline" size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Txt v="caption" color={colors.inkMuted}>{title}</Txt>
        <Txt v="small">{staff.phone ? `${staff.name} · ${staff.phone}` : staff.name}</Txt>
      </View>
    </View>
  );
}

// Nhãn trạng thái dạng viên thuốc
export function Pill({ info }) {
  return (
    <View style={[s.pill, { backgroundColor: info.bg }]}>
      <Icon name={info.icon} size={14} color={info.color} />
      <Txt v="caption" color={info.color}>{info.label}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 72, height: 72, borderRadius: radius.input, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center', gap: 2 },
  photoAdd: { backgroundColor: colors.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  dateChip: { width: 64, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  dateChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.input, backgroundColor: colors.primarySoft },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
});
