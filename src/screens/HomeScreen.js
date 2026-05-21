import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getRecoveryStatus } from '../lib/progression';
import { getRandomQuote } from '../data/quotes';

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [lastWorkout, setLastWorkout] = useState(null);
  const [recentSets, setRecentSets] = useState([]);
  const [recoveryStatus, setRecoveryStatus] = useState(null);
  const [quote, setQuote] = useState('');
  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      // Load last workout
      const { data: workouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1);

      if (workouts && workouts.length > 0) {
        setLastWorkout(workouts[0]);
        const lastDate = new Date(workouts[0].date);
        const now = new Date();
        const daysDiff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        const status = getRecoveryStatus(daysDiff);
        setRecoveryStatus(status);
        setQuote(getRandomQuote(status.readyToTrain ? 'preWorkout' : 'restDay'));
      } else {
        setRecoveryStatus(getRecoveryStatus(99));
        setQuote(getRandomQuote('preWorkout'));
      }

      // Load recent sets
      const { data: sets } = await supabase
        .from('sets')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);
      setRecentSets(sets || []);

      // Calculate streak
      const { data: allWorkouts } = await supabase
        .from('workouts')
        .select('date')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (allWorkouts) {
        let currentStreak = 0;
        for (let i = 0; i < allWorkouts.length; i++) {
          currentStreak++;
        }
        setStreak(currentStreak);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const daysSinceWorkout = lastWorkout
    ? Math.floor((new Date() - new Date(lastWorkout.date)) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c9a84c" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MENTZER</Text>
        <Text style={styles.headerSubtitle}>HEAVY DUTY METHOD</Text>
      </View>

      {/* Recovery Status */}
      {recoveryStatus && (
        <View style={[styles.card, styles.recoveryCard]}>
          <Text style={styles.recoveryEmoji}>{recoveryStatus.emoji}</Text>
          <Text style={styles.recoveryMessage}>{recoveryStatus.message}</Text>
          {daysSinceWorkout !== null && (
            <Text style={styles.daysText}>
              {daysSinceWorkout === 0 ? 'Trained today' : `${daysSinceWorkout} day${daysSinceWorkout !== 1 ? 's' : ''} since last workout`}
            </Text>
          )}
        </View>
      )}

      {/* Quote */}
      <View style={styles.quoteCard}>
        <Text style={styles.quoteText}>"{quote}"</Text>
        <Text style={styles.quoteAuthor}>— Mike Mentzer</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{streak}</Text>
          <Text style={styles.statLabel}>WORKOUTS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{daysSinceWorkout ?? '—'}</Text>
          <Text style={styles.statLabel}>DAYS REST</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: recoveryStatus?.readyToTrain ? '#4CAF50' : '#c9a84c' }]}>
            {recoveryStatus?.readyToTrain ? 'YES' : 'NO'}
          </Text>
          <Text style={styles.statLabel}>READY</Text>
        </View>
      </View>

      {/* Train Button */}
      <TouchableOpacity
        style={[styles.trainButton, !recoveryStatus?.readyToTrain && styles.trainButtonDisabled]}
        onPress={() => navigation.navigate('Workout')}
      >
        <Text style={styles.trainButtonText}>
          {recoveryStatus?.readyToTrain ? 'START WORKOUT' : 'LOG WORKOUT ANYWAY'}
        </Text>
      </TouchableOpacity>

      {/* Recent Sets */}
      {recentSets.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT SETS</Text>
          {recentSets.map((set, index) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setExercise}>{set.exercise_name}</Text>
              <Text style={styles.setDetails}>{set.weight_kg}kg × {set.reps} reps</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
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
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  recoveryCard: {
    borderColor: '#c9a84c',
    borderWidth: 1,
  },
  recoveryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  recoveryMessage: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  daysText: {
    color: '#c9a84c',
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 1,
  },
  quoteCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#111',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#c9a84c',
  },
  quoteText: {
    color: '#ccc',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  quoteAuthor: {
    color: '#c9a84c',
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 9,
    color: '#666',
    letterSpacing: 2,
    marginTop: 4,
  },
  trainButton: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#c9a84c',
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  trainButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  trainButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  section: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: '#666',
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 12,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  setExercise: {
    color: '#ffffff',
    fontSize: 14,
  },
  setDetails: {
    color: '#c9a84c',
    fontSize: 14,
    fontWeight: '600',
  },
});
