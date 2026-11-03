import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';
import TabBar from '../components/TabBar';
import { Skeleton } from '../components/ui';
import HomeScreen from '../screens/HomeScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DetailScreen from '../screens/DetailScreen';
import { LoginScreen, RegisterScreen, EditProfileScreen, ChangePasswordScreen } from '../screens/AuthScreens';
import { CheckoutScreen, OrderSuccessScreen, OrderHistoryScreen, OrderDetailScreen } from '../screens/OrderScreens';
import CollectionScreen from '../screens/CollectionScreen';
import AdminScreen from '../screens/AdminScreen';
import { AdminOrderScreen, AdminOrdersScreen } from '../screens/AdminOrdersScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Admin: Tổng quan (thống kê), Đơn hàng (quản lý), Sản phẩm, Tài khoản
function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="AdminHome" component={AdminScreen} initialParams={{ tab: true }} />
      <Tab.Screen name="AdminOrdersTab" component={AdminOrdersScreen} initialParams={{ tab: true }} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Khách hàng: Trang chủ, Yêu thích, Giỏ hàng, Tài khoản
function Tabs() {
  const { user } = useApp();
  if (user?.isAdmin) return <AdminTabs />;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { ready } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 80, gap: 14 }}>
        <Skeleton style={{ width: '45%', height: 14 }} />
        <Skeleton style={{ width: '75%', height: 30 }} />
        <Skeleton style={{ width: '100%', height: 52, borderRadius: 26, marginTop: 10 }} />
        <Skeleton style={{ width: '100%', height: 200, borderRadius: 20, marginTop: 6 }} />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Detail" component={DetailScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen} />
      <Stack.Screen name="AdminStats" component={AdminScreen} />
      <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
      <Stack.Screen name="AdminOrder" component={AdminOrderScreen} />
    </Stack.Navigator>
  );
}
