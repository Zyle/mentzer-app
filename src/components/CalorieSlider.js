import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT } from '../theme';

/**
 * Custom calorie adjustment slider — no external dependencies.
 * Uses the Responder system to track touch/drag position.
 *
 * Props:
 *   value    — current value (integer)
 *   min      — minimum value
 *   max      — maximum value
 *   step     — snap increment (default 50)
 *   onChange — called with new value on drag
 *   color    — fill + thumb color (default gold)
 *   zones    — array of { label, color } shown below slider
 */
export default function CalorieSlider({
  value,
  min,
  max,
  step = 50,
  onChange,
  color = COLORS.gold,
  zones,
}) {
  const [trackWidth, setTrackWidth] = useState(0);

  const pct = trackWidth > 0
    ? Math.max(0, Math.min(1, (value - min) / (max - min)))
    : 0;

  const thumbLeft = trackWidth > 0
    ? Math.max(0, Math.min(pct * trackWidth - 12, trackWidth - 24))
    : 0;

  const handleTouch = (e) => {
    if (trackWidth === 0) return;
    const x = Math.max(0, Math.min(e.nativeEvent.locationX, trackWidth));
    const rawValue = min + (x / trackWidth) * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    onChange(Math.max(min, Math.min(max, steppedValue)));
  };

  return (
    <View style={styles.container}>
      {/* Large value display */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={styles.unit}>cal / day</Text>
      </View>

      {/* Track — responds to touch and drag */}
      <View
        style={styles.trackWrapper}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>

        {trackWidth > 0 && (
          <View style={[
            styles.thumb,
            { left: thumbLeft, backgroundColor: color, shadowColor: color },
          ]} />
        )}
      </View>

      {/* Min / max labels */}
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>{min}</Text>
        <Text style={styles.rangeLabel}>{max}</Text>
      </View>

      {/* Zone labels */}
      {zones && (
        <View style={styles.zonesRow}>
          {zones.map((zone, i) => (
            <View key={i} style={styles.zoneItem}>
              <View style={[styles.zoneDot, { backgroundColor: zone.color }]} />
              <Text style={[styles.zoneLabel, { color: zone.color }]}>{zone.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { paddingVertical: 8 },
  valueRow:    { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  value:       { fontSize: 52, fontWeight: FONT.black },
  unit:        { color: COLORS.textDim, fontSize: 13, marginLeft: 8, fontWeight: FONT.semibold },
  trackWrapper:{
    height: 44,
    justifyContent: 'center',
    marginTop: 8,
  },
  track: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    elevation: 4,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  rangeRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  rangeLabel:{ color: COLORS.textFaint, fontSize: 10 },
  zonesRow:  {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  zoneItem:  { alignItems: 'center', flex: 1 },
  zoneDot:   { width: 6, height: 6, borderRadius: 3, marginBottom: 6 },
  zoneLabel: { fontSize: 9, letterSpacing: 1, fontWeight: FONT.semibold, textAlign: 'center' },
});
