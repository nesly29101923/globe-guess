// In-round pause: the clock stops; sound, vibration and appearance can be changed; resume or quit.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsPanel } from '../components/SettingsPanel';
import { Icon } from '../components/Icon';
import { BigButton, Press, Sheet, SheetTitle, T } from '../components/ui';
import { t } from '../i18n/strings';
import { type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

export function PauseSheet({ onResume, onQuit }: { onResume: () => void; onQuit?: () => void }) {
  const colors = usePalette();
  const st = useStyles(makeSt);
  return (
    <Sheet>
      <SheetTitle title={t('pause_title')} icon={<Icon name="pause" size={26} color={colors.accent} />} />
      <SettingsPanel compact />
      <BigButton label={t('resume')} icon="play" onPress={onResume} testID="pause-resume" />
      {onQuit ? (
        <Press onPress={onQuit} testID="pause-quit">
          <View style={st.quit}><Icon name="exit-to-app" size={18} color={colors.inkSoft} /><T size={type.body} weight="bold" color={colors.inkSoft}>{t('quit_round')}</T></View>
        </Press>
      ) : null}
    </Sheet>
  );
}

const makeSt = (colors: Palette) =>
  StyleSheet.create({
    quit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48 },
  });
