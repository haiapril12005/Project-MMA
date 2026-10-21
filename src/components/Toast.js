import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius } from '../theme';
import { Icon, Txt } from './ui';

// Thông báo nhỏ hiện phía trên thanh tab, tự ẩn sau 1,8 giây
export default function Toast() {
  const { toast } = useApp();
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  const [text, setText] = useState('');
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (!toast) return undefined;
    setText(toast.text);
    Animated.spring(a, { toValue: 1, useNativeDriver: native, stiffness: 180, damping: 18, mass: 0.8 }).start();
    const t = setTimeout(() => Animated.timing(a, { toValue: 0, duration: 220, useNativeDriver: native }).start(), 1800);
    return () => clearTimeout(t);
  }, [toast, a, native]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.wrap,
        { bottom: insets.bottom + 92, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
      ]}
    >
      <Icon name="check" size={18} color={colors.onPrimary} />
      <Txt v="caption" color={colors.onPrimary} style={{ fontSize: 13 }}>{text}</Txt>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6E5547', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 11,
    shadowColor: '#6B4A35', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
});
