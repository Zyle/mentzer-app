import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPE, SPACING } from '../theme';

/**
 * Small uppercase label that introduces a group of content.
 *   <SectionTitle title="TODAY" right={<Text>…</Text>} />
 */
export default function SectionTitle({ title, right, style }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.screen, marginTop: SPACING.xl, marginBottom: SPACING.sm,
  },
  title: { ...TYPE.overline, color: COLORS.textDim },
});
