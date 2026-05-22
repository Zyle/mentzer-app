import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, SPACING } from '../theme';

/**
 * Standard screen header used on all main tab screens.
 *
 * Props:
 *   title      — large uppercase title (required)
 *   subtitle   — small gold subtitle below title (optional)
 *   topContent — node rendered above the title, e.g. a greeting (optional)
 *   bordered   — adds a bottom border line (default false)
 */
export default function ScreenHeader({ title, subtitle, topContent, bordered = false }) {
  return (
    <View style={[styles.header, bordered && styles.bordered]}>
      {topContent}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 64,
    paddingHorizontal: SPACING.screen,
    paddingBottom: SPACING.xl,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  title: {
    fontSize: 34,
    fontWeight: FONT.black,
    color: COLORS.white,
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 4,
    marginTop: 2,
  },
});
