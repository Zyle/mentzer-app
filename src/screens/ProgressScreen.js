import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { analyzeSet } from '../lib/progression';
import { EXERCISES } from '../data/exercises';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

export default function ProgressScreen() {
  const [nextSessions, setNextSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: bests } = await supabase
        .from('personal_bests').select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (bests) {
        const sessions = bests.map(best => {
          const exercise = EXERCISES.find(e => e.name === best.exercise_name);
          if (!exercise) return null;
          const analysis = analyzeSet(exercise, best.weight_kg, best.reps, null);
          return {
            exercise:      best.exercise_name,
            currentWeight: best.weight_kg,
            currentReps:   best.reps,
            nextWeight:    analysis.nextWeight,
            action:        analysis.action,
            message:       analysis.message,
            restDays:      analysis.restDays,
            date:          best.date,
            isHD2Core:     exercise.hd2Core,
          };
        }).filter(Boolean);

        // HD2 core exercises appear first
        sessions.sort((a, b) => (b.isHD2Core ? 1 : 0) - (a.isHD2Core ? 1 : 0));
        setNextSessions(sessions);
      }
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
    new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

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

      {nextSessions.map((session, index) => {
        const actionColor = getActionColor(session.action);
        return (
          <Card key={index} style={styles.cardSpacing}>
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
                <Text style={styles.repsValue}>to failure</Text>
              </View>
            </View>

            <Text style={styles.sessionMessage}>{session.message}</Text>
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
});
