// 7-day login calendar. Rewards rise; a chest on day 7. Missing a day pauses it, never resets it.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { balance } from '../config/balance';
import { BigButton, PopIn, Press, T } from '../components/ui';
import { fmt, t } from '../i18n/strings';
import { canClaimLogin } from '../logic/daily';
import type { SaveState } from '../logic/save';
import { colors, radius, shadow } from '../theme';

export function LoginCalendar({ save, today, onClaim, onClose }: { save: SaveState; today: string; onClaim: () => void; onClose: () => void }) {
  const cal = balance.daily.loginCalendar;
  const claimable = canClaimLogin(save, today);
  const nextIdx = save.login.next % cal.length;
  return (
    <View style={st.dim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <PopIn style={[st.sheet, shadow.card]}>
        <T size={22} weight="black" center>{t('login_title')}</T>
        <View style={st.grid}>
          {cal.map((c, i) => {
            const done = i < nextIdx || (!claimable && i === (nextIdx + cal.length - 1) % cal.length && save.login.lastDay === today);
            const isToday = claimable && i === nextIdx;
            const chest = i === cal.length - 1;
            return (
              <View key={i} style={[st.day, chest && st.dayChest, isToday && st.today, done && st.done]}>
                <T size={10} weight="bold" color={isToday ? colors.white : colors.inkSoft}>{t('login_day', { n: i + 1 })}</T>
                <T size={chest ? 30 : 22}>{done ? '✅' : chest ? '🎁' : '🪙'}</T>
                <T size={12} weight="black" color={isToday ? colors.white : colors.ink}>{fmt(c)}</T>
              </View>
            );
          })}
        </View>
        {claimable ? <BigButton label={`${t('claim')} +${fmt(cal[nextIdx])}`} icon="🪙" onPress={onClaim} breathe testID="login-claim" /> : (
          <Press onPress={onClose} testID="login-close"><T size={15} weight="bold" color={colors.inkSoft} center style={{ padding: 10 }}>{t('claimed')} ✓</T></Press>
        )}
      </PopIn>
    </View>
  );
}

const st = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center', padding: 18, zIndex: 40 },
  sheet: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 18, gap: 14, width: '100%', maxWidth: 400 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  day: { width: 76, height: 92, borderRadius: radius.md, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayChest: { width: 160, backgroundColor: colors.goldSoft },
  today: { backgroundColor: colors.accent },
  done: { opacity: 0.55 },
});
