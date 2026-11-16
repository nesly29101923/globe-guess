// Sound, music, vibration, reminders and appearance. Used by the Settings screen and the in-game settings sheet.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { setMenuMusic } from '../feedback/sfx';
import { refreshNotifications } from '../game/notify';
import { t } from '../i18n/strings';
import type { SaveState } from '../logic/save';
import { requestPermission } from '../services/notifications';
import { useGame } from '../store/store';
import { radius, type, type Palette } from '../theme';
import { Icon, type IconName } from './Icon';
import { usePalette, useStyles } from '../theme/usePalette';
import { Press, T, Toggle } from './ui';

type Toggle = 'sound' | 'music' | 'haptics' | 'notifications' | 'showFps';
type Appearance = SaveState['settings']['appearance'];

export function SettingsPanel({ compact }: { compact?: boolean }) {
  const colors = usePalette();
  const st = useStyles(makeSt);
  const settings = useGame((g) => g.save.settings);
  const update = useGame((g) => g.update);
  const set = (k: Toggle, v: boolean) => {
    update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
    if (k === 'music' && !compact) setTimeout(() => setMenuMusic(v), 30);
    if (k === 'notifications') {
      if (v) requestPermission().then(() => refreshNotifications());
      else setTimeout(refreshNotifications, 50);
    }
  };
  const setAppearance = (a: Appearance) => update((s) => ({ ...s, settings: { ...s.settings, appearance: a } }));
  const rows: { k: Toggle; icon: IconName; label: string }[] = [
    { k: 'sound', icon: 'volume-high', label: t('sound') },
    { k: 'haptics', icon: 'vibrate', label: t('haptics') },
    { k: 'music', icon: 'music', label: t('music') },
    ...(compact ? [] : [{ k: 'notifications' as Toggle, icon: 'bell' as IconName, label: t('notifications') }]),
    { k: 'showFps', icon: 'speedometer', label: t('show_fps') },
  ];
  return (
    <View>
      {rows.map((r) => (
        <View key={r.k} style={st.row}>
          <View style={st.iconBox}><Icon name={r.icon} size={20} color={colors.accent} /></View>
          <T size={type.body} weight="bold" style={{ flex: 1 }}>{r.label}</T>
          <Toggle value={settings[r.k]} onChange={(v) => set(r.k, v)} testID={`setting-${r.k}`} />
        </View>
      ))}
      <View style={st.row}>
        <View style={st.iconBox}><Icon name="theme-light-dark" size={20} color={colors.accent} /></View>
        <T size={type.body} weight="bold" style={{ flex: 1 }}>{t('appearance')}</T>
      </View>
      <View style={st.segment}>
        {(['system', 'light', 'dark'] as Appearance[]).map((a) => {
          const on = settings.appearance === a;
          return (
            <Press key={a} onPress={() => setAppearance(a)} style={{ flex: 1 }} testID={`appearance-${a}`}>
              <View style={[st.segBtn, on && { backgroundColor: colors.accent }]}>
                <T size={type.label} weight="bold" color={on ? colors.white : colors.ink}>{t(`appearance_${a}`)}</T>
              </View>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const makeSt = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
    iconBox: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
    segment: { flexDirection: 'row', gap: 6, backgroundColor: colors.chip, borderRadius: radius.md, padding: 4, marginBottom: 8 },
    segBtn: { height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  });
