import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { haptic } from '../lib/motion';
import { COLORS, TYPE, SPACING, FONT } from '../theme';

/**
 * Heading that introduces a group of content.
 *   <SectionTitle title="Your activity" />
 *   <SectionTitle title="Recent sessions" action="Show all" onAction={open} />
 *   <SectionTitle title="Calories" right={<Badge/>} />
 */
export default function SectionTitle({ title, right, action, onAction, style }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {action ? (
        <Pressable
          onPress={() => { haptic.tap(); onAction?.(); }}
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
          hitSlop={10}
        >
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.screen, marginTop: SPACING.xl, marginBottom: SPACING.md,
  },
  title:  { ...TYPE.section, color: COLORS.white },
  action: { color: COLORS.gold, fontSize: 14, fontWeight: FONT.semibold },
});
