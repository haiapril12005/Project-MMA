import React from 'react';
import { View } from 'react-native';
import { Badge, IconButton, Searchbar, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

// Thanh tìm kiếm cố định trên cùng + icon giỏ hàng bên phải
export default function TopBar({ value, onChange }) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { colors } = useTheme();
  const { cartCount, user } = useApp();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background }}>
      <Searchbar placeholder="Tìm nội thất theo tên" value={value} onChangeText={onChange} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline }} elevation={0} inputStyle={{ minHeight: 0 }} />
      <View>
        <IconButton icon="cart-outline" size={26} onPress={() => nav.navigate(user ? 'Cart' : 'Login')} accessibilityLabel="Giỏ hàng" />
        {cartCount > 0 && <Badge style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.primary }}>{cartCount}</Badge>}
      </View>
    </View>
  );
}
