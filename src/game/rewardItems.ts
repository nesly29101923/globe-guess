// How a level reward is shown (icon + label), on the level-up screen and the home "next reward" line.
import type { LevelReward } from '../config/balance';
import { fmt, t } from '../i18n/strings';

export function rewardItems(r: LevelReward, levelUpCoins = 0): { icon: string; label: string }[] {
  const out: { icon: string; label: string }[] = [];
  const coins = levelUpCoins + (r.coins ?? 0);
  if (coins) out.push({ icon: '🪙', label: `+${fmt(coins)}` });
  if (r.unlock) out.push({ icon: r.unlock === 'daily' ? '📅' : r.unlock === 'quick' ? '⚡' : '💀', label: t(`unlock_${r.unlock}` as never) });
  if (r.cosmetic) out.push({ icon: r.cosmetic.startsWith('btn_') ? '🔘' : '🗺️', label: r.cosmetic.startsWith('btn_') ? t(r.cosmetic as never) : t(`theme_${r.cosmetic}` as never) });
  if (r.title) out.push({ icon: '🏅', label: t(`title_level_${r.title}` as never) });
  if (r.streakFreeze) out.push({ icon: '🧊', label: t('streak_freeze') });
  for (const [k, v] of Object.entries(r.powerups ?? {})) {
    out.push({ icon: k === 'fiftyFifty' ? '½' : k === 'freeze' ? '❄️' : k === 'skip' ? '⏭️' : '🔁', label: `+${v} ${t(`pu_${k}` as never)}` });
  }
  return out;
}

/** One short line: "Level 8: Bubble buttons". */
export function rewardLine(level: number, r: LevelReward): string {
  const first = rewardItems(r)[0];
  return first ? t('next_reward', { n: level, reward: `${first.icon} ${first.label.replace(/^\+/, '')}` }) : '';
}
