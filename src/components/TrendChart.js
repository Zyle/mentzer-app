import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useReduceMotion, useLoop } from '../lib/motion';
import { COLORS } from '../theme';

// Monotone cubic (Fritsch–Carlson): smooth, never overshoots the data
function smoothPath(pts) {
  const n = pts.length;
  if (n < 2) return '';
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    d.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = Math.hypot(a, b);
    if (h > 3) { m[i] *= 3 / h; m[i + 1] *= 3 / h; }
  }
  let s = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    s += ` C ${pts[i].x + dx} ${pts[i].y + m[i] * dx}, ${pts[i + 1].x - dx} ${pts[i + 1].y - m[i + 1] * dx}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return s;
}

/**
 * Glowing line chart that draws itself in.
 *   <TrendChart data={[{ label: '12/09', value: 5400 }, …]} width={w} height={170} />
 */
export default function TrendChart({ data, width, height = 170, color = COLORS.gold, formatY = v => v, accessibilityLabel }) {
  const reduced = useReduceMotion();
  const [t, setT] = useState(reduced ? 1 : 0);
  const anim = useRef(new Animated.Value(0)).current;
  const pulse = useLoop(1600, { delay: 400 });

  useEffect(() => {
    if (reduced) { setT(1); return; }
    anim.setValue(0);
    const id = anim.addListener(({ value }) => setT(value));
    Animated.timing(anim, { toValue: 1, duration: 1400, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => { anim.removeListener(id); anim.stopAnimation(); };
  }, [data?.length, width > 0, reduced]); // not raw width: tiny layout shifts must not replay it

  if (!width || !data || data.length < 2) return null;

  const PL = 34, PR = 12, PT = 14, PB = 24;
  const W = width - PL - PR, H = height - PT - PB;
  const vals = data.map(d => d.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.2 || hi * 0.1 || 1;
  lo = Math.max(0, lo - pad); hi = hi + pad;
  const x = i => PL + (i / (data.length - 1)) * W;
  const y = v => PT + H - ((v - lo) / (hi - lo)) * H;
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${PT + H} L ${pts[0].x} ${PT + H} Z`;
  const len = pts.reduce((acc, p, i) => i ? acc + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0, 0) * 1.08;
  const last = pts[pts.length - 1];
  const ticks = [0, 1, 2, 3].map(k => lo + ((hi - lo) * k) / 3);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {ticks.map((v, k) => (
          <React.Fragment key={k}>
            <Line x1={PL} x2={PL + W} y1={y(v)} y2={y(v)} stroke={COLORS.border} strokeWidth={1} strokeDasharray="3 5" />
            <SvgText x={PL - 8} y={y(v) + 4} fontSize={10} fill={COLORS.textDim} textAnchor="end">{formatY(v)}</SvgText>
          </React.Fragment>
        ))}
        <Path d={area} fill="url(#trendFill)" opacity={t} />
        <Path d={line} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - t)} />
        <Path d={line} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - t)} />
        {pts.slice(0, -1).map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={COLORS.surface} stroke={color} strokeWidth={2}
            opacity={t > (i + 1) / pts.length ? 1 : 0} />
        ))}
        {data.map((d, i) => (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) ? (
          <SvgText key={`l${i}`} x={x(i)} y={height - 6} fontSize={10} fill={COLORS.textDim} textAnchor="middle">{d.label}</SvgText>
        ) : null)}
      </Svg>

      {/* Latest point — a pulsing beacon */}
      {t > 0.98 && (
        <View pointerEvents="none" style={[styles.beacon, { left: last.x - 14, top: last.y - 14 }]}>
          <Animated.View style={[styles.ring, { borderColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] }) }] }]} />
          <View style={[styles.dot, { backgroundColor: COLORS.white, shadowColor: color }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  beacon: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  ring:   { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  dot:    { width: 11, height: 11, borderRadius: 6, borderWidth: 2.5, borderColor: COLORS.gold,
            shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: Platform.OS === 'android' ? 4 : 0 },
});
