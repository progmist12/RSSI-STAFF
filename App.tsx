import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme';
import StaffApp from './src/StaffApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StaffApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
