import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../theme';

/**
 * Standard dark card used throughout the app.
 * Pass `style` to override margins or add accent borders.
 *
 * Examples:
 *   <Card style={{ marginHorizontal: 20, marginBottom: 14 }}>
 *   <Card style={{ borderLeftWidth: 3, borderLeftColor: COLORS.gold }}>
 */
export default function Card({ children, style }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
