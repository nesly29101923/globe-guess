// The Atlas: every country, flag and state is a card. The world fills with colour as the player discovers it.
import { Canvas, Group, Path, Rect, LinearGradient, Skia, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { IconButton } from '../components/hud';
import { PopIn, Press, ProgressBar, T } from '../components/ui';
import { FLAG_IMAGES } from '../data/flagImages';
import { ATLAS_REGIONS, itemName } from '../data/gameData';
import { t } from '../i18n/strings';
import { cardKey, masteryOf, regionProgress } from '../logic/atlas';
import { neutralCam, WRAP } from '../map/camera';
import { donePath, scopePaths } from '../map/shapes';
import { useGame } from '../store/store';
import { colors, layout, mapThemes, radius, shadow } from '../theme';

export default function AtlasScreen() {
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const save = useGame((g) => g.save);
  const [open, setOpen] = useState<string | null>(null);
  const discoveredCountries = useMemo(() => Object.keys(save.atlas).filter((k) => k.startsWith('country:')).map((k) => k.slice(8)), [save.atlas]);

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <IconButton icon="←" onPress={() => router.back()} testID="atlas-back" />
        <T size={22} weight="black">{t('atlas_title')}</T>
        <View style={{ width: 52 }} />
      </View>
      <ScrollView contentContainerStyle={{ width: W, padding: 12, gap: 10, paddingBottom: insets.bottom + 24, alignSelf: 'center' }}>
        <PopIn style={[st.mapCard, shadow.card]}>
          <WorldFill width={W - 24} ids={discoveredCountries} />
          <View style={st.mapLabel}><T size={12} weight="black">{t('atlas_discovered', { n: Object.keys(save.atlas).length })}</T></View>
        </PopIn>
        {ATLAS_REGIONS.map((r, i) => {
          const p = regionProgress(save, r.id);
          const isOpen = open === r.id;
          const complete = p.have >= p.total;
          return (
            <PopIn key={r.id} delay={i * 40}>
              <Press onPress={() => setOpen(isOpen ? null : r.id)} testID={`atlas-${r.id}`}>
                <View style={[st.region, shadow.soft]}>
                  <View style={st.rowBetween}>
                    <T size={16} weight="black">{`${complete ? '🏆 ' : ''}${t(`region_${r.id}` as never)}`}</T>
                    <T size={13} weight="black" color={complete ? colors.correct : colors.inkSoft}>{`${p.have}/${p.total}`}</T>
                  </View>
                  <ProgressBar value={p.have / p.total} color={complete ? colors.correct : colors.accent} height={8} />
                  {!complete ? <T size={11} weight="semi" color={colors.inkSoft}>{`🪙 ${balance.rewards.regionCompleteCoins} · ${t('region_complete', { region: t(`region_${r.id}` as never) })}`}</T> : null}
                </View>
              </Press>
              {isOpen ? (
                <View style={st.grid}>
                  {p.ids.map((id) => {
                    const e = save.atlas[cardKey(r.kind, id)];
                    const m = e ? masteryOf(e.days.length) : 0;
                    const flag = r.kind !== 'state' ? FLAG_IMAGES[id] : undefined;
                    return (
                      <View key={id} style={[st.card, !e && st.cardLocked, m === 3 ? st.gold : m === 2 ? st.silver : m === 1 ? st.bronze : null]}>
                        {e ? (flag ? <Image source={flag} style={st.flag} contentFit="cover" /> : <T size={18}>🗺️</T>) : <T size={18} color={colors.inkSoft}>?</T>}
                        <T size={9} weight="bold" center lines={2}>{e ? itemName(id) : t('undiscovered')}</T>
                        {m ? <T size={9}>{m === 3 ? '🥇' : m === 2 ? '🥈' : '🥉'}</T> : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </PopIn>
          );
        })}
      </ScrollView>
    </View>
  );
}

function WorldFill({ width, ids }: { width: number; ids: string[] }) {
  const height = width * 0.55;
  const th = mapThemes.classic;
  const paths = useMemo(() => scopePaths('world', 'all', 2), []);
  const done = useMemo(() => donePath('world', ids, 2), [ids]);
  const cam = neutralCam('world');
  const s = width / (WRAP * 0.98);
  const m = useMemo(() => {
    const mx = Skia.Matrix();
    mx.translate(width / 2 - cam.ux * s + 10, height * 0.56 - cam.uy * s);
    mx.scale(s, s);
    return mx;
  }, [width, height, cam.ux, cam.uy, s]);
  return (
    <Canvas style={{ width, height, borderRadius: radius.lg }}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[th.seaTop, th.seaBottom]} />
      </Rect>
      <Group matrix={m}>
        <Path path={paths.other} color={th.other} />
        <Path path={paths.scope} color={th.land} />
        <Path path={paths.scope} color={th.landEdge} style="stroke" strokeWidth={0.6 / s} />
        <Path path={done} color={th.correct} opacity={0.75} />
      </Group>
    </Canvas>
  );
}

const st = StyleSheet.create({
  bg: { backgroundColor: '#C9E2F6', alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  mapCard: { backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden' },
  mapLabel: { position: 'absolute', left: 10, bottom: 10, backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  region: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 8 },
  card: { width: 70, height: 84, borderRadius: 10, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: 4, gap: 2, borderWidth: 2, borderColor: 'transparent' },
  cardLocked: { backgroundColor: 'rgba(255,255,255,0.55)' },
  bronze: { borderColor: '#D97706' },
  silver: { borderColor: '#94A3B8' },
  gold: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  flag: { width: 44, height: 31, borderRadius: 3 },
});
