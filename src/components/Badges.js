import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '../theme';

// Gym icon per muscle group (MaterialCommunityIcons)
const MUSCLE_ICONS = {
  legs: 'run', back: 'rowing', chest: 'weight-lifter', shoulders: 'human-handsup',
  biceps: 'arm-flex', triceps: 'arm-flex-outline', arms: 'arm-flex', calves: 'shoe-sneaker',
  traps: 'human', core: 'human',
};
export const muscleIcon = muscle => MUSCLE_ICONS[String(muscle || '').toLowerCase()] || 'dumbbell';

/**
 * Round tinted icon badge.
 *   <IconBadge icon="activity" />                 Feather icon
 *   <IconBadge gym="dumbbell" />                  MaterialCommunityIcons gym glyph
 */
export function IconBadge({ icon, gym, color = COLORS.gold, size = 40, filled = false, style }) {
  const Glyph = gym ? MaterialCommunityIcons : Feather;
  return (
    <View
      style={[styles.badge, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: filled ? color : color + '24',
      }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph name={gym || icon} size={Math.round(size * (gym ? 0.52 : 0.45))} color={filled ? COLORS.onGold : color} />
    </View>
  );
}

// Muscle-group tag colours — warm, readable on charcoal
const TAG_COLORS = {
  legs: '#ffb454', back: '#7fd1a8', chest: '#ffd65c', shoulders: '#f59e8b',
  arms: '#b79bff', biceps: '#b79bff', triceps: '#b79bff', calves: '#ffb454',
  traps: '#7fd1a8', core: '#8ec5ff',
};
export const tagColor = name => TAG_COLORS[String(name || '').toLowerCase()] || COLORS.textSecondary;

/** Small pill tag.  <Tag label="Legs" /> */
export function Tag({ label, color }) {
  const c = color || tagColor(label);
  return (
    <View style={[styles.tag, { backgroundColor: c + '1f' }]}>
      <Text style={[styles.tagText, { color: c }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge:   { alignItems: 'center', justifyContent: 'center' },
  tag:     { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  tagText: { fontSize: 11, fontWeight: FONT.semibold },
});
