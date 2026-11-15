import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components/hud';
import { PopIn, Press, T } from '../components/ui';
import { askPrompt } from '../game/hosts';
import { setMenuMusic } from '../feedback/sfx';
import { refreshNotifications } from '../game/notify';
import { t } from '../i18n/strings';
import { grantProduct } from '../logic/economy';
import { requestPermission } from '../services/notifications';
import { purchases } from '../services/purchases';
import { useGame } from '../store/store';
import { colors, layout, radius, shadow } from '../theme';

const PRIVACY_URL = 'https://example.com/globeguess/privacy'; // placeholder: host docs/PRIVACY.md and put its URL here

export default function SettingsScreen() {
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const settings = useGame((g) => g.save.settings);
  const update = useGame((g) => g.update);
  const [restored, setRestored] = useState<string | null>(null);
  const set = (k: keyof typeof settings, v: boolean) => {
    update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
    if (k === 'music') setTimeout(() => setMenuMusic(v), 30);
    if (k === 'notifications') {
      if (v) requestPermission().then(() => refreshNotifications());
      else setTimeout(refreshNotifications, 50);
    }
  };
  const restore = async () => {
    const ids = await purchases.restore();
    update((s) => ids.reduce((acc, id) => grantProduct(acc, id, useGame.getState().now()), s));
    setRestored(ids.length ? `✓ ${ids.length}` : '✓');
  };
  const rows: { k: keyof typeof settings; icon: string; label: string }[] = [
    { k: 'sound', icon: '🔊', label: t('sound') },
    { k: 'haptics', icon: '📳', label: t('haptics') },
    { k: 'music', icon: '🎵', label: t('music') },
    { k: 'notifications', icon: '🔔', label: t('notifications') },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <IconButton icon="←" onPress={() => router.back()} testID="settings-back" />
        <T size={22} weight="black">{t('settings_title')}</T>
        <View style={{ width: 52 }} />
      </View>
      <ScrollView contentContainerStyle={{ width: W, padding: 12, gap: 12, alignSelf: 'center', paddingBottom: insets.bottom + 24 }}>
        <PopIn style={[st.card, shadow.soft]}>
          {rows.map((r) => (
            <View key={r.k} style={st.row}>
              <T size={20}>{r.icon}</T>
              <T size={15} weight="bold" style={{ flex: 1 }}>{r.label}</T>
              <Switch value={settings[r.k]} onValueChange={(v) => set(r.k, v)} trackColor={{ true: colors.accent, false: colors.track }} thumbColor={colors.white} testID={`setting-${r.k}`} />
            </View>
          ))}
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

const st = StyleSheet.create({
  bg: { backgroundColor: '#C9E2F6', alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
});
