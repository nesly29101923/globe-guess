import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FxLayer } from '../components/fx';
import { preloadSounds } from '../feedback/sfx';
import { maybeAskConsent } from '../game/consent';
import { AdHost, PromptHost } from '../game/hosts';
import { refreshNotifications } from '../game/notify';
import { analytics } from '../services/analytics';
import { purchases } from '../services/purchases';
import { installRealProviders } from '../services/real';
import { remoteConfig } from '../services/remoteConfig';
import { flushSave, useGame } from '../store/store';
import { fontFiles } from '../theme';
import { useIsDark, usePalette } from '../theme/usePalette';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const ready = useGame((g) => g.ready);
  const dark = useIsDark();
  const pal = usePalette();

  useEffect(() => {
    installRealProviders();
    useGame.getState().init();
    preloadSounds();
    remoteConfig.refresh();
    purchases.init();
    const g = useGame.getState();
    if (g.save.sessions <= 1 && g.save.totalRounds === 0) analytics.log('first_open', {});
    maybeAskConsent();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        flushSave();
        refreshNotifications();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError, ready]);

  if ((!fontsLoaded && !fontError) || !ready) return <View style={{ flex: 1, backgroundColor: pal.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: pal.bg } }} />
        <FxLayer />
        <PromptHost />
        <AdHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
