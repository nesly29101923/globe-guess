// Frames per second, for testing on a real phone (Settings > FPS counter).
// UI = the drawing thread (animations, map). JS = the game-logic thread (React). Which one drops says what to fix.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function FpsMeter() {
  const insets = useSafeAreaInsets();
  const [ui, setUi] = useState(0);
  const [js, setJs] = useState(0);
  const [worst, setWorst] = useState(0);
  const frames = useSharedValue(0);
  const since = useSharedValue(0);
  const longest = useSharedValue(0);
  const report = (fps: number, worstMs: number) => {
    setUi(fps);
    setWorst(worstMs);
  };
  useFrameCallback((f) => {
    'worklet';
    if (since.value === 0) since.value = f.timestamp;
    frames.value += 1;
    const dt = f.timeSincePreviousFrame ?? 0;
    if (dt > longest.value) longest.value = dt;
    const span = f.timestamp - since.value;
    if (span >= 1000) {
      runOnJS(report)(Math.round((frames.value * 1000) / span), Math.round(longest.value));
      frames.value = 0;
      longest.value = 0;
      since.value = f.timestamp;
    }
  });
  useEffect(() => {
    let n = 0;
    let t0 = Date.now();
    let raf = 0;
    const loop = () => {
      n += 1;
      const now = Date.now();
      if (now - t0 >= 1000) {
        setJs(Math.round((n * 1000) / (now - t0)));
        n = 0;
        t0 = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const bad = (v: number) => (v && v < 50 ? st.bad : null);
  return (
    <View style={[st.box, { bottom: Math.max(2, insets.bottom - 14) }]} pointerEvents="none">
      <Text style={[st.txt, bad(ui)]}>{`UI ${ui}`}</Text>
      <Text style={[st.txt, bad(js)]}>{`JS ${js}`}</Text>
      <Text style={[st.txt, worst > 34 ? st.bad : null]}>{`${worst}ms`}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  box: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 8, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, zIndex: 999 },
  txt: { color: '#4ADE80', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bad: { color: '#F87171' },
});
