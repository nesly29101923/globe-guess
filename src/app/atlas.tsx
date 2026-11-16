// The Atlas: every country, flag and state is a card. One screen: the world filling with colour as the player
// discovers it, and the regions as tiles. A region opens its cards in a sheet.
import { Canvas, Group, Path, Rect, LinearGradient, Skia, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { ScreenHeader } from '../components/hud';
import { Coin, Icon, type IconName } from '../components/Icon';
import { PopIn, Press, ProgressBar, Sheet, SheetTitle, T } from '../components/ui';
import { FLAG_IMAGES } from '../data/flagImages';
import { ATLAS_REGIONS, itemName } from '../data/gameData';
import { t } from '../i18n/strings';
import { cardKey, masteryOf, regionProgress } from '../logic/atlas';
import { neutralCam, WRAP } from '../map/camera';
import { donePath, scopePaths } from '../map/shapes';
import { useGame } from '../store/store';
import { layout, mapThemes, radius, shadow, type, type Palette } from '../theme';
import { useIsDark, usePalette, useStyles } from '../theme/usePalette';

const REGION_ICONS: Record<string, IconName> = {
  europe: 'castle', asia: 'temple-buddhist', africa: 'elephant', americas: 'earth', oceania: 'palm-tree', usa: 'flag-variant', flags: 'flag',
};

export default function AtlasScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const save = useGame((g) => g.save);
  const [open, setOpen] = useState<string | null>(null);
  const discoveredCountries = useMemo(() => Object.keys(save.atlas).filter((k) => k.startsWith('country:')).map((k) => k.slice(8)), [save.atlas]);
  const compact = SH < 740;
  const openRegion = ATLAS_REGIONS.find((r) => r.id === open);
  const openP = openRegion ? regionProgress(save, openRegion.id) : null;
  // six cards a row inside the sheet (screen padding 20, sheet padding 18 on each side)
  const cardW = Math.floor((Math.min(SW - 40, 400) - 36 - 5 * 6) / 6);

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <ScreenHeader title={t('atlas_title')} onBack={() => router.back()} testID="atlas-back" />
      </View>
      <View style={{ width: W, paddingHorizontal: 12, gap: 10, flex: 1, paddingBottom: insets.bottom + 12 }}>
        <PopIn style={[st.mapCard, shadow.card]}>
          <WorldFill width={W - 24} height={compact ? (W - 24) * 0.42 : (W - 24) * 0.52} ids={discoveredCountries} />
          <View style={st.mapLabel}><Icon name="book-open-variant" size={14} color={colors.accent} /><T size={type.label} weight="black">{t('atlas_discovered', { n: Object.keys(save.atlas).length })}</T></View>
        </PopIn>
        <View style={st.tiles}>
          {ATLAS_REGIONS.map((r, i) => {
            const p = regionProgress(save, r.id);
            const complete = p.have >= p.total;
            return (
              <PopIn key={r.id} delay={i * 30} style={st.tileWrap}>
                <Press onPress={() => setOpen(r.id)} testID={`atlas-${r.id}`} scaleTo={0.96}>
                  <View style={[st.tile, shadow.soft, complete && st.tileDone]}>
                    <View style={st.tileHead}>
                      <Icon name={complete ? 'trophy' : REGION_ICONS[r.id] ?? 'earth'} size={22} color={complete ? colors.gold : colors.accent} />
                      <T size={type.body} weight="black" lines={1} shrink style={{ flex: 1 }}>{t(`region_${r.id}` as never)}</T>
                    </View>
                    <ProgressBar value={p.have / p.total} color={complete ? colors.correct : colors.accent} height={6} />
                    <View style={st.tileFoot}>
                      <T size={type.label} weight="black" color={complete ? colors.correct : colors.inkSoft}>{`${p.have}/${p.total}`}</T>
                      {!complete ? <View style={st.inline}><Coin size={14} /><T size={type.caption} weight="bold" color={colors.inkSoft}>{String(balance.rewards.regionCompleteCoins)}</T></View> : null}
                    </View>
                  </View>
                </Press>
              </PopIn>
            );
          })}
        </View>
      </View>
      {openRegion && openP ? (
        <Sheet onClose={() => setOpen(null)} testID="atlas-region" style={{ maxHeight: SH - insets.top - insets.bottom - 40 }}>
          <SheetTitle title={t(`region_${openRegion.id}` as never)} icon={<Icon name={REGION_ICONS[openRegion.id] ?? 'earth'} size={26} color={colors.accent} />} onClose={() => setOpen(null)} />
          <View style={st.rowBetween}>
            <T size={type.label} weight="black" color={colors.inkSoft}>{`${openP.have}/${openP.total}`}</T>
            <View style={st.inline}><Coin size={14} /><T size={type.caption} weight="bold" color={colors.inkSoft}>{t('region_complete', { region: t(`region_${openRegion.id}` as never) })}</T></View>
          </View>
          {/* a collection to browse: this list is the one place that scrolls, inside its sheet */}
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={st.grid} showsVerticalScrollIndicator={false}>
            {openP.ids.map((id) => {
              const e = save.atlas[cardKey(openRegion.kind, id)];
              const m = e ? masteryOf(e.days.length) : 0;
              const flag = openRegion.kind !== 'state' ? FLAG_IMAGES[id] : undefined;
              return (
                <View key={id} style={[st.card, { width: cardW, height: cardW * 1.2 }, !e && st.cardLocked, m === 3 ? st.gold : m === 2 ? st.silver : m === 1 ? st.bronze : null]}>
                  {e ? (flag ? <Image source={flag} style={{ width: cardW * 0.7, height: cardW * 0.49, borderRadius: 3 }} contentFit="cover" /> : <Icon name="map-marker" size={18} color={colors.accent} />) : <Icon name="help" size={18} color={colors.inkSoft} />}
                  {e ? <T size={8} weight="bold" center lines={1}>{itemName(id)}</T> : null}
                </View>
              );
            })}
          </ScrollView>
        </Sheet>
      ) : null}
    </View>
  );
}

function WorldFill({ width, height, ids }: { width: number; height: number; ids: string[] }) {
  const th = mapThemes[useIsDark() ? 'night' : 'classic'];
  const paths = useMemo(() => scopePaths('world', 'all', 2), []);
  const done = useMemo(() => donePath('world', ids, 2), [ids]);
  const cam = neutralCam('world');
  const s = Math.max(width / (WRAP * 0.98), height / (WRAP * 0.62));
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

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { paddingHorizontal: 12, paddingBottom: 10, alignSelf: 'center' },
  mapCard: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden' },
  mapLabel: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 99, paddingHorizontal: 10, height: 26 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: 1, alignContent: 'flex-start' },
  tileWrap: { width: '48%', flexGrow: 1 },
  tile: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 8 },
  tileDone: { borderWidth: 2, borderColor: colors.gold, borderBottomColor: colors.gold },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 4 },
  card: { borderRadius: 8, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', padding: 2, gap: 2, borderWidth: 2, borderColor: 'transparent' },
  cardLocked: { opacity: 0.55 },
  bronze: { borderColor: '#D97706' },
  silver: { borderColor: '#94A3B8' },
  gold: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
});
