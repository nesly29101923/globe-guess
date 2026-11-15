// The 9:16 share image: the videos' end card with the player's score and the game's name. Rendered off-screen.
import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { APP } from '../config/app';
import { t } from '../i18n/strings';
import { colors, radius } from '../theme';
import { T } from './ui';

export const ShareCard = forwardRef<React.ComponentRef<typeof View>, { correct: number; total: number; title: string; stars: number; grid?: string; subtitle: string }>(
  function ShareCard({ correct, total, title, stars, grid, subtitle }, ref) {
    return (
      <View ref={ref} collapsable={false} style={st.card}>
        <View style={st.sea} />
        <View style={st.title}>
          <T size={22} weight="black" center>{title}</T>
          <View style={st.chip}><T size={11} weight="bold">{subtitle}</T></View>
        </View>
        <View style={st.score}>
          <T size={20} weight="black" center>{t('result_title')}</T>
          <T size={72} weight="black" center color={colors.accent}>{`${correct}/${total}`}</T>
          {stars > 0 ? <T size={36} center>{'★'.repeat(stars) + '☆'.repeat(3 - stars)}</T> : null}
          {grid ? <T size={20} center>{grid}</T> : null}
          <T size={15} weight="semi" color={colors.inkSoft} center>{t('share_card_line')}</T>
        </View>
        <View style={st.brand}>
          <T size={26} weight="black" color={colors.white} center>{APP.name}</T>
          <T size={13} weight="bold" color="rgba(255,255,255,0.9)" center>{APP.channelHandle}</T>
        </View>
      </View>
    );
  },
);

const st = StyleSheet.create({
  card: { position: 'absolute', left: -2000, top: 0, width: 270, height: 480, backgroundColor: '#C2DEF5', padding: 16, justifyContent: 'space-between' },
  sea: { ...StyleSheet.absoluteFill, backgroundColor: '#B4D6F2', opacity: 0.5, top: 240 },
  title: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 12, alignItems: 'center', gap: 6 },
  chip: { backgroundColor: colors.chip, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  score: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 14, alignItems: 'center', gap: 4 },
  brand: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: 10 },
});
