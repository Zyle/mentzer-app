// Motion + haptics toolkit. Every effect respects the OS "Reduce motion"
// setting, and haptics are silently skipped where unsupported (web).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Easing, Platform, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MOTION } from '../theme';

// ── Reduce motion ────────────────────────────────────────────────────────────
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.().then(v => { reduceMotion = !!v; }).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => { reduceMotion = !!v; });

export function useReduceMotion() {
  const [reduced, setReduced] = useState(reduceMotion);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(v => setReduced(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => setReduced(!!v));
    return () => sub?.remove?.();
  }, []);
  return reduced;
}

// ── Haptics ──────────────────────────────────────────────────────────────────
const safe = fn => { if (Platform.OS === 'web') return; try { fn()?.catch?.(() => {}); } catch (_) {} };
export const haptic = {
  tap:     () => safe(() => Haptics.selectionAsync()),
  press:   () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  heavy:   () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

// ── Pressable that springs down slightly and ticks a haptic ──────────────────
export function PressableScale({ children, style, onPress, scaleTo = 0.97, hapticStyle = 'press', disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = v => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', ...MOTION.spring }).start();
  };
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={() => !disabled && to(scaleTo)}
      onPressOut={() => to(1)}
      onPress={e => { if (disabled) return; haptic[hapticStyle]?.(); onPress?.(e); }}
    >
      {state => (
        <Animated.View style={[typeof style === 'function' ? style(state) : style, { transform: [{ scale }] }]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

// ── Staggered entrance: fade + rise ──────────────────────────────────────────
export function FadeInUp({ index = 0, children, style, distance = 16 }) {
  const reduced = useReduceMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    Animated.timing(v, {
      toValue: 1, duration: 520, delay: index * MOTION.stagger,
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);
  return (
    <Animated.View
      style={[style, {
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

// ── Count-up number (0 → value) ──────────────────────────────────────────────
export function useCountUp(target, duration = 1100, deps = []) {
  const reduced = useReduceMotion();
  const [val, setVal] = useState(reduced ? target : 0);
  useEffect(() => {
    if (target == null || isNaN(target)) { setVal(target); return; }
    if (reduced) { setVal(target); return; }
    const a = new Animated.Value(0);
    const id = a.addListener(({ value }) => setVal(value));
    Animated.timing(a, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => { a.removeListener(id); a.stopAnimation(); };
  }, [target, reduced, ...deps]);
  return val;
}

// ── Looping value (pulses, shimmers) ─────────────────────────────────────────
export function useLoop(duration = 1800, { delay = 0, active = true } = {}) {
  const reduced = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced || !active) { v.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(delay),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, active]);
  return v;
}
