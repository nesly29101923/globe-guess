// In-round pause: the clock stops; sound, vibration and appearance can be changed; resume or quit.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsPanel } from '../components/SettingsPanel';
import { BigButton, PopIn, Press, T } from '../components/ui';
import { t } from '../i18n/strings';
import { radius, shadow, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

export function PauseSheet({ onResume, onQuit }: { onResume: () => void; onQuit?: () => void }) {
  const colors = usePalette();
  const st = useStyles(makeSt);
  return (
    <View style={st.dim}>
      <PopIn style={[st.sheet, shadow.card]}>
        <T size={22} weight="black" center>{t('pause_title')}</T>
        <SettingsPanel compact />
        <BigButton label={t('resume')} icon="▶" onPress={onResume} testID="pause-resume" />
        {onQuit ? (
          <Press onPress={onQuit} testID="pause-quit">
            <T size={14} weight="bold" color={colors.inkSoft} center style={{ padding: 10 }}>{t('quit_round')}</T>
          </Press>
        ) : null}
      </PopIn>
    </View>
  );
}

const makeSt = (colors: Palette) =>
  StyleSheet.create({
    dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 },
    sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, gap: 10, width: '100%', maxWidth: 400 },
  });
