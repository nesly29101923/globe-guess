// Player zoom on the round's map: pinch (around the fingers), drag while zoomed, double-tap to zoom in/out, and a
// button for one hand. It sits on top of the game camera (`base`): the camera still flies between questions and the
// zoom springs back to 1 at every new question.
//
// The zoomed view is kept inside the view the camera framed. That is enough to see a tiny country, and it means the
// zoomed view is always inside the image painted for this question. While the fingers move, that image is simply
// enlarged; when they stop, `onSettle` lets the screen paint a sharp one for the new view.
import { runOnJS, useDerivedValue, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import type { Box, Cam } from './camera';

export const MAX_ZOOM = 6;
export const BUTTON_ZOOM = 2.6;
const SPRING = { damping: 18, stiffness: 180, mass: 0.8 };

export function useMapZoom({ base, box, H, enabled, onSettle }: {
  base: { readonly value: Cam };
  box: Box;
  H: number;
  enabled: SharedValue<boolean>;
  onSettle: () => void; // called (on the JS thread) when a zoom or drag has come to rest
}) {
  const settled = (fin?: boolean) => {
    'worklet';
    if (fin !== false) runOnJS(onSettle)();
  };
  const k = useSharedValue(1);   // zoom factor
  const px = useSharedValue(0);  // pan, map units
  const py = useSharedValue(0);
  const k0 = useSharedValue(1);
  const px0 = useSharedValue(0);
  const py0 = useSharedValue(0);
  const fmx = useSharedValue(0); // map point under the fingers when the pinch began
  const fmy = useSharedValue(0);
  const { fx, fy, W } = box;

  // pan limits for zoom z: the zoomed view stays inside the framed view
  const clampX = (p: number, w: number, z: number) => {
    'worklet';
    const d = (w - w / z) / W;
    return Math.min((W - fx) * d, Math.max(-fx * d, p));
  };
  const clampY = (p: number, w: number, z: number) => {
    'worklet';
    const d = (w - w / z) / W;
    return Math.min((H - fy) * d, Math.max(-fy * d, p));
  };

  const cam = useDerivedValue<Cam>(() => {
    const c = base.value;
    const z = k.value;
    if (z <= 1.0001) return c;
    return { ux: c.ux + clampX(px.value, c.w, z), uy: c.uy + clampY(py.value, c.w, z), w: c.w / z };
  });

  /** Zoom to z keeping the map point (mx, my) under the screen point (sx, sy). */
  const zoomAround = (z: number, mx: number, my: number, sx: number, sy: number, animate: boolean) => {
    'worklet';
    const c = base.value;
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    const npx = clampX(mx - c.ux - ((sx - fx) * c.w) / (W * nz), c.w, nz);
    const npy = clampY(my - c.uy - ((sy - fy) * c.w) / (W * nz), c.w, nz);
    if (animate) {
      k.value = withSpring(nz, SPRING, settled);
      px.value = withSpring(npx, SPRING);
      py.value = withSpring(npy, SPRING);
    } else {
      k.value = nz;
      px.value = npx;
      py.value = npy;
    }
  };

  /** The map point under a screen point, with the current zoom. */
  const mapAt = (sx: number, sy: number) => {
    'worklet';
    const c = cam.value;
    return [c.ux + ((sx - fx) * c.w) / W, c.uy + ((sy - fy) * c.w) / W] as const;
  };

  // defined before the gestures: a worklet captures what it uses when it is created
  const reset = () => {
    'worklet';
    k.value = withTiming(1, { duration: 220 }, settled);
    px.value = withTiming(0, { duration: 220 });
    py.value = withTiming(0, { duration: 220 });
  };

  const pinch = usePinchGesture({
    enabled,
    onActivate: (e) => {
      k0.value = k.value;
      const [mx, my] = mapAt(e.focalX, e.focalY);
      fmx.value = mx;
      fmy.value = my;
    },
    onUpdate: (e) => {
      zoomAround(k0.value * e.scale, fmx.value, fmy.value, e.focalX, e.focalY, false);
    },
    onDeactivate: () => {
      if (k.value < 1.08) reset();
      else settled();
    },
  });

  const pan = usePanGesture({
    enabled,
    minPointers: 1,
    maxPointers: 2,
    onBegin: () => {
      px0.value = px.value;
      py0.value = py.value;
    },
    onUpdate: (e) => {
      const z = k.value;
      if (z <= 1.0001) return;
      const c = base.value;
      const unit = c.w / z / W;
      px.value = clampX(px0.value - e.translationX * unit, c.w, z);
      py.value = clampY(py0.value - e.translationY * unit, c.w, z);
    },
    onDeactivate: () => {
      if (k.value > 1.0001) settled();
    },
  });

  const doubleTap = useTapGesture({
    enabled,
    numberOfTaps: 2,
    onDeactivate: (e) => {
      if (e.canceled) return;
      if (k.value > 1.2) reset();
      else {
        const [mx, my] = mapAt(e.x, e.y);
        zoomAround(BUTTON_ZOOM, mx, my, e.x, e.y, true);
      }
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  /** The magnifier button: zoom in on the target (the middle of the framed view), or back out. */
  const toggle = () => {
    'worklet';
    if (k.value > 1.2) reset();
    else zoomAround(BUTTON_ZOOM, base.value.ux, base.value.uy, fx, fy, true);
  };

  return { cam, gesture, reset, toggle, zoom: k };
}
