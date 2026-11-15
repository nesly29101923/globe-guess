// Web / tests: no native SDKs; the fake services stay in place.
export function installRealProviders() {}
export async function gatherAdConsent(): Promise<boolean | null> {
  return null;
}
export async function requestTracking(): Promise<void> {}
