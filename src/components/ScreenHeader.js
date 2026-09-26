import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONT, SPACING, HIT } from '../theme';

/**
 * Standard screen header used on tab and stack screens.
 * Respects the device safe area (notch / status bar).
 *
 * Props:
 *   title      — screen title (required)
 *   subtitle   — small gold overline shown above the title (optional)
 *   topContent — node rendered above the title (optional)
 *   bordered   — adds a bottom border line (default false)
 *   right      — node rendered at the right of the title row (optional)
 *   onBack     — shows an accessible back button when provided (stack screens)
 */
export default function ScreenHeader({ title, subtitle, topContent, bordered = false, right, onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + (onBack ? 4 : 20) }, bordered && styles.bordered]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Feather name="chevron-left" size={24} color={COLORS.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : null}
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
  header: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: SPACING.lg,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: HIT,
    marginLeft: -8,
    paddingRight: 12,
  },
  backText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: FONT.medium },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  titleCol: { flex: 1 },
  title: {
    fontSize: 32,
    fontWeight: FONT.black,
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: FONT.semibold,
    color: COLORS.gold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  right: {
    paddingBottom: 4,
    marginLeft: 12,
  },
});
