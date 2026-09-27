import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '../lib/motion';
import { COLORS, GRADIENTS, RADIUS, SPACING } from '../theme';

/**
 * Standard card used throughout the app — soft charcoal, no border.
 *
 *   <Card style={{ marginHorizontal: 18 }}>
 *   <Card accent={COLORS.gold}>                       gold left edge
 *   <Card gradient>                                    subtle top-lit gradient
 *   <Card onPress={open} accessibilityLabel="…">       whole card is a button (springs + haptic)
 */
export default function Card({ children, style, accent, gradient, onPress, accessibilityLabel, accessibilityHint }) {
  const base = [styles.card, accent && { borderLeftWidth: 3, borderLeftColor: accent }, style];
  const fill = gradient ? (
    <LinearGradient
      colors={GRADIENTS.card}
      style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]}
      pointerEvents="none"
    />
  ) : null;

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        hapticStyle="tap"
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={base}
      >
        {fill}
        {children}
      </PressableScale>
    );
  }

  return <View style={base}>{fill}{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
  },
});
