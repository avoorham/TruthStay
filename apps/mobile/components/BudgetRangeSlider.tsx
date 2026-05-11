import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";

const HANDLE = 24;
const TRACK_H = 4;

interface Props {
  min: number;
  max: number;
  sliderMax?: number;
  step?: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}

export function BudgetRangeSlider({
  min, max,
  sliderMax = 10_000,
  step = 50,
  onMinChange, onMaxChange,
}: Props) {
  const [trackW, setTrackW] = useState(0);

  // Always-fresh ref so PanResponder callbacks never go stale
  const live = useRef({ min, max, onMinChange, onMaxChange, sliderMax, step, trackW });
  live.current = { min, max, onMinChange, onMaxChange, sliderMax, step, trackW };

  const gestureStart = useRef({ min: 0, max: 0 });

  const minPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { gestureStart.current.min = live.current.min; },
    onPanResponderMove: (_, gs) => {
      const { max, sliderMax, step, trackW: tw, onMinChange } = live.current;
      if (!tw) return;
      const startPx = Math.min(gestureStart.current.min, sliderMax) / sliderMax * tw;
      let v = snapTo((startPx + gs.dx) / tw * sliderMax, step);
      v = clamp(v, 0, Math.min(max, sliderMax) - step);
      onMinChange(v);
    },
  })).current;

  const maxPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { gestureStart.current.max = live.current.max; },
    onPanResponderMove: (_, gs) => {
      const { min, sliderMax, step, trackW: tw, onMaxChange } = live.current;
      if (!tw) return;
      const startPx = Math.min(gestureStart.current.max, sliderMax) / sliderMax * tw;
      let v = snapTo((startPx + gs.dx) / tw * sliderMax, step);
      v = clamp(v, min + step, sliderMax);
      onMaxChange(v);
    },
  })).current;

  const minRatio = Math.min(min, sliderMax) / sliderMax;
  const maxRatio = Math.min(max, sliderMax) / sliderMax;
  const minLeft  = minRatio * trackW;
  const maxLeft  = maxRatio * trackW;

  return (
    <View
      style={styles.container}
      onLayout={e => setTrackW(e.nativeEvent.layout.width - HANDLE)}
    >
      <View style={styles.trackBase} />
      {trackW > 0 && (
        <View style={[styles.trackFill, { left: HANDLE / 2 + minLeft, width: Math.max(0, maxLeft - minLeft) }]} />
      )}
      {trackW > 0 && (
        <>
          <View {...minPan.panHandlers} style={[styles.handle, { left: minLeft }]} />
          <View {...maxPan.panHandlers} style={[styles.handle, { left: maxLeft }]} />
        </>
      )}
    </View>
  );
}

function snapTo(val: number, step: number) { return Math.round(val / step) * step; }
function clamp(val: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, val)); }

const styles = StyleSheet.create({
  container: { height: HANDLE, position: "relative", justifyContent: "center" },
  trackBase: {
    position: "absolute",
    left: HANDLE / 2,
    right: HANDLE / 2,
    height: TRACK_H,
    backgroundColor: colors.border,
    borderRadius: TRACK_H / 2,
  },
  trackFill: {
    position: "absolute",
    top: (HANDLE - TRACK_H) / 2,
    height: TRACK_H,
    backgroundColor: colors.accentLight,
    borderRadius: TRACK_H / 2,
  },
  handle: {
    position: "absolute",
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: colors.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
});
