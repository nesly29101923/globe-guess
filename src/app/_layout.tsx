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
import { iconFont } from '../components/Icon';
import { warmAllIdle } from '../map/shapes';
import { colors, darkColors } from '../theme';
import { ThemeProvider, useResolvedDark } from '../theme/usePalette';
import { FpsMeter } from '../components/FpsMeter';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // the icon font loads with the text fonts, so no icon pops in late
  const [fontsLoaded, fontError] = useFonts({ ...fontFiles, ...iconFont });
  const ready = useGame((g) => g.ready);
  const dark = useResolvedDark();
  const pal = dark ? darkColors : colors;
  const showFps = useGame((g) => g.save.settings.showFps);

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
    if ((fontsLoaded || fontError) && ready) {
      SplashScreen.hideAsync().catch(() => {});
      warmAllIdle(); // map shapes parse in the background, a few ms at a time
    }
  }, [fontsLoaded, fontError, ready]);

  if ((!fontsLoaded && !fontError) || !ready) return <View style={{ flex: 1, backgroundColor: pal.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider dark={dark}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {/* freezeOnBlur: screens under the top one (home under a round) stop re-rendering while hidden */}
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: pal.bg }, freezeOnBlur: true }} />
        <FxLayer />
        <PromptHost />
        <AdHost />
        {showFps ? <FpsMeter /> : null}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
