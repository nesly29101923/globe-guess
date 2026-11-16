// Light or dark, decided once at the root and handed down by context. Components must not each subscribe to the
// store for it: with hundreds of texts and icons on screen that was hundreds of listeners.
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useGame } from '../store/store';
import { colors, darkColors, type Palette } from './index';

const ThemeContext = createContext<{ dark: boolean; palette: Palette }>({ dark: false, palette: colors });

/** Resolves Settings > Appearance (system by default). Used once, by the root layout. */
export function useResolvedDark(): boolean {
  const mode = useGame((g) => g.save.settings.appearance);
  const system = useColorScheme();
  return mode === 'dark' || (mode === 'system' && system === 'dark');
}

export function ThemeProvider({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const value = useMemo(() => ({ dark, palette: dark ? darkColors : colors }), [dark]);
  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useIsDark(): boolean {
  return useContext(ThemeContext).dark;
}

export function usePalette(): Palette {
  return useContext(ThemeContext).palette;
}

// One style table per (style factory, palette), shared by every instance of a component.
const cache = new WeakMap<object, Map<Palette, unknown>>();

export function useStyles<T>(make: (c: Palette) => T): T {
  const c = usePalette();
  let byPalette = cache.get(make);
  if (!byPalette) {
    byPalette = new Map();
    cache.set(make, byPalette);
  }
  let st = byPalette.get(c) as T | undefined;
  if (!st) {
    st = make(c);
    byPalette.set(c, st);
  }
  return st;
}
