import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components/hud';
import { SettingsPanel } from '../components/SettingsPanel';
import { PopIn, Press, T } from '../components/ui';
import { askPrompt } from '../game/hosts';
import { t } from '../i18n/strings';
import { grantProduct } from '../logic/economy';
import { purchases } from '../services/purchases';
import { useGame } from '../store/store';
import { colors, layout, radius, shadow, type Palette } from '../theme';
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
    setRestored(ids.length ? `✓ ${ids.length}` : '✓');
  };
  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <IconButton icon="←" onPress={() => router.back()} testID="settings-back" />
        <T size={22} weight="black">{t('settings_title')}</T>
        <View style={{ width: 52 }} />
      </View>
      <ScrollView contentContainerStyle={{ width: W, padding: 12, gap: 12, alignSelf: 'center', paddingBottom: insets.bottom + 24 }}>
        <PopIn style={[st.card, shadow.soft]}>
          <SettingsPanel />
        </PopIn>
        <PopIn delay={60} style={[st.card, shadow.soft]}>
          <Row icon="♻️" label={restored ? `${t('restore')} ${restored}` : t('restore')} onPress={restore} testID="settings-restore" />
          <Row icon="🛡️" label={t('privacy_choices')} onPress={() => askPrompt('consent')} testID="settings-consent" />
          <Row icon="📄" label={t('privacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Row icon="🌐" label={`${t('language')}: English`} onPress={() => {}} />
        </PopIn>
        <PopIn delay={120} style={[st.card, shadow.soft, { gap: 6 }]}>
          <T size={13} weight="black">{t('credits')}</T>
          <T size={12} weight="semi" color={colors.inkSoft}>{t('credits_text')}</T>
          <T size={11} weight="semi" color={colors.inkSoft}>{t('version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</T>
        </PopIn>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} testID={testID}>
      <View style={st.row}>
        <T size={20}>{icon}</T>
        <T size={15} weight="bold" style={{ flex: 1 }}>{label}</T>
        <T size={16} color={colors.inkSoft}>›</T>
      </View>
    </Press>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
});
