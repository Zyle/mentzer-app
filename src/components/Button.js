import React, { useState } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { PressableScale, useLoop } from '../lib/motion';
import { COLORS, GRADIENTS, FONT, RADIUS, HIT } from '../theme';

/**
 * Accessible button used across the app.
 *
 * Props:
 *   title     — label (required)
 *   onPress   — handler
 *   variant   — 'primary' | 'secondary' | 'ghost' | 'danger' (default 'primary')
 *   icon      — optional Feather icon name shown before the label
 *   iconRight — optional Feather icon name shown after the label
 *   loading   — shows a spinner and blocks presses
 *   disabled  — dims and blocks presses
 *   shimmer   — primary only: a slow light sweep to draw the eye
 *   hint      — accessibilityHint for screen readers
 *   accessibilityLabel — overrides the spoken label (defaults to title)
 *   size      — 'lg' (default) | 'md'
 */
export default function Button({
  title, onPress, variant = 'primary', icon, iconRight, loading = false,
  disabled = false, shimmer = false, hint, size = 'lg', style, textStyle, accessibilityLabel,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const blocked = disabled || loading;
  const [width, setWidth] = useState(0);
  const sweep = useLoop(1400, { delay: 2200, active: shimmer && variant === 'primary' && !blocked });

  const content = loading ? (
    <ActivityIndicator color={v.text.color} />
  ) : (
    <View style={styles.row}>
      {icon ? <Feather name={icon} size={18} color={v.text.color} /> : null}
      <Text style={[styles.text, size === 'md' && styles.textMd, v.text, textStyle]} numberOfLines={1}>
        {title}
      </Text>
      {iconRight ? <Feather name={iconRight} size={18} color={v.text.color} /> : null}
    </View>
  );

  return (
    <PressableScale
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      hapticStyle={variant === 'primary' ? 'press' : 'tap'}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={hint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'md' && styles.md,
        v.container,
        pressed && !blocked && v.pressed,
        blocked && styles.disabled,
        style,
      ]}
    >
      <View style={StyleSheet.absoluteFill} onLayout={e => setWidth(e.nativeEvent.layout.width)} pointerEvents="none">
        {variant === 'primary' && (
          <LinearGradient colors={GRADIENTS.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        {shimmer && variant === 'primary' && width > 0 && (
          <Animated.View
            style={[styles.sweep, {
              transform: [
                { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-120, width + 40] }) },
                { rotate: '18deg' },
              ],
            }]}
          />
        )}
      </View>
      {content}
    </PressableScale>
  );
}

const VARIANTS = {
  primary: {
    container: { backgroundColor: COLORS.gold, shadowColor: COLORS.gold, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    pressed:   {},
    text:      { color: COLORS.onGold },
  },
  secondary: {
    container: { backgroundColor: COLORS.surfaceRaised },
    pressed:   { backgroundColor: COLORS.borderStrong },
    text:      { color: COLORS.white },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed:   { backgroundColor: COLORS.surface },
    text:      { color: COLORS.textMuted },
  },
  danger: {
    container: { backgroundColor: COLORS.redFaint },
    pressed:   { backgroundColor: COLORS.red + '33' },
    text:      { color: COLORS.red },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  md:       { minHeight: HIT, borderRadius: RADIUS.md, paddingHorizontal: 16 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text:     { fontSize: 16, fontWeight: FONT.bold, letterSpacing: 0.2 },
  textMd:   { fontSize: 14 },
  disabled: { opacity: 0.4 },
  sweep:    { position: 'absolute', top: -20, bottom: -20, width: 46, backgroundColor: 'rgba(255,255,255,0.45)' },
});
