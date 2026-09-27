import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { haptic, useReduceMotion } from '../lib/motion';
import { COLORS, FONT, MOTION } from '../theme';

const PILL_W = 58;

/**
 * Bottom tab bar with a gold pill that springs between tabs.
 * Used as <Tab.Navigator tabBar={props => <TabBar {...props} />}>; each screen's
 * options provide `tabBarLabel` and `tabBarIconName` (a Feather icon name).
 */
export default function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const tabW = width / state.routes.length;

  const placed = useRef(false);

  useEffect(() => {
    if (!tabW) return;
    const to = state.index * tabW + (tabW - PILL_W) / 2;
    // First layout: snap into place; afterwards spring between tabs
    if (reduced || !placed.current) { x.setValue(to); placed.current = true; return; }
    Animated.spring(x, { toValue: to, useNativeDriver: Platform.OS !== 'web', ...MOTION.spring }).start();
  }, [state.index, tabW, reduced]);

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {tabW > 0 && <Animated.View style={[styles.pill, { transform: [{ translateX: x }] }]} />}
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const label = options.tabBarLabel ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) { haptic.tap(); navigation.navigate(route.name); }
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={`${label} tab`}
          >
            <View style={styles.iconBox}>
              <Feather name={options.tabBarIconName} size={21} color={focused ? COLORS.gold : COLORS.textDim} />
            </View>
            <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar:         { flexDirection: 'row', backgroundColor: COLORS.background, paddingTop: 10,
                 borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderStrong },
  pill:        { position: 'absolute', top: 8, left: 0, width: PILL_W, height: 34, borderRadius: 17,
                 backgroundColor: COLORS.goldFaint },
  tab:         { flex: 1, alignItems: 'center', minHeight: 50 },
  iconBox:     { height: 30, justifyContent: 'center' },
  label:       { fontSize: 11, fontWeight: FONT.medium, color: COLORS.textDim, marginTop: 3 },
  labelActive: { color: COLORS.white, fontWeight: FONT.bold },
});
