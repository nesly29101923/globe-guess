import React from 'react';
import { HomeScreen } from '../game/HomeScreen';

// The app always opens on the menu. (It used to drop a new player straight into a first round; quitting that round
// went back here and straight into it again, so a player could not reach the menu.) PLAY starts the first round.
export default function Index() {
  return <HomeScreen />;
}
