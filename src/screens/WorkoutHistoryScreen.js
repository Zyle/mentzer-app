import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, Pressable, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import { IconBadge } from '../components/Badges';
import { useUnits, kgToDisplay } from '../lib/units';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, FONT, TYPE, RADIUS, SPACING } from '../theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Supabase returns microsecond timestamps; Hermes only parses milliseconds
const parseDate = (str) => new Date(String(str).replace(/(\.\d{3})\d*(Z|[+-]\d{2}:\d{2})$/, '$1$2'));

const formatDate = (dateStr) => {
  const d = parseDate(dateStr);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
};

const daysAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - parseDate(dateStr)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
};

// Rest gap colour — Mentzer's 4–7 day window is the target
const gapColor = (days) => {
  if (days < 4)  return COLORS.orange;
  if (days <= 7) return COLORS.green;
  return COLORS.textMuted;
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
function WorkoutCard({ item, imperial, weightUnit }) {
  const [expanded, setExpanded] = useState(true);
  const vol = Math.round(kgToDisplay(totalVolume(item.allSets), imperial));

  return (
    <Card style={styles.workoutCard}>
      <Pressable
        style={styles.cardHeader}
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${formatDate(item.date)}, ${daysAgo(item.date)}. ${item.exercises.length} exercises.${item.gapDays !== null ? ` ${Math.round(item.gapDays)} days after the previous session.` : ''}`}
        accessibilityHint={expanded ? 'Hides the exercises' : 'Shows the exercises'}
      >
        <IconBadge gym="dumbbell" size={40} />
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          <Text style={styles.agoText}>{daysAgo(item.date)}</Text>
        </View>
        {item.gapDays !== null && (
          <View style={[styles.gapBadge, { borderColor: gapColor(item.gapDays) + '66' }]}>
            <Feather name="moon" size={11} color={gapColor(item.gapDays)} />
            <Text style={[styles.gapText, { color: gapColor(item.gapDays) }]}>
              {item.gapDays < 1 ? '<1' : Math.round(item.gapDays)}d rest
            </Text>
          </View>
        )}
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textDim} />
      </Pressable>

      {expanded && (
        <View style={styles.exerciseList}>
          {item.exercises.map((ex, i) => (
            <View key={i} style={[styles.exerciseRow, i < item.exercises.length - 1 && styles.exerciseBorder]}>
              <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
              <View style={styles.setsRow}>
                {ex.sets.map((s, j) => (
                  <Text
                    key={j}
                    style={styles.setText}
                    accessibilityLabel={`${kgToDisplay(s.weight_kg, imperial)} ${imperial ? 'pounds' : 'kilograms'} for ${s.reps} reps`}
                  >
                    {kgToDisplay(s.weight_kg, imperial)}<Text style={styles.setUnit}>{weightUnit}</Text> × {s.reps}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{item.exercises.length} exercise{item.exercises.length === 1 ? '' : 's'}</Text>
        <Text style={styles.footerText}>{vol.toLocaleString()} {weightUnit} volume</Text>
      </View>
    </Card>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WorkoutHistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { imperial, weightUnit } = useUnits();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const [workoutsRes, setsRes] = await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', user.id),
        supabase.from('sets').select('*').eq('user_id', user.id),
      ]);

      if (workoutsRes.error) console.error('workouts fetch error:', workoutsRes.error);
      if (setsRes.error)     console.error('sets fetch error:', setsRes.error);

      // Sort in JS — avoids depending on any specific timestamp column name
      const ts = r => r.created_at || r.date || r.inserted_at || '';
      const workouts = (workoutsRes.data || []).sort((a, b) => ts(b).localeCompare(ts(a)));
      const sets     = (setsRes.data     || []).sort((a, b) => ts(a).localeCompare(ts(b)));

      const merged = workouts
        .map(w => {
          const wSets = sets.filter(s => s.workout_id === w.id);
          return {
            ...w,
            date:      w.date || w.created_at,
            allSets:   wSets,
            exercises: groupByExercise(wSets),
          };
        })
        .filter(w => w.exercises.length > 0)
        .map((w, i, arr) => {
          // Rest since the previous (older) session in the list
          const prev = arr[i + 1];
          const gapDays = prev ? (parseDate(w.date) - parseDate(prev.date)) / 86400000 : null;
          return { ...w, gapDays };
        });
      setHistory(merged);

    } catch (e) {
      console.error('loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalSessions = history.length;
  const gaps          = history.map(h => h.gapDays).filter(g => g !== null);
  const avgGap        = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  const inWindow      = gaps.filter(g => g >= 4 && g <= 7).length;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="History" />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" accessibilityLabel="Loading history" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="History" subtitle={totalSessions > 0 ? 'Every session, every set' : null} />

      {history.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Feather name="calendar" size={28} color={COLORS.gold} />
          </View>
          <Text style={styles.emptyTitle} accessibilityRole="header">No sessions yet</Text>
          <Text style={styles.emptySub}>
            Log your first workout and every set will be recorded here, along with the rest you took between sessions.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <WorkoutCard item={item} imperial={imperial} weightUnit={weightUnit} />}
          extraData={imperial}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Summary value={`${totalSessions}`} label="Sessions" />
              <Summary value={avgGap !== null ? `${avgGap.toFixed(1)}d` : '—'} label="Avg rest" />
              <Summary
                value={gaps.length ? `${inWindow}/${gaps.length}` : '—'}
                label="In 4–7d window"
                color={gaps.length && inWindow === gaps.length ? COLORS.green : undefined}
              />
            </View>
          }
        />
      )}
    </View>
  );
}

function Summary({ value, label, color }) {
  return (
    <View style={styles.summaryItem} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.summaryValue, color && { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, paddingBottom: 60 },

  list:        { paddingHorizontal: SPACING.screen, paddingBottom: 40 },
  workoutCard: { marginBottom: 12, paddingVertical: SPACING.md },

  summary:      { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
                  borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.md, marginBottom: SPACING.lg },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryValue: { color: COLORS.white, fontSize: 22, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  summaryLabel: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 2 },

  // Card header
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  dateBlock:  { flex: 1 },
  dateText:   { ...TYPE.heading, color: COLORS.white },
  agoText:    { ...TYPE.caption, color: COLORS.textDim, marginTop: 2 },
  gapBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: RADIUS.pill,
                paddingHorizontal: 8, paddingVertical: 3 },
  gapText:    { fontSize: 12, fontWeight: FONT.semibold },

  // Exercises
  exerciseList:   { marginTop: 10, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md, paddingHorizontal: 12 },
  exerciseRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  exerciseBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  exerciseName:   { flex: 1, color: COLORS.textSecondary, fontSize: 14, fontWeight: FONT.medium },
  setsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  setText:        { color: COLORS.white, fontSize: 15, fontWeight: FONT.bold, fontVariant: ['tabular-nums'] },
  setUnit:        { color: COLORS.textMuted, fontSize: 12, fontWeight: FONT.medium },

  footerRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  footerText: { ...TYPE.caption, color: COLORS.textDim },

  // Empty state
  emptyIcon:  { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.goldFaint,
                alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { ...TYPE.title, color: COLORS.white, marginBottom: 10, textAlign: 'center' },
  emptySub:   { ...TYPE.body, color: COLORS.textMuted, textAlign: 'center' },
});
