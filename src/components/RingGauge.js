import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useReduceMotion } from '../lib/motion';
import { COLORS, FONT } from '../theme';

/**
 * Circular progress ring with a count-up centre value.
 *
 *   <RingGauge progress={0.82} value={82} suffix="%" label="Recovery" color={COLORS.gold} />
 *
 * Props: progress (0–1), value (number shown in centre, counts up), suffix, caption
 * (small line under the number), label (under the ring), sublabel, color, size, delay.
 */
export default function RingGauge({
  progress = 0, value, suffix = '', caption, label, sublabel,
  color = COLORS.gold, size = 92, stroke = 9, delay = 0, valueSize = 22,
}) {
  const reduced = useReduceMotion();
  const p = Math.max(0, Math.min(1, progress || 0));
  const [t, setT] = useState(reduced ? 1 : 0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) { setT(1); return; }
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setT(v));
    Animated.timing(anim, {
      toValue: 1, duration: 1200, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    return () => { anim.removeListener(id); anim.stopAnimation(); };
  }, [p, value, reduced]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = value == null || isNaN(value) ? '—' : Math.round(value * t);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}${sublabel ? `, ${sublabel}` : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100), text: value == null ? 'no data' : `${Math.round(value)}${suffix}` }}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.surfaceRaised} strokeWidth={stroke} fill="none" />
          {/* soft glow under the arc */}
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={stroke + 7}
            fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p * t)}
          />
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke}
            fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p * t)}
          />
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.value, { fontSize: valueSize }]}>
            {shown}<Text style={styles.suffix}>{value == null ? '' : suffix}</Text>
          </Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
      </View>
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { alignItems: 'center', flex: 1 },
  center:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  value:    { color: COLORS.white, fontSize: 22, fontWeight: FONT.black, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  suffix:   { fontSize: 12, fontWeight: FONT.semibold, color: COLORS.textMuted },
  caption:  { color: COLORS.textDim, fontSize: 11, marginTop: -1 },
  label:    { fontSize: 14, fontWeight: FONT.bold, marginTop: 10 },
  sublabel: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
});
