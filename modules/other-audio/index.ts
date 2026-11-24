import { requireOptionalNativeModule, type NativeModule } from "expo";

type Events = { onChange: (event: { playing: boolean }) => void };
declare class OtherAudioModule extends NativeModule<Events> {
  isPlaying(): boolean;
}
// Optional so tests and builds without the native module keep our soundtrack.
const native = requireOptionalNativeModule<OtherAudioModule>("OtherAudio");

/** Whether another app's music or podcast is playing right now. */
export function otherAudioPlaying() {
  try {
    return native?.isPlaying() ?? false;
  } catch {
    return false;
  }
}

/** iOS only: called when another app starts or stops its audio. */
export function onOtherAudioChange(listener: (playing: boolean) => void) {
  const sub = native?.addListener("onChange", (e) => listener(e.playing));
  return () => sub?.remove();
}
