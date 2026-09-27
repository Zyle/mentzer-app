import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { PressableScale } from '../lib/motion';
import { COLORS, FONT, SPACING } from '../theme';

/**
 * Standard screen header. Respects the device safe area (notch / status bar).
 *
 * Props:
 *   title      — screen title (required)
 *   subtitle   — small line above a tab-screen title, or below a stack-screen title
 *   topContent — node rendered above the title (optional)
 *   bordered   — adds a bottom border line (default false)
 *   right      — node rendered at the right of the title row (optional)
 *   onBack     — stack screens: shows a round back button beside a compact title
 */
export default function ScreenHeader({ title, subtitle, topContent, bordered = false, right, onBack }) {
  const insets = useSafeAreaInsets();

  if (onBack) {
    return (
      <View style={[styles.stack, { paddingTop: insets.top + 10 }, bordered && styles.bordered]}>
        <PressableScale
          onPress={onBack}
          hapticStyle="tap"
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={6}
          style={styles.backCircle}
        >
          <Feather name="chevron-left" size={22} color={COLORS.white} />
        </PressableScale>
        <View style={styles.stackTitleCol}>
          <Text style={styles.stackTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.stackSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top + 18 }, bordered && styles.bordered]}>
      {topContent}
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header:   { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.lg },
  bordered: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  titleCol: { flex: 1 },
  title:    { fontSize: 32, fontWeight: FONT.black, color: COLORS.white, letterSpacing: -0.8 },
  subtitle: { fontSize: 13, fontWeight: FONT.medium, color: COLORS.textDim, marginBottom: 2 },
  right:    { marginLeft: 12 },

  stack:         { flexDirection: 'row', alignItems: 'center', gap: 12,
                   paddingHorizontal: SPACING.screen, paddingBottom: SPACING.md },
  backCircle:    { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceRaised,
                   alignItems: 'center', justifyContent: 'center' },
  stackTitleCol: { flex: 1 },
  stackTitle:    { fontSize: 22, fontWeight: FONT.bold, color: COLORS.white, letterSpacing: -0.3 },
  stackSubtitle: { fontSize: 12, fontWeight: FONT.medium, color: COLORS.textDim, marginTop: 1 },
});
