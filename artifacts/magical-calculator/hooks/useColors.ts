import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import colors from '@/constants/colors';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const THEME_KEY = '@magical-calculator/theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((storedTheme) => {
        if (storedTheme === 'light' || storedTheme === 'dark') setThemeState(storedTheme);
      })
      .catch(() => undefined);
  }, []);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    AsyncStorage.setItem(THEME_KEY, nextTheme).catch(() => undefined);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export function useColors() {
  const { theme } = useTheme();
  return { ...colors[theme], radius: colors.radius };
}
