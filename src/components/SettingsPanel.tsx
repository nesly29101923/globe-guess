// Sound, music, vibration, reminders and appearance. Used by the Settings screen and the in-game settings sheet.
import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { setMenuMusic } from '../feedback/sfx';
import { refreshNotifications } from '../game/notify';
import { t } from '../i18n/strings';
import type { SaveState } from '../logic/save';
import { requestPermission } from '../services/notifications';
import { useGame } from '../store/store';
import { radius, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';
import { Press, T } from './ui';

type Toggle = 'sound' | 'music' | 'haptics' | 'notifications';
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
  const rows: { k: Toggle; icon: string; label: string }[] = [
    { k: 'sound', icon: '🔊', label: t('sound') },
    { k: 'haptics', icon: '📳', label: t('haptics') },
    { k: 'music', icon: '🎵', label: t('music') },
    ...(compact ? [] : [{ k: 'notifications' as Toggle, icon: '🔔', label: t('notifications') }]),
  ];
  return (
    <View>
      {rows.map((r) => (
        <View key={r.k} style={st.row}>
          <T size={20}>{r.icon}</T>
          <T size={15} weight="bold" style={{ flex: 1 }}>{r.label}</T>
          <Switch value={settings[r.k]} onValueChange={(v) => set(r.k, v)} trackColor={{ true: colors.accent, false: colors.track }}
            thumbColor={colors.white} testID={`setting-${r.k}`} />
        </View>
      ))}
      <View style={st.row}>
        <T size={20}>🌓</T>
        <T size={15} weight="bold" style={{ flex: 1 }}>{t('appearance')}</T>
      </View>
      <View style={st.segment}>
        {(['system', 'light', 'dark'] as Appearance[]).map((a) => {
          const on = settings.appearance === a;
          return (
            <Press key={a} onPress={() => setAppearance(a)} style={{ flex: 1 }} testID={`appearance-${a}`}>
              <View style={[st.segBtn, on && { backgroundColor: colors.accent }]}>
                <T size={13} weight="bold" color={on ? colors.white : colors.ink}>{t(`appearance_${a}`)}</T>
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
    segment: { flexDirection: 'row', gap: 6, backgroundColor: colors.chip, borderRadius: radius.md, padding: 4, marginBottom: 8 },
    segBtn: { height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  });
