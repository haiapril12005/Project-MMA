import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';
import { setConfirmListener } from '../confirmBus';
import { Txt } from './ui';

export default function ConfirmDialog() {
    const insets = useSafeAreaInsets();
    const [opts, setOpts] = useState(null);
    const a = useRef(new Animated.Value(0)).current;
    const native = Platform.OS !== 'web';

    useEffect(() => {
        setConfirmListener(setOpts);
        return () => setConfirmListener(null);
    }, []);

    useEffect(() => {
        if (opts) Animated.spring(a, { toValue: 1, useNativeDriver: native, stiffness: 180, damping: 18, mass: 0.8 }).start();
    }, [opts, a, native]);

    if (!opts) return null;

    const close = (after) => {
        Animated.timing(a, { toValue: 0, duration: 180, useNativeDriver: native }).start(() => {
            setOpts(null);
            if (after) after();
        });
    };

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Đóng" />
            <Animated.View
                accessibilityRole="alert"
                style={[
                    s.wrap,
                    { bottom: insets.bottom + 92, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
                ]}
            >
                <Txt v="bodyStrong" color={colors.onPrimary} style={{ fontSize: 15 }}>{opts.title}</Txt>
                <Txt v="small" color="#EADFD4" style={{ marginTop: 4 }}>{opts.message}</Txt>
                <View style={s.actions}>
                    <Pressable onPress={() => close()} style={s.ghost} accessibilityRole="button">
                        <Txt v="caption" color={colors.onPrimary} style={{ fontSize: 13 }}>Hủy</Txt>
                    </Pressable>
                    <Pressable
                        onPress={() => close(opts.onConfirm)}
                        style={[s.ok, opts.destructive && { backgroundColor: '#F3E1DC' }]}
                        accessibilityRole="button"
                    >
                        <Txt v="caption" color={opts.destructive ? colors.danger : colors.primaryPressed} style={{ fontSize: 13 }}>
                            {opts.confirmText || 'Đồng ý'}
                        </Txt>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    wrap: {
        position: 'absolute', alignSelf: 'center', width: '88%', maxWidth: 380,
        backgroundColor: '#6E5547', borderRadius: radius.card, paddingHorizontal: 20, paddingVertical: 16,
        shadowColor: '#6B4A35', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
    ghost: { paddingHorizontal: 16, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    ok: { paddingHorizontal: 18, height: 36, borderRadius: radius.pill, backgroundColor: '#FFF8F2', alignItems: 'center', justifyContent: 'center' },
});