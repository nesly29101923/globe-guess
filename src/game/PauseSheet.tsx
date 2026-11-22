// In-round pause: the clock stops. No list to read: three round switches (sound, vibration, music) that show
// their state by colour and icon, then Quit and Resume side by side.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { BigButton, PopIn, Press, Sheet, T } from '../components/ui';
import { t } from '../i18n/strings';
import { useGame } from '../store/store';
import { radius, sizes, type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

type Key = 'sound' | 'haptics' | 'music';
const SWITCHES: { k: Key; on: IconName; off: IconName; label: string }[] = [
  { k: 'sound', on: 'volume-high', off: 'volume-off', label: 'sound' },
  { k: 'haptics', on: 'vibrate', off: 'vibrate-off', label: 'haptics' },
  { k: 'music', on: 'music', off: 'music-off', label: 'music' },
];

export function PauseSheet({ onResume, onQuit }: { onResume: () => void; onQuit?: () => void }) {
  const colors = usePalette();
  const st = useStyles(makeSt);
  const settings = useGame((g) => g.save.settings);
  const update = useGame((g) => g.update);
  return (
    <Sheet style={{ maxWidth: 340, alignItems: 'center', gap: 18, paddingVertical: 22 }}>
      <T size={type.display} weight="black" center>{t('pause_title')}</T>
      <View style={st.switches}>
        {SWITCHES.map((s, i) => {
          const on = settings[s.k];
          return (
            <PopIn key={s.k} delay={i * 40}>
              <Press onPress={() => update((x) => ({ ...x, settings: { ...x.settings, [s.k]: !on } }))} testID={`pause-${s.k}`} scaleTo={0.9}>
                <View style={[st.round, { backgroundColor: on ? colors.accent : colors.chip }]}>
                  <Icon name={on ? s.on : s.off} size={30} color={on ? colors.white : colors.inkSoft} />
                </View>
              </Press>
            </PopIn>
          );
        })}
      </View>
      <View style={st.actions}>
        {onQuit ? (
          <Press onPress={onQuit} testID="pause-quit" scaleTo={0.92}>
            <View style={st.quit}><Icon name="home" size={28} color={colors.inkSoft} /></View>
          </Press>
        ) : null}
        <BigButton label={t('resume')} icon="play" onPress={onResume} testID="pause-resume" style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

const makeSt = (colors: Palette) =>
  StyleSheet.create({
    switches: { flexDirection: 'row', gap: 16 },
    round: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: 'rgba(15,23,42,0.18)' },
    actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', alignItems: 'center' },
    quit: { width: sizes.big, height: sizes.big, borderRadius: radius.xl, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: 'rgba(15,23,42,0.13)' },
  });
