import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '../theme';

/** Round tinted icon badge.  <IconBadge icon="activity" /> */
export function IconBadge({ icon, color = COLORS.gold, size = 40, filled = false, style }) {
  return (
    <View
      style={[styles.badge, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: filled ? color : color + '24',
      }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Feather name={icon} size={Math.round(size * 0.45)} color={filled ? COLORS.onGold : color} />
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
