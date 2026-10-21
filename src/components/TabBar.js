import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, fonts, radius, shadow } from '../theme';
import { Icon, Txt } from './ui';

const TABS = {
  Home: { label: 'Trang chủ', icon: 'home-variant-outline', active: 'home-variant' },
  Favorites: { label: 'Yêu thích', icon: 'heart-outline', active: 'heart' },
  Cart: { label: 'Giỏ hàng', icon: 'cart-outline', active: 'cart' },
  Profile: { label: 'Tài khoản', icon: 'account-outline', active: 'account' },
};

// Thanh tab dưới cùng tự thiết kế: tab đang chọn có nền viên thuốc màu nhấn nhạt
export default function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { cartCount, favorites } = useApp();
  const badges = { Cart: cartCount, Favorites: favorites.length };

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const t = TABS[route.name];
        const badge = badges[route.name];
        const onPress = () => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} style={s.item} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t.label}>
            <View style={[s.pill, focused && { backgroundColor: colors.primarySoft }]}>
              <Icon name={focused ? t.active : t.icon} size={23} color={focused ? colors.primary : colors.inkSoft} />
              {badge > 0 && (
                <View style={s.badge}>
                  <Txt v="caption" color={colors.onPrimary} style={{ fontSize: 10, lineHeight: 14, fontFamily: fonts.bold }}>{badge > 99 ? '99+' : badge}</Txt>
                </View>
              )}
            </View>
            <Txt v="caption" color={focused ? colors.primary : colors.inkSoft} style={{ fontSize: 11.5, fontFamily: focused ? fonts.semibold : fonts.medium }}>{t.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, paddingTop: 10, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, ...shadow, shadowOffset: { width: 0, height: -4 } },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  pill: { width: 60, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: 8, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
});
