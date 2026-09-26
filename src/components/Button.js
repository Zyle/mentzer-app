import React from 'react';
import { Pressable, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, HIT } from '../theme';

/**
 * Accessible button used across the app.
 *
 * Props:
 *   title     — label (required)
 *   onPress   — handler
 *   variant   — 'primary' | 'secondary' | 'ghost' | 'danger' (default 'primary')
 *   icon      — optional Feather icon name shown before the label
 *   loading   — shows a spinner and blocks presses
 *   disabled  — dims and blocks presses
 *   hint      — accessibilityHint for screen readers
 *   size      — 'lg' (default) | 'md'
 */
export default function Button({
  title, onPress, variant = 'primary', icon, loading = false,
  disabled = false, hint, size = 'lg', style, textStyle,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
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
      {loading ? (
        <ActivityIndicator color={v.text.color} />
      ) : (
        <View style={styles.row}>
          {icon ? <Feather name={icon} size={17} color={v.text.color} /> : null}
          <Text style={[styles.text, size === 'md' && styles.textMd, v.text, textStyle]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: {
    container: { backgroundColor: COLORS.gold },
    pressed:   { backgroundColor: COLORS.goldBright },
    text:      { color: COLORS.onGold },
  },
  secondary: {
    container: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderStrong },
    pressed:   { backgroundColor: COLORS.surfaceRaised },
    text:      { color: COLORS.white },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed:   { backgroundColor: COLORS.surface },
    text:      { color: COLORS.textMuted },
  },
  danger: {
    container: { backgroundColor: COLORS.redFaint, borderWidth: 1, borderColor: COLORS.red + '66' },
    pressed:   { backgroundColor: COLORS.red + '33' },
    text:      { color: COLORS.red },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md:       { minHeight: HIT, borderRadius: RADIUS.md, paddingHorizontal: 16 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text:     { fontSize: 15, fontWeight: FONT.black, letterSpacing: 1.2 },
  textMd:   { fontSize: 13, letterSpacing: 1 },
  disabled: { opacity: 0.4 },
});
