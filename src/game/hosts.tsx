// Global overlays mounted once at the root: the fake ad, the notification pre-prompt and the privacy consent.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '../components/Icon';
import { BigButton, PopIn, Press, T } from '../components/ui';
import { t } from '../i18n/strings';
import { onFakeAd, type Placement } from '../services/ads';
import { requestPermission } from '../services/notifications';
import { useGame } from '../store/store';
import { radius, shadow, type, type Palette } from '../theme';
import { refreshNotifications } from './notify';
import { usePalette, useStyles } from '../theme/usePalette';

// ---------------------------------------------------------------- fake ads

export function AdHost() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const [req, setReq] = useState<{ kind: 'rewarded' | 'interstitial'; placement: Placement; done: (w: boolean) => void } | null>(null);
  const [left, setLeft] = useState(2);
  useEffect(() => onFakeAd((r) => {
    setReq(r);
    setLeft(2);
  }), []);
  useEffect(() => {
    if (!req) return;
    const h = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(h);
  }, [req]);
  if (!req) return null;
  return (
    <View style={[StyleSheet.absoluteFill, st.ad]} testID="fake-ad">
      <T size={type.body} weight="bold" color="rgba(255,255,255,0.6)">{`${t('ad_test')} · ${req.kind} · ${req.placement}`}</T>
      {left > 0 ? <T size={48} weight="black" color={colors.white}>{String(left)}</T> : <Icon name="check-bold" size={48} color={colors.white} />}
      {left <= 0 ? (
        <PopIn>
          <BigButton label={req.kind === 'rewarded' ? t('ad_reward_ready') : t('close')} onPress={() => {
            useGame.getState().setSession({ lastRewardedAt: req.kind === 'rewarded' ? useGame.getState().now() : useGame.getState().session.lastRewardedAt });
            req.done(true);
          }} testID="fake-ad-close" />
        </PopIn>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- prompts

type PromptKind = 'notifications' | 'consent';
let showPrompt: ((k: PromptKind) => void) | null = null;
export function askPrompt(k: PromptKind) {
  showPrompt?.(k);
}

export function PromptHost() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const [kind, setKind] = useState<PromptKind | null>(null);
  useEffect(() => {
    showPrompt = (k) => setKind(k);
    return () => {
      showPrompt = null;
    };
  }, []);
  if (!kind) return null;
  const close = () => setKind(null);
  if (kind === 'notifications') {
    return (
      <View style={st.dim}>
        <PopIn style={[st.sheet, shadow.card]}>
          <View style={{ alignItems: 'center' }}><Icon name="bell-ring" size={44} color={colors.accent} /></View>
          <T size={type.title} weight="black" center>{t('notif_ask_title')}</T>
          <T size={type.body} weight="semi" color={colors.inkSoft} center>{t('notif_ask_body')}</T>
          <BigButton label={t('notif_yes')} onPress={async () => {
            close();
            useGame.getState().update((s) => ({ ...s, prompts: { ...s.prompts, notifications: 'asked' } }));
            await requestPermission();
            refreshNotifications();
          }} testID="notif-yes" />
          <Press onPress={() => { close(); useGame.getState().update((s) => ({ ...s, prompts: { ...s.prompts, notifications: 'asked' } })); }} testID="notif-no">
            <T size={type.body} weight="bold" color={colors.inkSoft} center style={{ padding: 8 }}>{t('notif_no')}</T>
          </Press>
        </PopIn>
      </View>
    );
  }
  return (
    <View style={st.dim}>
      <PopIn style={[st.sheet, shadow.card]}>
        <T size={type.title} weight="black" center>{t('consent_title')}</T>
        <T size={type.body} weight="semi" color={colors.inkSoft} center>{t('consent_body')}</T>
        <BigButton label={t('consent_accept')} onPress={() => { close(); setConsent(true); }} testID="consent-yes" />
        <Press onPress={() => { close(); setConsent(false); }} testID="consent-no">
          <T size={type.body} weight="bold" color={colors.ink} center style={{ padding: 8 }}>{t('consent_decline')}</T>
        </Press>
      </PopIn>
    </View>
  );
}

function setConsent(personalised: boolean) {
  useGame.getState().update((s) => ({ ...s, prompts: { ...s.prompts, tracking: 'asked' }, settings: { ...s.settings }, ads: { ...s.ads } }));
  import('./consent').then((m) => m.applyConsent(personalised));
}

const make_st = (colors: Palette) => StyleSheet.create({
  ad: { backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 90 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, gap: 10, width: '100%', maxWidth: 380 },
});
