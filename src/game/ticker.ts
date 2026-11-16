// A tiny value store for numbers that change often (the countdown): only the component that reads it re-renders.
import { useSyncExternalStore } from 'react';

export type Ticker = { get: () => number; set: (n: number) => void; subscribe: (f: () => void) => () => void };

export function createTicker(v0: number): Ticker {
  let v = v0;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (n: number) => {
      if (n === v) return;
      v = n;
      subs.forEach((f) => f());
    },
    subscribe: (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

export function useTicker(t: Ticker): number {
  return useSyncExternalStore(t.subscribe, t.get, t.get);
}
