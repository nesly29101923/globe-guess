import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useGame } from '../store/store';
import { colors, darkColors, type Palette } from './index';

/** Light or dark, from Settings > Appearance (system by default). */
export function useIsDark(): boolean {
  const mode = useGame((g) => g.save.settings.appearance);
  const system = useColorScheme();
  return mode === 'dark' || (mode === 'system' && system === 'dark');
}

export function usePalette(): Palette {
  return useIsDark() ? darkColors : colors;
}

export function useStyles<T>(make: (c: Palette) => T): T {
  const c = usePalette();
  return useMemo(() => make(c), [c, make]);
}
