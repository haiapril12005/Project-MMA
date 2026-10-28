import React from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { colors, navTheme } from './src/theme';
import { AppProvider } from './src/context/AppContext';
import RootNavigator from './src/navigation';
import Toast from './src/components/Toast';
import ConfirmDialog from './src/components/ConfirmDialog';

export default function App() {
  const [fontsLoaded] = useFonts({ BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      {/* Trên trình duyệt máy tính: giữ khung rộng như điện thoại, căn giữa */}
      <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? '#E9DFD4' : colors.bg }}>
        <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: 'center', backgroundColor: colors.bg, overflow: 'hidden' }}>
          <AppProvider>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
            <Toast />
            <ConfirmDialog />
          </AppProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
