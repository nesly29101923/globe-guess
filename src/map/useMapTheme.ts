// The map theme the player has chosen (the dark version of the classic one when the game is dark).
import { COSMETICS } from '../config/cosmetics';
import { useGame } from '../store/store';
import { mapThemes, type MapTheme } from '../theme';
import { useIsDark } from '../theme/usePalette';

export function useMapTheme(): MapTheme {
  const id = useGame((g) => g.save.cosmetics.mapTheme);
  const dark = useIsDark();
  const chosen = COSMETICS.find((c) => c.id === id)?.theme ?? 'classic';
  return mapThemes[chosen === 'classic' && dark ? 'night' : chosen] ?? mapThemes.classic;
}
