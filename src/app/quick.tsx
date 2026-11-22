// Quick Play: pick a topic and a difficulty, like the video formats. One screen, no scrolling.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QUICK_TOPICS } from '../config/levels';
import { ScreenHeader } from '../components/hud';
import { Icon, type IconName } from '../components/Icon';
import { BigButton, PopIn, Press, T } from '../components/ui';
import { fmt, t, upper } from '../i18n/strings';
import { useGame } from '../store/store';
import { layout, radius, shadow, sizes, tierColors, type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

const TIERS = ['very_easy', 'easy', 'medium', 'hard', 'very_hard', 'mixed'];
const ICONS: Record<string, IconName> = {
  world_map: 'earth', usa_map: 'flag-variant', world_flags: 'flag', europe_map: 'castle', asia_map: 'temple-buddhist', africa_map: 'elephant',
  americas_map: 'earth', oceania_map: 'palm-tree', europe_flags: 'flag-outline', pick_flag: 'flag-checkered',
  world_capitals: 'city-variant', europe_capitals: 'city', usa_capitals: 'bank',
  world_bigger: 'resize', world_borders: 'vector-difference', usa_borders: 'vector-difference-ab',
};

export default function QuickScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const best = useGame((g) => g.save.best);
  const [topic, setTopic] = useState('world_map');
  const [tier, setTier] = useState('mixed');
  // the topic grid takes the height that is left, so the screen fits any phone
  const fixed = insets.top + 8 + sizes.hud + 10 + 22 + 22 + 2 * 44 + 8 + 14 * 3 + sizes.big + insets.bottom + 24;
  const rows = Math.ceil(QUICK_TOPICS.length / 2);
  const tileH = Math.max(40, Math.min(64, (SH - fixed) / rows - 8));
  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <ScreenHeader title={t('quick_title')} onBack={() => router.back()} testID="quick-back" />
      </View>
      <View style={{ width: W, paddingHorizontal: 12, gap: 8 }}>
        <T size={type.label} weight="black" color={colors.inkSoft}>{upper(t('pick_topic'))}</T>
        <View style={st.grid}>
          {QUICK_TOPICS.map((q, i) => {
            const sel = topic === q.id;
            const b = best[`quick:${q.id}:${tier}`];
            return (
              <PopIn key={q.id} delay={i * 20} style={st.cell}>
                <Press onPress={() => setTopic(q.id)} testID={`quick-${q.id}`} scaleTo={0.96}>
                  <View style={[st.topic, shadow.soft, { height: tileH }, sel && st.sel]}>
                    <View style={[st.topicIcon, sel && { backgroundColor: colors.accent }]}><Icon name={ICONS[q.id] ?? 'earth'} size={20} color={sel ? colors.white : colors.accent} /></View>
                    <View style={{ flex: 1 }}>
                      <T size={type.label} weight="black" lines={2}>{t(`qt_${q.id}` as never)}</T>
                      {b ? <T size={type.caption} weight="bold" color={colors.inkSoft}>{`${t('best')} ${fmt(b)}`}</T> : null}
                    </View>
                  </View>
                </Press>
              </PopIn>
            );
          })}
        </View>
        <T size={type.label} weight="black" color={colors.inkSoft} style={{ marginTop: 6 }}>{upper(t('pick_tier'))}</T>
        <View style={st.tiers}>
          {TIERS.map((x) => (
            <Press key={x} onPress={() => setTier(x)} testID={`tier-${x}`} style={st.tierCell}>
              <View style={[st.tier, { backgroundColor: tier === x ? tierColors[x] : colors.surface }, shadow.soft]}>
                <T size={type.label} weight="black" color={tier === x ? colors.white : colors.ink} lines={1} shrink>{t(`tier_${x}` as never)}</T>
              </View>
            </Press>
          ))}
        </View>
      </View>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 12, width: W }]}>
        <BigButton label={t('start')} icon="play" breathe onPress={() => router.replace({ pathname: '/play', params: { mode: 'quick', quick: topic, tier, nonce: String(Date.now()) } })} testID="quick-start" />
      </View>
    </View>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { paddingHorizontal: 12, paddingBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%', flexGrow: 1 },
  topic: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2.5, borderColor: 'transparent' },
  topicIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  sel: { borderColor: colors.accent, borderBottomColor: colors.accent },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tierCell: { width: '31%', flexGrow: 1 },
  tier: { borderRadius: radius.pill, paddingHorizontal: 10, height: 44, justifyContent: 'center', alignItems: 'center' },
  bottom: { position: 'absolute', bottom: 0, paddingHorizontal: 16 },
});
