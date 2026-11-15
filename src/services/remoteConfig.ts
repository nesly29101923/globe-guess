// Remote config behind one interface. Version 1 ships the defaults from config/balance.ts; a real provider
// (Firebase Remote Config) can later return overrides for live tuning without an app update.
export interface RemoteConfigProvider {
  fetch(): Promise<Record<string, unknown>>;
}

class FakeRemoteConfig implements RemoteConfigProvider {
  async fetch() {
    return {};
  }
}

let provider: RemoteConfigProvider = new FakeRemoteConfig();
export function setRemoteConfigProvider(p: RemoteConfigProvider) {
  provider = p;
}

let values: Record<string, unknown> = {};
export const remoteConfig = {
  async refresh() {
    try {
      values = await provider.fetch();
    } catch {
      values = {};
    }
  },
  get<T>(key: string, fallback: T): T {
    return (values[key] as T | undefined) ?? fallback;
  },
};
