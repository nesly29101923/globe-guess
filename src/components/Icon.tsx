// Icons: one vector icon set (Material Community Icons, a font, so it is as cheap to draw as text) and our coin.
// No emoji anywhere in the UI: emoji look different on every phone and read as an app, not a game.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { usePalette } from '../theme/usePalette';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const iconFont = MaterialCommunityIcons.font;

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const pal = usePalette();
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]} pointerEvents="none">
      <MaterialCommunityIcons name={name} size={size} color={color ?? pal.ink} allowFontScaling={false} />
    </View>
  );
}

/** The game's coin: gold disc, darker rim, inner ring and a highlight. Same drawing everywhere. */
export function Coin({ size = 20, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const rim = Math.max(1.5, size * 0.1);
  return (
    <View style={[st.coin, { width: size, height: size, borderRadius: size / 2, borderWidth: rim }, style]} pointerEvents="none">
      <View style={[st.inner, { width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, borderWidth: Math.max(1, size * 0.07) }]} />
      <View style={[st.shine, { width: size * 0.22, height: size * 0.12, borderRadius: size * 0.1, top: size * 0.12, left: size * 0.2 }]} />
    </View>
  );
}

/** Item icons used for rewards and power-ups, in one place so the same thing always has the same icon. */
export const ICONS = {
  coins: 'coin' as const, // drawn with <Coin />, see RewardIcon
  fiftyFifty: 'circle-half-full' as IconName,
  freeze: 'snowflake' as IconName,
  skip: 'skip-next' as IconName,
  secondChance: 'backup-restore' as IconName,
  streakFreeze: 'snowflake' as IconName,
  heart: 'heart' as IconName,
  streak: 'fire' as IconName,
  chest: 'treasure-chest' as IconName,
  level: 'star-four-points' as IconName,
  title: 'medal' as IconName,
  mapTheme: 'map' as IconName,
  buttonStyle: 'gesture-tap-button' as IconName,
  daily: 'calendar-star' as IconName,
  quick: 'lightning-bolt' as IconName,
  survival: 'skull' as IconName,
  region: 'earth' as IconName,
  atlas: 'book-open-variant' as IconName,
  journey: 'map-marker-path' as IconName,
  shop: 'store' as IconName,
  missions: 'clipboard-check' as IconName,
  calendar: 'gift' as IconName,
  video: 'play-circle' as IconName,
  boss: 'crown' as IconName,
  lock: 'lock' as IconName,
  star: 'star' as IconName,
  check: 'check-bold' as IconName,
};

/** A reward/item icon: the coin is drawn, everything else comes from the icon font. */
export function RewardIcon({ name, size = 22, color }: { name: IconName | 'coin'; size?: number; color?: string }) {
  const pal = usePalette();
  if (name === 'coin') return <Coin size={size} />;
  return <Icon name={name} size={size} color={color ?? ICON_COLORS[name] ?? pal.accent} />;
}

const ICON_COLORS: Partial<Record<string, string>> = {
  fire: '#F97316', snowflake: '#0EA5E9', heart: '#EF4444', 'treasure-chest': '#B45309', medal: '#F59E0B', star: '#F59E0B',
  'star-four-points': '#7C3AED', crown: '#F59E0B', 'skip-next': '#7C3AED', 'circle-half-full': '#7C3AED', 'backup-restore': '#16A34A',
  map: '#0EA5E9', 'gesture-tap-button': '#7C3AED', 'calendar-star': '#7C3AED', 'lightning-bolt': '#F59E0B', skull: '#334155',
};

const st = StyleSheet.create({
  coin: { backgroundColor: '#F59E0B', borderColor: '#D97706', alignItems: 'center', justifyContent: 'center' },
  inner: { borderColor: '#FCD34D', backgroundColor: '#FBBF24' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.75)', transform: [{ rotate: '-30deg' }] },
});
