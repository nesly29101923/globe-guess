// 7-day login calendar. Rewards rise; a chest on day 7. Missing a day pauses it, never resets it.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { balance } from '../config/balance';
import { Coin, Icon } from '../components/Icon';
import { BigButton, Press, Sheet, SheetTitle, T } from '../components/ui';
import { fmt, t } from '../i18n/strings';
import { canClaimLogin } from '../logic/daily';
import type { SaveState } from '../logic/save';
import { radius, type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

export function LoginCalendar({ save, today, onClaim, onClose }: { save: SaveState; today: string; onClaim: () => void; onClose: () => void }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const cal = balance.daily.loginCalendar;
  const claimable = canClaimLogin(save, today);
  const nextIdx = save.login.next % cal.length;
  return (
    <Sheet onClose={onClose} testID="login-sheet">
        <SheetTitle title={t('login_title')} icon={<Icon name="gift" size={26} color={colors.wrong} />} onClose={onClose} />
        <View style={st.grid}>
          {cal.map((c, i) => {
            const done = i < nextIdx || (!claimable && i === (nextIdx + cal.length - 1) % cal.length && save.login.lastDay === today);
            const isToday = claimable && i === nextIdx;
            const chest = i === cal.length - 1;
            return (
              <View key={i} style={[st.day, chest && st.dayChest, isToday && st.today, done && st.done]}>
                <T size={type.caption} weight="bold" color={isToday ? colors.white : colors.inkSoft}>{t('login_day', { n: i + 1 })}</T>
                {done ? <Icon name="check-circle" size={28} color={colors.correct} /> : chest ? <Icon name="treasure-chest" size={34} color={colors.goldDark} /> : <Coin size={26} />}
                <T size={type.label} weight="black" color={isToday ? colors.white : colors.ink}>{fmt(c)}</T>
              </View>
            );
          })}
        </View>
        {claimable ? <BigButton label={`${t('claim')} +${fmt(cal[nextIdx])}`} onPress={onClaim} breathe testID="login-claim" /> : (
          <Press onPress={onClose} testID="login-close">
            <View style={st.claimed}><Icon name="check-bold" size={18} color={colors.correct} /><T size={type.body} weight="bold" color={colors.inkSoft}>{t('claimed')}</T></View>
          </Press>
        )}
    </Sheet>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  day: { width: 78, height: 92, borderRadius: radius.md, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayChest: { width: 164, backgroundColor: colors.goldSoft },
  claimed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48 },
  today: { backgroundColor: colors.accent },
  done: { opacity: 0.55 },
});
