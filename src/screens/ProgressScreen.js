import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { analyzeSet } from '../lib/progression';
import { EXERCISES } from '../data/exercises';

export default function ProgressScreen() {
  const [personalBests, setPersonalBests] = useState([]);
  const [nextSessions, setNextSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: bests } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (bests) {
      setPersonalBests(bests);

      // Calculate next session targets for each exercise
      const sessions = bests.map(best => {
        const exercise = EXERCISES.find(e => e.name === best.exercise_name);
        if (!exercise) return null;
        const analysis = analyzeSet(exercise, best.weight_kg, best.reps, null);
        return {
          exercise: best.exercise_name,
          currentWeight: best.weight_kg,
          currentReps: best.reps,
          nextWeight: analysis.nextWeight,
          action: analysis.action,
          message: analysis.message,
          date: best.date,
        };
      }).filter(Boolean);

      setNextSessions(sessions);
    }
    setLoading(false);
  };

  const getActionColor = (action) => {
    if (action === 'increase') return '#4CAF50';
    if (action === 'reduce') return '#f44336';
    return '#c9a84c';
  };

  const getActionLabel = (action) => {
    if (action === 'increase') return '↑ INCREASE';
    if (action === 'reduce') return '↓ REDUCE';
    return '→ MAINTAIN';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROGRESS</Text>
        <Text style={styles.headerSubtitle}>NEXT SESSION TARGETS</Text>
      </View>

      {nextSessions.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No workouts logged yet.</Text>
          <Text style={styles.emptySubtext}>Log your first set to see your next session targets.</Text>
        </View>
      )}

      {nextSessions.map((session, index) => (
        <View key={index} style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <Text style={styles.exerciseName}>{session.exercise}</Text>
            <View style={[styles.actionBadge, { backgroundColor: getActionColor(session.action) + '22' }]}>
              <Text style={[styles.actionText, { color: getActionColor(session.action) }]}>
                {getActionLabel(session.action)}
              </Text>
            </View>
          </View>

          <View style={styles.weightsRow}>
            <View style={styles.weightBox}>
              <Text style={styles.weightLabel}>LAST</Text>
              <Text style={styles.weightValue}>{session.currentWeight}kg</Text>
              <Text style={styles.repsValue}>{session.currentReps} reps</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.weightBox}>
              <Text style={styles.weightLabel}>NEXT</Text>
              <Text style={[styles.weightValue, { color: getActionColor(session.action) }]}>
                {session.nextWeight}kg
              </Text>
              <Text style={styles.repsValue}>push to failure</Text>
            </View>
          </View>

          <Text style={styles.sessionMessage}>{session.message}</Text>
        </View>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 6,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#c9a84c',
    letterSpacing: 3,
    marginTop: 2,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: { color: '#fff', fontSize: 16, marginBottom: 8 },
  emptySubtext: { color: '#666', fontSize: 13, textAlign: 'center' },
  sessionCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseName: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  weightsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  weightBox: { flex: 1, alignItems: 'center' },
  weightLabel: { color: '#666', fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  weightValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
  repsValue: { color: '#666', fontSize: 11, marginTop: 2 },
  arrow: { color: '#c9a84c', fontSize: 24, marginHorizontal: 16 },
  sessionMessage: { color: '#aaa', fontSize: 13, lineHeight: 20 },
});
