import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../theme';

/**
 * Standard dark card used throughout the app.
 * Pass `style` to override margins or add accent borders.
 * Pass `onPress` (plus `accessibilityLabel`) to make the whole card a button.
 *
 * Examples:
 *   <Card style={{ marginHorizontal: 20, marginBottom: 14 }}>
 *   <Card accent={COLORS.gold}>
 *   <Card onPress={open} accessibilityLabel="Open calorie tracker">
 */
export default function Card({ children, style, accent, onPress, accessibilityLabel, accessibilityHint }) {
  const base = [styles.card, accent && { borderLeftWidth: 3, borderLeftColor: accent }, style];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [...base, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pressed: { backgroundColor: COLORS.surfaceRaised },
});
