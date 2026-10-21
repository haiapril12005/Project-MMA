// Bộ component giao diện dùng chung cho cả app
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { CATEGORIES } from '../utils';

export const Icon = ({ name, size = 22, color = colors.ink, style }) => (
  <MaterialCommunityIcons name={name} size={size} color={color} style={style} />
);

// ---------- Chữ ----------
const TYPE = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 36, letterSpacing: -0.4 },
  title: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17 },
  price: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
};

export function Txt({ v = 'body', color = colors.ink, style, children, ...rest }) {
  return <Text style={[TYPE[v], { color }, style]} {...rest}>{children}</Text>;
}

// ---------- Nút ----------
export function Button({ title, onPress, variant = 'primary', icon, size = 'md', loading, disabled, style }) {
  const v = {
    primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
    soft: { bg: colors.primarySoft, bgPressed: '#EBD3C2', fg: colors.primaryPressed, border: colors.primarySoft },
    outline: { bg: 'transparent', bgPressed: colors.sunken, fg: colors.ink, border: colors.line },
    danger: { bg: 'transparent', bgPressed: '#F3E1DC', fg: colors.danger, border: '#E8CFC8' },
  }[variant];
  const h = size === 'sm' ? 40 : 52;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        { height: h, backgroundColor: pressed ? v.bgPressed : v.bg, borderColor: v.border, opacity: off ? 0.55 : 1, paddingHorizontal: size === 'sm' ? 16 : 22 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} color={v.fg} />}
          <Text numberOfLines={1} style={[size === 'sm' ? TYPE.caption : TYPE.bodyStrong, { color: v.fg, fontSize: size === 'sm' ? 13 : 15 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// Nút tròn chỉ có icon
export function IconButton({ icon, onPress, size = 44, color = colors.ink, bg = colors.surface, label, style, iconSize = 22 }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.94 }], opacity: 0.85 }, style]}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}

// ---------- Chip lọc ----------
export function Chip({ label, selected, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [s.chip, selected ? s.chipOn : s.chipOff, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      {icon && <Icon name={icon} size={18} color={selected ? colors.onPrimary : colors.inkSoft} />}
      <Text style={[TYPE.caption, { fontSize: 13, color: selected ? colors.onPrimary : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

// ---------- Ô nhập: nhãn ở trên, lỗi ở dưới ----------
export function Field({ label, error, helper, secure, style, ...input }) {
  const [focus, setFocus] = useState(false);
  const [hide, setHide] = useState(true);
  return (
    <View style={[{ gap: 6 }, style]}>
      <Txt v="caption" color={colors.inkSoft} style={{ fontSize: 13 }}>{label}</Txt>
      <View style={[s.field, { borderColor: error ? colors.danger : focus ? colors.primary : colors.line, backgroundColor: input.editable === false ? colors.sunken : colors.surface }]}>
        <TextInput
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.primary}
          secureTextEntry={secure && hide}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[TYPE.body, { flex: 1, color: colors.ink, paddingVertical: 0, minHeight: 24 }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
          {...input}
        />
        {secure && (
          <Pressable onPress={() => setHide(!hide)} hitSlop={8} accessibilityLabel={hide ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}>
            <Icon name={hide ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.inkSoft} />
          </Pressable>
        )}
      </View>
      {error ? <Txt v="small" color={colors.danger}>{error}</Txt> : helper ? <Txt v="small" color={colors.inkMuted}>{helper}</Txt> : null}
    </View>
  );
}

// ---------- Sao đánh giá ----------
export function Stars({ value = 0, size = 16, onChange, gap = 2 }) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half-full' : 'star-outline';
        const icon = <Icon name={name} size={size} color={colors.star} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} style={{ padding: 2 }} accessibilityLabel={`${i} sao`}>{icon}</Pressable>
        ) : <View key={i}>{icon}</View>;
      })}
    </View>
  );
}

// ---------- Ảnh sản phẩm, có ảnh dự phòng khi lỗi mạng ----------
export function ProductImage({ uri, category, style, iconSize = 40 }) {
  const [failed, setFailed] = useState(!uri);
  const icon = CATEGORIES.find((c) => c.key === category)?.icon || 'image-outline';
  return (
    <View style={[{ backgroundColor: colors.sunken, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={icon} size={iconSize} color="#C9B6A4" style={{ position: 'absolute' }} />
      {!failed && <Image source={{ uri }} onError={() => setFailed(true)} resizeMode="cover" style={StyleSheet.absoluteFill} />}
    </View>
  );
}

// ---------- Khung chờ tải (skeleton) ----------
export function Skeleton({ style }) {
  const a = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(a, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ backgroundColor: colors.sunken, borderRadius: radius.sm, opacity: a }, style]} />;
}

// ---------- Trạng thái trống ----------
export function EmptyState({ icon, title, text, action, onPress }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48, gap: 10 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Icon name={icon} size={40} color={colors.primary} />
      </View>
      <Txt v="subtitle" style={{ textAlign: 'center' }}>{title}</Txt>
      {text && <Txt v="small" color={colors.inkSoft} style={{ textAlign: 'center', maxWidth: 300 }}>{text}</Txt>}
      {action && <Button title={action} onPress={onPress} style={{ marginTop: 10 }} />}
    </View>
  );
}

// ---------- Bộ tăng giảm số lượng ----------
export function QtyStepper({ value, min = 1, max = 99, onChange }) {
  return (
    <View style={s.stepper}>
      <Pressable onPress={() => onChange(value - 1)} disabled={value <= min} hitSlop={6} style={[s.stepBtn, value <= min && { opacity: 0.35 }]} accessibilityLabel="Giảm số lượng">
        <Icon name="minus" size={18} />
      </Pressable>
      <Txt v="bodyStrong" style={{ minWidth: 28, textAlign: 'center' }}>{value}</Txt>
      <Pressable onPress={() => onChange(value + 1)} disabled={value >= max} hitSlop={6} style={[s.stepBtn, value >= max && { opacity: 0.35 }]} accessibilityLabel="Tăng số lượng">
        <Icon name="plus" size={18} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.pill, borderWidth: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOff: { backgroundColor: colors.surface, borderColor: colors.line },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: radius.input, borderWidth: 1, paddingHorizontal: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.sunken, borderRadius: radius.pill, padding: 4 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
