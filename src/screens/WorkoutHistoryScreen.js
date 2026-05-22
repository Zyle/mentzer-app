import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS   = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const daysAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'YESTERDAY';
  return `${diff} DAYS AGO`;
};

const groupByExercise = (sets) => {
  const map = {};
  sets.forEach(s => {
    if (!map[s.exercise_name]) map[s.exercise_name] = [];
    map[s.exercise_name].push(s);
  });
  return Object.entries(map).map(([name, sets]) => ({ name, sets }));
};

const totalVolume = (sets) =>
  sets.reduce((sum, s) => sum + (s.weight_kg * s.reps), 0);

// ─── Workout Card ─────────────────────────────────────────────────────────────
function WorkoutCard({ item }) {
  const [expanded, setExpanded] = useState(true);
  const vol = totalVolume(item.allSets);

  return (
    <Card style={styles.workoutCard}>
      {/* Header */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          <Text style={styles.agoText}>{daysAgo(item.date)}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.exercises.length} EX · {item.allSets.length} SETS
            </Text>
          </View>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Volume stat */}
      <View style={styles.volumeRow}>
        <Text style={styles.volumeLabel}>TOTAL VOLUME</Text>
        <Text style={styles.volumeValue}>{vol.toLocaleString()} kg</Text>
      </View>

      {/* Exercise breakdown */}
      {expanded && (
        <>
          <View style={styles.divider} />
          {item.exercises.map((ex, i) => (
            <View key={i} style={[styles.exerciseRow, i < item.exercises.length - 1 && styles.exerciseBorder]}>
              <Text style={styles.exerciseName}>{ex.name.toUpperCase()}</Text>
              <View style={styles.setsRow}>
                {ex.sets.map((s, j) => (
                  <View key={j} style={styles.setChip}>
                    <Text style={styles.setWeight}>{s.weight_kg}</Text>
                    <Text style={styles.setUnit}>kg</Text>
                    <Text style={styles.setSep}>×</Text>
                    <Text style={styles.setReps}>{s.reps}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WorkoutHistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const [{ data: workouts }, { data: sets }] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, date, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('sets')
          .select('workout_id, exercise_name, weight_kg, reps, date')
          .eq('user_id', user.id)
          .order('date', { ascending: true }),
      ]);

      if (workouts && sets) {
        const merged = workouts
          .map(w => {
            const wSets = sets.filter(s => s.workout_id === w.id);
            return {
              ...w,
              date: w.date || w.created_at,
              allSets:   wSets,
              exercises: groupByExercise(wSets),
            };
          })
          .filter(w => w.exercises.length > 0);
        setHistory(merged);
      }
    } catch (_) {
      // silent fail — empty state handles it
    } finally {
      setLoading(false);
    }
  };

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalSessions = history.length;
  const totalSets     = history.reduce((n, w) => n + w.allSets.length, 0);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="HISTORY" />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="HISTORY"
        subtitle={totalSessions > 0 ? `${totalSessions} SESSIONS · ${totalSets} TOTAL SETS` : null}
      />

      {history.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🏋️</Text>
          <Text style={styles.emptyTitle}>No sessions yet.</Text>
          <Text style={styles.emptySub}>
            Log your first workout — every set will be recorded here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <WorkoutCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },

  list:        { paddingHorizontal: SPACING.screen, paddingBottom: 40 },
  workoutCard: { marginBottom: 14 },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dateBlock: { flex: 1 },
  dateText:  { color: COLORS.white, fontSize: 15, fontWeight: FONT.bold },
  agoText:   { color: COLORS.textDim, fontSize: 10, letterSpacing: 1.5, marginTop: 3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  badge:     {
    backgroundColor: COLORS.goldFaint,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  badgeText: { color: COLORS.gold, fontSize: 9, fontWeight: FONT.bold, letterSpacing: 1 },
  chevron:   { color: COLORS.textDim, fontSize: 10 },

  // Volume
  volumeRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  volumeLabel: { color: COLORS.textDim, fontSize: 10, letterSpacing: 2 },
  volumeValue: { color: COLORS.textMuted, fontSize: 12, fontWeight: FONT.semibold },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  // Exercises
  exerciseRow:    { paddingVertical: 10 },
  exerciseBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  exerciseName:   {
    color: COLORS.textDim, fontSize: 10, fontWeight: FONT.bold,
    letterSpacing: 2, marginBottom: 8,
  },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  setChip: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: COLORS.surfaceDark,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  setWeight: { color: COLORS.white, fontSize: 14, fontWeight: FONT.bold },
  setUnit:   { color: COLORS.textDim, fontSize: 10, marginLeft: 1, marginRight: 4 },
  setSep:    { color: COLORS.textDim, fontSize: 11, marginRight: 4 },
  setReps:   { color: COLORS.white, fontSize: 14, fontWeight: FONT.bold },

  // Empty state
  emptyIcon:  { fontSize: 52, marginBottom: 20 },
  emptyTitle: { color: COLORS.white, fontSize: 22, fontWeight: FONT.black, marginBottom: 10, textAlign: 'center' },
  emptySub:   { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
