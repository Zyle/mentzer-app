import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getNextTarget, setsByExercise, bestOf } from '../lib/progression';
import { findExercise, canonicalName } from '../data/exercises';
import { loadProgramme } from '../lib/programme';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import { IconBadge, Tag, muscleIcon } from '../components/Badges';
import { FadeInUp } from '../lib/motion';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

export default function ProgressScreen() {
  const [nextSessions, setNextSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reload every time the tab is focused so targets reflect the latest workout
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: sets }, prog, savedIncrement] = await Promise.all([
        supabase.from('sets')
          .select('exercise_name, weight_kg, reps, date')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
        loadProgramme(user.id),
        AsyncStorage.getItem('weightIncrement').catch(() => null),
      ]);
      const increment = savedIncrement ? parseFloat(savedIncrement) : 2.5;

      // Programme order first (A then B), then anything else logged
      const order = new Map();
      prog.sessions.forEach(sess => sess.exercises.forEach(e => {
        if (!order.has(e.name)) order.set(e.name, order.size);
      }));

      const byExercise = setsByExercise(sets || [], canonicalName);
      const sessions = Object.entries(byExercise).map(([name, list]) => {
        const exercise = findExercise(name);
        const target = getNextTarget(exercise, list[0], list[1], increment);
        if (!target) return null;
        const best = bestOf(list);
        return {
          exercise:      name,
          currentWeight: target.lastWeight,
          currentReps:   target.lastReps,
          nextWeight:    target.weight,
          repGoal:       target.repGoal,
          action:        target.action,
          message:       target.message,
          progressNote:  target.progressNote,
          restDays:      target.restDays,
          date:          target.lastDate,
          best,
          isHD2Core:     exercise.hd2Core,
          inProgramme:   order.has(name),
          // Estimated 1RM per session, oldest → newest (sparkline only)
          trail:         list.slice(0, 8).map(st => st.weight_kg * (1 + st.reps / 30)).reverse(),
        };
      }).filter(Boolean);

      sessions.sort((a, b) => {
        const oa = order.has(a.exercise) ? order.get(a.exercise) : Infinity;
        const ob = order.has(b.exercise) ? order.get(b.exercise) : Infinity;
        if (oa !== ob) return oa - ob;
        return (b.isHD2Core ? 1 : 0) - (a.isHD2Core ? 1 : 0);
      });
      setNextSessions(sessions);
    } catch (error) {
      console.error('ProgressScreen loadData error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const ACTION = {
    increase: { color: COLORS.green, icon: 'arrow-up-right',  label: 'Increase' },
    reduce:   { color: COLORS.red,   icon: 'arrow-down-right', label: 'Reduce'   },
    maintain: { color: COLORS.gold,  icon: 'arrow-right',      label: 'Maintain' },
  };
  const actionOf = a => ACTION[a] || ACTION.maintain;

  const formatDate = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

  const counts = nextSessions.reduce((acc, ss) => { acc[ss.action] = (acc[ss.action] || 0) + 1; return acc; }, {});

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Progress" subtitle="Next session targets" />

      {nextSessions.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <IconBadge gym="chart-line" size={64} />
          <Text style={styles.emptyText}>No workouts logged yet</Text>
          <Text style={styles.emptySubtext}>Log your first set and your next-session targets will appear here.</Text>
        </View>
      )}

      {nextSessions.length > 0 && (
        <FadeInUp index={0} style={styles.summary}>
          {['increase', 'maintain', 'reduce'].map(k => (
            <View key={k} style={styles.summaryTile} accessible accessibilityLabel={`${counts[k] || 0} lifts to ${ACTION[k].label.toLowerCase()}`}>
              <View style={[styles.summaryIcon, { backgroundColor: ACTION[k].color + '22' }]}>
                <Feather name={ACTION[k].icon} size={16} color={ACTION[k].color} />
              </View>
              <Text style={styles.summaryNum}>{counts[k] || 0}</Text>
              <Text style={styles.summaryLabel}>{ACTION[k].label}</Text>
            </View>
          ))}
        </FadeInUp>
      )}

      {nextSessions.map((session, i) => {
        const a = actionOf(session.action);
        const exercise = findExercise(session.exercise);
        return (
          <FadeInUp key={session.exercise} index={i + 1}>
            <Card style={styles.cardSpacing}>
              <View style={styles.sessionHeader}>
                <IconBadge gym={muscleIcon(exercise?.muscle)} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{session.exercise}</Text>
                  <Text style={styles.sessionDate}>Last logged {formatDate(session.date)}</Text>
                </View>
                <View style={[styles.actionBadge, { backgroundColor: a.color + '1f' }]} accessible accessibilityLabel={`Next session: ${a.label}`}>
                  <Feather name={a.icon} size={13} color={a.color} />
                  <Text style={[styles.actionText, { color: a.color }]}>{a.label}</Text>
                </View>
              </View>

              <View style={styles.weightsRow}>
                <View style={styles.weightBox} accessible accessibilityLabel={`Last: ${session.currentWeight} kilograms for ${session.currentReps} reps`}>
                  <Text style={styles.weightBoxLabel}>Last</Text>
                  <Text style={styles.weightValue}>
                    {session.currentWeight}<Text style={styles.weightUnit}>kg</Text>
                  </Text>
                  <Text style={styles.repsValue}>{session.currentReps} reps</Text>
                </View>
                <View style={[styles.arrowCircle, { backgroundColor: a.color }]}>
                  <Feather name="arrow-right" size={18} color={COLORS.onGold} />
                </View>
                <View style={styles.weightBox} accessible accessibilityLabel={`Next: ${session.nextWeight} kilograms, ${session.repGoal} or more reps to failure`}>
                  <Text style={styles.weightBoxLabel}>Next</Text>
                  <Text style={[styles.weightValue, { color: a.color }]}>
                    {session.nextWeight}<Text style={[styles.weightUnit, { color: a.color }]}>kg</Text>
                  </Text>
                  <Text style={styles.repsValue}>{session.repGoal}+ reps to failure</Text>
                </View>
              </View>

              {session.trail?.length >= 2 && (
                <Sparkline values={session.trail} color={a.color} label={`${session.exercise} strength over the last ${session.trail.length} sessions`} />
              )}

              {session.progressNote && (
                <Text style={styles.progressNote}>{session.progressNote}</Text>
              )}
              <Text style={styles.sessionMessage}>{session.message}</Text>

              <View style={styles.chipRow}>
                {session.best && (
                  <View style={styles.infoChip}>
                    <MaterialCommunityIcons name="trophy-outline" size={13} color={COLORS.gold} />
                    <Text style={styles.infoChipText}>Best {session.best.weight_kg}kg × {session.best.reps}</Text>
                  </View>
                )}
                <View style={styles.infoChip}>
                  <Feather name="moon" size={12} color={COLORS.textMuted} />
                  <Text style={styles.infoChipText}>Rest {session.restDays}+ days</Text>
                </View>
                {session.isHD2Core && <Tag label="HD2" color={COLORS.gold} />}
              </View>
            </Card>
          </FadeInUp>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Tiny strength sparkline (estimated 1RM per session, oldest → newest)
function Sparkline({ values, color, label }) {
  const [w, setW] = useState(0);
  const H = 44;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * (w - 8) + 4, y: H - 6 - ((v - lo) / span) * (H - 12) }));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <View style={styles.spark} onLayout={e => setW(e.nativeEvent.layout.width)} accessible accessibilityRole="image" accessibilityLabel={label}>
      {w > 0 && (
        <Svg width={w} height={H}>
          <Defs>
            <SvgGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.25} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </SvgGradient>
          </Defs>
          <Path d={`${d} L ${last.x} ${H} L ${pts[0].x} ${H} Z`} fill="url(#sparkFill)" />
          <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={last.x} cy={last.y} r={3.5} fill={COLORS.white} stroke={color} strokeWidth={2} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  cardSpacing: { marginHorizontal: SPACING.screen, marginBottom: 12 },

  emptyState:   { padding: 48, alignItems: 'center', gap: 10 },
  emptyText:    { color: COLORS.white, fontSize: 18, fontWeight: FONT.bold, marginTop: 8 },
  emptySubtext: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },

  summary:      { flexDirection: 'row', gap: 10, marginHorizontal: SPACING.screen, marginBottom: SPACING.lg },
  summaryTile:  { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 12 },
  summaryIcon:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  summaryNum:   { color: COLORS.white, fontSize: 24, fontWeight: FONT.black, marginTop: 8, fontVariant: ['tabular-nums'] },
  summaryLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: FONT.medium },

  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md },
  exerciseName:  { color: COLORS.white, fontSize: 17, fontWeight: FONT.bold },
  sessionDate:   { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  actionBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill },
  actionText:    { fontSize: 12, fontWeight: FONT.bold },

  weightsRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceDark,
                    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  weightBox:      { flex: 1, alignItems: 'center' },
  weightBoxLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: FONT.semibold, marginBottom: 4 },
  weightValue:    { color: COLORS.white, fontSize: 30, fontWeight: FONT.black, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  weightUnit:     { fontSize: 14, color: COLORS.textMuted, fontWeight: FONT.semibold },
  repsValue:      { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  arrowCircle:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  spark:          { height: 44, marginBottom: SPACING.md },
  progressNote:   { color: COLORS.white, fontSize: 14, fontWeight: FONT.semibold, marginBottom: 6 },
  sessionMessage: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  infoChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.surfaceRaised,
                    borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  infoChipText:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: FONT.medium },
});
