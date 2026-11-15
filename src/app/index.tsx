import { Redirect } from 'expo-router';
import React from 'react';
import { HomeScreen } from '../game/HomeScreen';
import { useGame } from '../store/store';

export default function Index() {
  const ftue = useGame((g) => g.save.ftue);
  // First launch: straight into the first question, no menu.
  if (!ftue.firstRoundDone) return <Redirect href={{ pathname: '/play', params: { mode: 'first', nonce: 'first' } }} />;
  if (!ftue.secondRoundDone) return <Redirect href={{ pathname: '/play', params: { mode: 'journey', level: 'world_famous-2', nonce: 'second' } }} />;
  return <HomeScreen />;
}
