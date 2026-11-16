import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/hud';
import { Icon, type IconName } from '../components/Icon';
import { SettingsPanel } from '../components/SettingsPanel';
import { PopIn, Press, T } from '../components/ui';
import { askPrompt } from '../game/hosts';
import { t } from '../i18n/strings';
import { grantProduct } from '../logic/economy';
import { purchases } from '../services/purchases';
import { useGame } from '../store/store';
import { layout, radius, shadow, type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

const PRIVACY_URL = 'https://example.com/globeguess/privacy'; // placeholder: host docs/PRIVACY.md and put its URL here

export default function SettingsScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const update = useGame((g) => g.update);
  const [restored, setRestored] = useState<string | null>(null);
  const restore = async () => {
    const ids = await purchases.restore();
    update((s) => ids.reduce((acc, id) => grantProduct(acc, id, useGame.getState().now()), s));
    setRestored(ids.length ? `· ${ids.length}` : '·');
  };
  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <ScreenHeader title={t('settings_title')} onBack={() => router.back()} testID="settings-back" />
      </View>
      <ScrollView contentContainerStyle={{ width: W, padding: 12, gap: 12, alignSelf: 'center', paddingBottom: insets.bottom + 24 }}>
        <PopIn style={[st.card, shadow.soft]}>
          <SettingsPanel />
        </PopIn>
        <PopIn delay={60} style={[st.card, shadow.soft]}>
          <Row icon={restored ? 'check-bold' : 'restore'} label={t('restore')} onPress={restore} testID="settings-restore" />
          <Row icon="shield-account" label={t('privacy_choices')} onPress={() => askPrompt('consent')} testID="settings-consent" />
          <Row icon="file-document" label={t('privacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Row icon="translate" label={`${t('language')}: English`} onPress={() => {}} />
        </PopIn>
        <PopIn delay={120} style={[st.card, shadow.soft, { gap: 6 }]}>
          <T size={type.label} weight="black">{t('credits')}</T>
          <T size={type.label} weight="semi" color={colors.inkSoft}>{t('credits_text')}</T>
          <T size={type.caption} weight="semi" color={colors.inkSoft}>{t('version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</T>
        </PopIn>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} testID={testID}>
      <View style={st.row}>
        <View style={st.iconBox}><Icon name={icon} size={20} color={colors.accent} /></View>
        <T size={type.body} weight="bold" style={{ flex: 1 }}>{label}</T>
        <Icon name="chevron-right" size={22} color={colors.inkSoft} />
      </View>
    </Press>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { paddingHorizontal: 12, paddingBottom: 4 },
  iconBox: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
});
