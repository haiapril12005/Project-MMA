import { MD3LightTheme } from 'react-native-paper';

// Bảng màu Scandinavian: trắng ngà, be, nâu gỗ
export const theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#8B5E3C',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EADBC8',
    onPrimaryContainer: '#3B2616',
    secondary: '#A68A64',
    secondaryContainer: '#F0E6D8',
    onSecondaryContainer: '#4A3B28',
    background: '#FAF7F2',
    surface: '#FFFFFF',
    surfaceVariant: '#F3ECE1',
    onSurface: '#3B2F2A',
    onSurfaceVariant: '#6F625A',
    outline: '#D9CDBD',
  },
};
