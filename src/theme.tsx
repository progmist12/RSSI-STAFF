import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useColorScheme} from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  muted: string;
  line: string;
  blue: string;
  blueSoft: string;
  green: string;
  greenSoft: string;
  amber: string;
  amberSoft: string;
  orange: string;
  orangeSoft: string;
  red: string;
  redSoft: string;
  shadow: string;
};

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F3F6FB', surface: '#FFFFFF', surfaceAlt: '#F7F9FC', ink: '#15233B',
    muted: '#687891', line: '#E2E8F1', blue: '#2456D7', blueSoft: '#EAF0FF',
    green: '#168452', greenSoft: '#E8F6EE', amber: '#B66A00', amberSoft: '#FFF4DC', orange: '#C65B12', orangeSoft: '#FFF0E5',
    red: '#C54444', redSoft: '#FFF0F0', shadow: '#243754',
  },
  dark: {
    background: '#0E1725', surface: '#172438', surfaceAlt: '#1C2B42', ink: '#F1F5FC',
    muted: '#A5B3C8', line: '#2C3D56', blue: '#83A8FF', blueSoft: '#24385F',
    green: '#65D09A', greenSoft: '#1D3B32', amber: '#FFC46A', amberSoft: '#45371F', orange: '#FFA66B', orangeSoft: '#4A3024',
    red: '#FF8E91', redSoft: '#472A34', shadow: '#000000',
  },
};

type ThemeContextValue = {mode: ThemeMode; resolved: 'light' | 'dark'; colors: Palette; setMode: (mode: ThemeMode) => Promise<void>};
const ThemeContext = createContext<ThemeContextValue>({mode: 'system', resolved: 'light', colors: palettes.light, setMode: async () => undefined});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemMode = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem('rssi_staff_theme').then(saved => {
      if (alive && (saved === 'system' || saved === 'light' || saved === 'dark')) setModeState(saved);
    }).catch(() => undefined);
    return () => {alive = false;};
  }, []);
  const resolved = mode === 'system' ? (systemMode === 'dark' ? 'dark' : 'light') : mode;
  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    try { await AsyncStorage.setItem('rssi_staff_theme', next); } catch { /* retain setting for this run */ }
  }, []);
  const value = useMemo(() => ({mode, resolved, colors: palettes[resolved], setMode}), [mode, resolved, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {return useContext(ThemeContext);}

