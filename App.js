import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { theme } from './src/theme';
import { AppProvider } from './src/context/AppContext';
import RootNavigator from './src/navigation';

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <AppProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AppProvider>
    </PaperProvider>
  );
}
