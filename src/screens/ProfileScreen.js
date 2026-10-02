import React from 'react';
import { View } from 'react-native';
import { Avatar, Button, Divider, List, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout, cartCount } = useApp();
  const wrap = { flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 16, padding: 16 };

  if (!user) {
    return (
      <View style={[wrap, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <Avatar.Icon size={72} icon="account-outline" />
        <Text variant="titleMedium">Bạn chưa đăng nhập</Text>
        <Text style={{ textAlign: 'center', color: colors.onSurfaceVariant }}>Đăng nhập để lưu món yêu thích, quản lý giỏ hàng và viết đánh giá.</Text>
        <Button mode="contained" onPress={() => navigation.navigate('Login')}>Đăng nhập</Button>
        <Button onPress={() => navigation.navigate('Register')}>Tạo tài khoản mới</Button>
      </View>
    );
  }
  return (
    <View style={wrap}>
      <View style={{ alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <Avatar.Text size={72} label={user.name.trim().charAt(0).toUpperCase()} />
        <Text variant="titleLarge" style={{ fontWeight: '700' }}>{user.name}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{user.email}</Text>
      </View>
      <List.Section style={{ backgroundColor: colors.surface, borderRadius: 14 }}>
        <List.Item title="Điện thoại" description={user.phone || 'Chưa cập nhật'} left={(p) => <List.Icon {...p} icon="phone-outline" />} />
        <Divider />
        <List.Item title="Địa chỉ" description={user.address || 'Chưa cập nhật'} descriptionNumberOfLines={3} left={(p) => <List.Icon {...p} icon="map-marker-outline" />} />
        <Divider />
        <List.Item title="Giỏ hàng" description={`${cartCount} sản phẩm`} onPress={() => navigation.navigate('Cart')} left={(p) => <List.Icon {...p} icon="cart-outline" />} right={(p) => <List.Icon {...p} icon="chevron-right" />} />
      </List.Section>
      <View style={{ gap: 10, marginTop: 8 }}>
        <Button mode="outlined" icon="account-edit-outline" onPress={() => navigation.navigate('EditProfile')}>Sửa thông tin</Button>
        <Button mode="outlined" icon="lock-outline" onPress={() => navigation.navigate('ChangePassword')}>Đổi mật khẩu</Button>
        <Button mode="contained" icon="logout" onPress={logout}>Đăng xuất</Button>
      </View>
    </View>
  );
}
