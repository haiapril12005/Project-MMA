import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, SCREEN_PADDING } from '../theme';
import { confirmAction } from '../utils';
import { Button, Icon, Txt } from '../components/ui';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, cartCount, favorites, orders, refreshAdmin } = useApp();

  // Quyền admin vừa được cấp trên Supabase sẽ hiện ra khi mở lại tab Tài khoản
  useFocusEffect(useCallback(() => { refreshAdmin(); }, [refreshAdmin]));

  if (!user) {
    return (
      <View style={[s.guest, { paddingTop: insets.top + 24 }]}>
        <View style={s.guestIcon}><Icon name="account-outline" size={44} color={colors.primary} /></View>
        <Txt v="title" style={{ textAlign: 'center' }}>Chào bạn</Txt>
        <Txt v="body" color={colors.inkSoft} style={{ textAlign: 'center', maxWidth: 300 }}>Đăng nhập để đặt hàng, theo dõi giỏ hàng và viết đánh giá sản phẩm.</Txt>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 12 }}>
          <Button title="Đăng nhập" onPress={() => navigation.navigate('Login')} />
          <Button title="Tạo tài khoản mới" variant="outline" onPress={() => navigation.navigate('Register')} />
        </View>
      </View>
    );
  }

  const askLogout = () => confirmAction({ title: 'Đăng xuất', message: 'Bạn muốn đăng xuất khỏi tài khoản này?', confirmText: 'Đăng xuất', onConfirm: logout });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: SCREEN_PADDING, paddingBottom: 40 }}>
      <Txt v="display" style={{ marginBottom: 18 }}>Tài khoản</Txt>

      <View style={s.card}>
        <View style={s.avatar}><Txt v="display" color={colors.primary} style={{ fontSize: 26 }}>{user.name.trim().charAt(0).toUpperCase()}</Txt></View>
        <View style={{ flex: 1 }}>
          <Txt v="subtitle" numberOfLines={1}>{user.name}</Txt>
          <Txt v="small" color={colors.inkSoft} numberOfLines={1}>{user.email}</Txt>
          <View style={[s.role, user.isAdmin && { backgroundColor: colors.primary }]}>
            <Icon name={user.isAdmin ? 'shield-account' : 'account'} size={13} color={user.isAdmin ? colors.onPrimary : colors.primary} />
            <Txt v="caption" color={user.isAdmin ? colors.onPrimary : colors.primary}>{user.isAdmin ? 'Quản trị viên' : 'Khách hàng'}</Txt>
          </View>
        </View>
      </View>

      {!user.isAdmin && (
      <View style={s.stats}>
        <Pressable style={s.stat} onPress={() => navigation.navigate('Favorites')} accessibilityRole="button" accessibilityLabel={`${favorites.length} sản phẩm yêu thích`}>
          <Txt v="title" color={colors.primary}>{favorites.length}</Txt>
          <Txt v="caption" color={colors.inkSoft}>Yêu thích</Txt>
        </Pressable>
        <Pressable style={s.stat} onPress={() => navigation.navigate('Cart')} accessibilityRole="button" accessibilityLabel={`${cartCount} sản phẩm trong giỏ`}>
          <Txt v="title" color={colors.primary}>{cartCount}</Txt>
          <Txt v="caption" color={colors.inkSoft}>Trong giỏ</Txt>
        </Pressable>
      </View>
      )}

      {user.isAdmin && (
        <>
          <Txt v="caption" color={colors.inkMuted} style={s.groupLabel}>Quản trị cửa hàng</Txt>
          <View style={s.group}>
            <Cell icon="chart-box-outline" title="Thống kê thu chi" value="Thu, chi, lợi nhuận, lịch giao" onPress={() => navigation.navigate('AdminStats')} />
            <Cell icon="clipboard-list-outline" title="Quản lý đơn hàng" value="Đổi trạng thái, nhận cọc, duyệt hủy" onPress={() => navigation.navigate('AdminOrders')} last />
          </View>
        </>
      )}

      {!user.isAdmin && (
        <>
          <Txt v="caption" color={colors.inkMuted} style={s.groupLabel}>Thông tin giao hàng</Txt>
          <View style={s.group}>
            <Cell icon="phone-outline" title="Số điện thoại" value={user.phone || 'Chưa cập nhật'} />
            <Cell icon="map-marker-outline" title="Địa chỉ" value={user.address || 'Chưa cập nhật'} last />
          </View>
        </>
      )}

      <Txt v="caption" color={colors.inkMuted} style={s.groupLabel}>Cài đặt</Txt>
      <View style={s.group}>
        {!user.isAdmin && <Cell icon="receipt-text-outline" title="Đơn hàng của tôi" value={`${orders.length} đơn hàng`} onPress={() => navigation.navigate('OrderHistory')} />}
        <Cell icon="account-edit-outline" title="Sửa thông tin" onPress={() => navigation.navigate('EditProfile')} />
        <Cell icon="lock-outline" title="Đổi mật khẩu" onPress={() => navigation.navigate('ChangePassword')} last />
      </View>

      <Button title="Đăng xuất" variant="danger" icon="logout" onPress={askLogout} style={{ marginTop: 24 }} />
    </ScrollView>
  );
}

function Cell({ icon, title, value, onPress, last }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? title : undefined} style={({ pressed }) => [s.cell, !last && s.cellLine, pressed && { backgroundColor: colors.sunken }]}>
      <View style={s.cellIcon}><Icon name={icon} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Txt v="bodyStrong" style={{ fontSize: 14 }}>{title}</Txt>
        {value && <Txt v="small" color={colors.inkSoft} numberOfLines={2}>{value}</Txt>}
      </View>
      {onPress && <Icon name="chevron-right" size={22} color={colors.inkMuted} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  role: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.primarySoft },
  guest: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 8 },
  guestIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface, borderRadius: radius.card, padding: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 12, marginTop: 12 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: 16, alignItems: 'center' },
  groupLabel: { marginTop: 26, marginBottom: 8, marginLeft: 4, fontSize: 13 },
  group: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  cell: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  cellLine: { borderBottomWidth: 1, borderBottomColor: colors.bg },
  cellIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
