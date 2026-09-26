import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getNextTarget, setsByExercise, bestOf } from '../lib/progression';
import { findExercise, canonicalName } from '../data/exercises';
import { loadProgramme } from '../lib/programme';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
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

  const getActionColor = (action) => {
    if (action === 'increase') return COLORS.green;
    if (action === 'reduce') return COLORS.red;
    return COLORS.gold;
  };

  const getActionLabel = (action) => {
    if (action === 'increase') return '↑ INCREASE';
    if (action === 'reduce') return '↓ REDUCE';
    return '→ MAINTAIN';
  };

  const formatDate = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <ScreenHeader title="PROGRESS" subtitle="NEXT SESSION TARGETS" bordered />

      {nextSessions.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>No workouts logged yet</Text>
          <Text style={styles.emptySubtext}>Log your first set to see your next session targets here.</Text>
        </View>
      )}

      {nextSessions.map((session) => {
        const actionColor = getActionColor(session.action);
        return (
          <Card key={session.exercise} style={styles.cardSpacing}>
            <View style={styles.sessionHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.exerciseNameRow}>
                  <Text style={styles.exerciseName}>{session.exercise}</Text>
                  {session.isHD2Core && (
                    <View style={styles.hd2Badge}>
                      <Text style={styles.hd2BadgeText}>HD2</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sessionDate}>Last logged {formatDate(session.date)}</Text>
              </View>
              <View style={[styles.actionBadge, { backgroundColor: actionColor + '22' }]}>
                <Text style={[styles.actionText, { color: actionColor }]}>
                  {getActionLabel(session.action)}
                </Text>
              </View>
            </View>

            <View style={styles.weightsRow}>
              <View style={styles.weightBox}>
                <Text style={styles.weightBoxLabel}>LAST</Text>
                <Text style={styles.weightValue}>
                  {session.currentWeight}<Text style={styles.weightUnit}>kg</Text>
                </Text>
                <Text style={styles.repsValue}>{session.currentReps} reps</Text>
              </View>
              <View style={styles.arrowContainer}>
                <Text style={styles.arrow}>→</Text>
              </View>
              <View style={styles.weightBox}>
                <Text style={styles.weightBoxLabel}>NEXT</Text>
                <Text style={[styles.weightValue, { color: actionColor }]}>
                  {session.nextWeight}<Text style={[styles.weightUnit, { color: actionColor }]}>kg</Text>
                </Text>
                <Text style={styles.repsValue}>{session.repGoal}+ reps to failure</Text>
              </View>
            </View>

            {session.progressNote && (
              <Text style={styles.progressNote}>{session.progressNote}</Text>
            )}
            <Text style={styles.sessionMessage}>{session.message}</Text>
            {session.best && (
              <Text style={styles.bestLine}>
                Best: {session.best.weight_kg}kg × {session.best.reps} reps
              </Text>
            )}
            <View style={styles.restBadge}>
              <Text style={styles.restBadgeText}>Min rest: {session.restDays} days</Text>
            </View>
          </Card>
        );
      })}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  cardSpacing: { marginHorizontal: SPACING.screen, marginTop: SPACING.lg, marginBottom: 0 },

  emptyState:   { padding: 60, alignItems: 'center' },
  emptyEmoji:   { fontSize: 40, marginBottom: 16 },
  emptyText:    { color: COLORS.white, fontSize: 16, fontWeight: FONT.semibold, marginBottom: 8 },
  emptySubtext: { color: COLORS.textDim, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sessionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  exerciseName:    { color: COLORS.white, fontSize: 16, fontWeight: FONT.bold },
  hd2Badge:      { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.goldBorder },
  hd2BadgeText:  { color: COLORS.gold, fontSize: 9, fontWeight: FONT.bold, letterSpacing: 1 },
  sessionDate:   { color: COLORS.textDim, fontSize: 11 },
  actionBadge:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm },
  actionText:    { fontSize: 10, fontWeight: FONT.black, letterSpacing: 1 },

  weightsRow:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  weightBox:      { flex: 1, alignItems: 'center' },
  weightBoxLabel: { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, fontWeight: FONT.semibold, marginBottom: 6 },
  weightValue:    { color: COLORS.white, fontSize: 32, fontWeight: FONT.black },
  weightUnit:     { fontSize: 16, color: COLORS.textMuted },
  repsValue:      { color: COLORS.textDim, fontSize: 11, marginTop: 4 },
  arrowContainer: { paddingHorizontal: SPACING.md },
  arrow:          { color: COLORS.gold, fontSize: 22, fontWeight: FONT.black },

  sessionMessage: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  restBadge: {
    backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border,
  },
  restBadgeText: { color: COLORS.textDim, fontSize: 11, fontWeight: FONT.medium },
  progressNote:  { color: COLORS.white, fontSize: 13, fontWeight: FONT.semibold, marginBottom: 8 },
  bestLine:      { color: COLORS.textDim, fontSize: 12, marginBottom: 12 },
});
