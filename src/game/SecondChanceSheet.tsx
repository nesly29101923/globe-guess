// Offer after a wrong answer (second chance) or after the last life in Survival (continue). The clock is stopped.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Press, Sheet, SheetTitle, SmallButton, T } from '../components/ui';
import { t } from '../i18n/strings';
import { type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

export function SecondChanceSheet({ onPick, items, free, adOk, survival }: {
  onPick: (how: 'item' | 'free' | 'ad' | 'no') => void; items: number; free: boolean; adOk: boolean; survival?: boolean;
}) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Sheet style={{ maxWidth: 380 }}>
      <SheetTitle title={survival ? t('result_survival') : t('second_chance_title')} icon={<Icon name={survival ? 'heart-broken' : 'backup-restore'} size={26} color={survival ? colors.heart : colors.correct} />} />
      <T size={type.body} weight="semi" color={colors.inkSoft}>{survival ? t('survival_continue') : t('pu_secondChance_desc')}</T>
      <View style={st.row}>
        {free ? <SmallButton label={t('pu_free_try')} icon="gift" color={colors.correct} textColor={colors.white} onPress={() => onPick('free')} testID="sc-free" style={{ flex: 1 }} /> : null}
        {!free && items > 0 ? <SmallButton label={`${t('pu_secondChance')} (${items})`} icon="backup-restore" color={colors.accent} textColor={colors.white} onPress={() => onPick('item')} testID="sc-item" style={{ flex: 1 }} /> : null}
        {!free && adOk ? <SmallButton label={t('watch_ad')} icon="play-circle" color={colors.gold} textColor={colors.white} onPress={() => onPick('ad')} testID="sc-ad" style={{ flex: 1 }} /> : null}
      </View>
      <Press onPress={() => onPick('no')} testID="sc-no">
        <T size={type.body} weight="bold" color={colors.inkSoft} center style={{ paddingVertical: 12 }}>{survival ? t('end_run') : t('close')}</T>
      </Press>
    </Sheet>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
});
