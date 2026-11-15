// Offer after a wrong answer (second chance) or after the last life in Survival (continue). The clock is stopped.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PopIn, Press, SmallButton, T } from '../components/ui';
import { t } from '../i18n/strings';
import { colors, radius, shadow } from '../theme';

export function SecondChanceSheet({ onPick, items, free, adOk, survival }: {
  onPick: (how: 'item' | 'free' | 'ad' | 'no') => void; items: number; free: boolean; adOk: boolean; survival?: boolean;
}) {
  return (
    <View style={st.dim}>
      <PopIn style={[st.sheet, shadow.card]}>
        <T size={22} weight="black" center>{survival ? t('result_survival') : t('second_chance_title')}</T>
        <T size={14} weight="semi" color={colors.inkSoft} center>{survival ? t('survival_continue') : t('pu_secondChance_desc')}</T>
        <View style={st.row}>
          {free ? <SmallButton label={t('pu_free_try')} icon="🎁" color={colors.correct} textColor={colors.white} onPress={() => onPick('free')} testID="sc-free" /> : null}
          {!free && items > 0 ? <SmallButton label={`${t('pu_secondChance')} (${items})`} icon="🔁" color={colors.accent} textColor={colors.white} onPress={() => onPick('item')} testID="sc-item" /> : null}
          {!free && adOk ? <SmallButton label={t('watch_ad')} icon="▶" color={colors.gold} textColor={colors.white} onPress={() => onPick('ad')} testID="sc-ad" /> : null}
        </View>
        <Press onPress={() => onPick('no')} testID="sc-no">
          <T size={14} weight="bold" color={colors.inkSoft} center style={{ paddingVertical: 10 }}>{survival ? t('end_run') : t('close')}</T>
        </Press>
      </PopIn>
    </View>
  );
}

const st = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 20, gap: 12, width: '100%', maxWidth: 380 },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
});
