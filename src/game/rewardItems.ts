// How a level reward is shown (icon + label), on the level-up screen, the level sheet and the home reward line.
import type { IconName } from '../components/Icon';
import type { LevelReward } from '../config/balance';
import { fmt, t } from '../i18n/strings';

export type RewardItem = { icon: IconName | 'coin'; label: string };

const PU_ICON: Record<string, IconName> = { fiftyFifty: 'circle-half-full', freeze: 'snowflake', skip: 'skip-next', secondChance: 'backup-restore' };

export function rewardItems(r: LevelReward, levelUpCoins = 0): RewardItem[] {
  const out: RewardItem[] = [];
  const coins = levelUpCoins + (r.coins ?? 0);
  if (coins) out.push({ icon: 'coin', label: `+${fmt(coins)}` });
  if (r.unlock) out.push({ icon: r.unlock === 'daily' ? 'calendar-star' : r.unlock === 'quick' ? 'lightning-bolt' : 'skull', label: t(`unlock_${r.unlock}` as never) });
  if (r.cosmetic) out.push({ icon: r.cosmetic.startsWith('btn_') ? 'gesture-tap-button' : 'map', label: r.cosmetic.startsWith('btn_') ? t(r.cosmetic as never) : t(`theme_${r.cosmetic}` as never) });
  if (r.title) out.push({ icon: 'medal', label: t(`title_level_${r.title}` as never) });
  if (r.streakFreeze) out.push({ icon: 'snowflake', label: t('streak_freeze') });
  for (const [k, v] of Object.entries(r.powerups ?? {})) {
    out.push({ icon: PU_ICON[k] ?? 'star', label: `+${v} ${t(`pu_${k}` as never)}` });
  }
  return out;
}

/** The headline item of a level reward: a chest if there is one, else the first item. */
export function rewardHeadline(r: LevelReward): RewardItem | null {
  const items = rewardItems(r);
  if (r.chest) return { icon: 'treasure-chest', label: items.map((i) => i.label.replace(/^\+/, '')).slice(0, 2).join(' · ') || t('chest_open') };
  return items[0] ? { icon: items[0].icon, label: items[0].label.replace(/^\+/, '') } : null;
}

/** One short line: "Level 8: Bubble". */
export function rewardLine(level: number, r: LevelReward): string {
  const h = rewardHeadline(r);
  return h ? t('next_reward', { n: level, reward: h.label }) : '';
}
