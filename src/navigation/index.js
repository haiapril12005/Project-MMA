import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import ProductListScreen from '../screens/ProductListScreen';
import DetailScreen from '../screens/DetailScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { LoginScreen, RegisterScreen, EditProfileScreen, ChangePasswordScreen } from '../screens/AuthScreens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HomeTab = () => <ProductListScreen />;
const FavTab = () => <ProductListScreen onlyFavorites />;

function Tabs() {
  const { colors } = useTheme();
  const icons = { Home: ['home', 'home-outline'], Favorites: ['heart', 'heart-outline'], Profile: ['account', 'account-outline'] };
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.outline },
        tabBarIcon: ({ focused, color, size }) => <MaterialCommunityIcons name={icons[route.name][focused ? 0 : 1]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeTab} options={{ title: 'Trang chủ' }} />
      <Tab.Screen name="Favorites" component={FavTab} options={{ title: 'Yêu thích' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Tài khoản' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { colors } = useTheme();
  const { ready } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  const header = { headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.onSurface, headerShadowVisible: false };
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Chi tiết sản phẩm' }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Giỏ hàng' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Đăng nhập', presentation: 'modal' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Đăng ký', presentation: 'modal' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Sửa thông tin' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Đổi mật khẩu' }} />
    </Stack.Navigator>
  );
}
