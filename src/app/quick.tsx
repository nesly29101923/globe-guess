// Quick Play: pick a topic and a difficulty, like the video formats.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QUICK_TOPICS } from '../config/levels';
import { IconButton } from '../components/hud';
import { BigButton, PopIn, Press, T } from '../components/ui';
import { fmt, t, upper } from '../i18n/strings';
import { useGame } from '../store/store';
import { colors, layout, radius, shadow, tierColors, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

const TIERS = ['very_easy', 'easy', 'medium', 'hard', 'very_hard', 'mixed'];
const ICONS: Record<string, string> = {
  world_map: '🌍', usa_map: '🇺🇸', world_flags: '🚩', europe_map: '🏰', asia_map: '🏯', africa_map: '🦁', americas_map: '🌎',
  oceania_map: '🏝️', europe_flags: '🇪🇺', pick_flag: '🏳️',
};

export default function QuickScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const best = useGame((g) => g.save.best);
  const [topic, setTopic] = useState('world_map');
  const [tier, setTier] = useState('mixed');
  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <IconButton icon="←" onPress={() => router.back()} testID="quick-back" />
        <T size={22} weight="black">{t('quick_title')}</T>
        <View style={{ width: 52 }} />
      </View>
      <ScrollView contentContainerStyle={{ width: W, padding: 12, gap: 12, paddingBottom: 120 + insets.bottom, alignSelf: 'center' }}>
        <T size={13} weight="black" color={colors.inkSoft}>{upper(t('pick_topic'))}</T>
        <View style={st.grid}>
          {QUICK_TOPICS.map((q, i) => (
            <PopIn key={q.id} delay={i * 30} style={st.cell}>
              <Press onPress={() => setTopic(q.id)} testID={`quick-${q.id}`}>
                <View style={[st.topic, shadow.soft, topic === q.id && st.sel]}>
                  <T size={26}>{ICONS[q.id]}</T>
                  <T size={13} weight="black" center>{t(`qt_${q.id}` as never)}</T>
                  {best[`quick:${q.id}:${tier}`] ? <T size={10} weight="bold" color={colors.inkSoft}>{`${t('best')} ${fmt(best[`quick:${q.id}:${tier}`])}`}</T> : null}
                </View>
              </Press>
            </PopIn>
          ))}
        </View>
        <T size={13} weight="black" color={colors.inkSoft}>{upper(t('pick_tier'))}</T>
        <View style={st.tiers}>
          {TIERS.map((x) => (
            <Press key={x} onPress={() => setTier(x)} testID={`tier-${x}`}>
              <View style={[st.tier, { backgroundColor: tier === x ? tierColors[x] : colors.white }, shadow.soft]}>
                <T size={12} weight="black" color={tier === x ? colors.white : colors.ink}>{t(`tier_${x}` as never)}</T>
              </View>
            </Press>
          ))}
        </View>
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 12, width: W }]}>
        <BigButton label={t('start')} icon="▶" breathe onPress={() => router.replace({ pathname: '/play', params: { mode: 'quick', quick: topic, tier, nonce: String(Date.now()) } })} testID="quick-start" />
      </View>
    </View>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1 },
  topic: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, alignItems: 'center', gap: 2, minHeight: 96, justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  sel: { borderColor: colors.accent },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tier: { borderRadius: 99, paddingHorizontal: 14, height: 44, justifyContent: 'center' },
  bottom: { position: 'absolute', bottom: 0, paddingHorizontal: 16 },
});
