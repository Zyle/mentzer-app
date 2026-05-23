import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getRecoveryStatus } from '../lib/progression';
import { getRandomQuote } from '../data/quotes';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

const RECOVERY_PHASES = [
  { key: 'repairing',  label: 'REPAIRING',     hours: [0, 24],    color: COLORS.red,    advice: 'Muscle fibres are torn and repairing. Prioritise sleep and protein intake.' },
  { key: 'rebuilding', label: 'REBUILDING',     hours: [24, 48],   color: COLORS.orange, advice: 'Your body is actively rebuilding stronger tissue. Stay well fed and rested.' },
  { key: 'growing',    label: 'GROWING',        hours: [48, 96],   color: COLORS.gold,   advice: 'Supercompensation is occurring — muscles growing beyond previous capacity.' },
  { key: 'ready',      label: 'READY TO TRAIN', hours: [96, 144],  color: COLORS.green,  advice: 'Fully recovered. Train today for optimal results.' },
  { key: 'overdue',    label: 'OVERDUE',        hours: [144, 999], color: COLORS.textDim, advice: 'Past peak. Train as soon as possible.' },
];

function getPhase(totalHours) {
  for (const phase of RECOVERY_PHASES) {
    if (totalHours >= phase.hours[0] && totalHours < phase.hours[1]) return phase;
  }
  return RECOVERY_PHASES[RECOVERY_PHASES.length - 1];
}

// Circular progress fills CW from 12 o'clock.
//
// How it works: a gold disc sits behind two gray cover rectangles. Each cover is
// inside a rotating full-size wrapper whose center aligns with the container center.
// As the wrapper rotates CCW, its rectangle sweeps out of the half-clip, exposing gold.
// Right cover: 0°→-180° as pct 0→0.5 (fills 12→6 o'clock)
// Left cover:  0°→-180° as pct 0.5→1  (fills 6→12 o'clock)
function CircularProgress({ progress, color, size = 130, strokeWidth = 12 }) {
  const pct = Math.min(Math.max(progress, 0), 1);
  const half = size / 2;
  const innerSize = size - strokeWidth * 2;

  const rightCoverDeg = pct <= 0.5 ? -(pct * 360) : -180;
  const leftCoverDeg  = pct <= 0.5 ? 0 : -((pct - 0.5) * 360);

  return (
    <View style={{ width: size, height: size }}>
      {/* Gray track disc */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderRadius: half, backgroundColor: COLORS.border }} />
      {/* Gold disc — gray covers hide the unfilled portion */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderRadius: half, backgroundColor: color }} />

      {/* Right gray cover — clipped to right half, sweeps CCW to reveal gold CW */}
      <View style={{ position: 'absolute', top: 0, left: half, width: half, height: size, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, left: -half, width: size, height: size, transform: [{ rotate: `${rightCoverDeg}deg` }] }}>
          <View style={{ position: 'absolute', top: 0, right: 0, width: half, height: size, backgroundColor: COLORS.border }} />
        </View>
      </View>

      {/* Left gray cover — clipped to left half, sweeps CCW to reveal gold CW */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: half, height: size, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, transform: [{ rotate: `${leftCoverDeg}deg` }] }}>
          <View style={{ position: 'absolute', top: 0, left: 0, width: half, height: size, backgroundColor: COLORS.border }} />
        </View>
      </View>

      {/* Center hole — creates ring/donut appearance */}
      <View style={{
        position: 'absolute', top: strokeWidth, left: strokeWidth,
        width: innerSize, height: innerSize, borderRadius: innerSize / 2,
        backgroundColor: COLORS.surface,
      }} />

      {/* Text */}
      <View style={[styles.progressCenter, { width: size, height: size }]}>
        <Text style={[styles.circlePercent, { color }]}>{Math.round(pct * 100)}%</Text>
        <Text style={styles.circleLabel}>RECOVERED</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [recoveryStatus, setRecoveryStatus] = useState(null);
  const [quote, setQuote] = useState('');
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [recentSets, setRecentSets] = useState([]);
  const [hoursSinceWorkout, setHoursSinceWorkout] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setProfile(profileData);

      const { data: workouts } = await supabase
        .from('workouts').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(1);

      if (workouts && workouts.length > 0) {
        const diffMs = new Date() - new Date(workouts[0].date);
        const totalHours = diffMs / (1000 * 60 * 60);
        setHoursSinceWorkout(totalHours);
        const status = getRecoveryStatus(Math.floor(totalHours / 24));
        setRecoveryStatus(status);
        setQuote(getRandomQuote(status.readyToTrain ? 'preWorkout' : 'restDay'));
      } else {
        setHoursSinceWorkout(null);
        setRecoveryStatus(getRecoveryStatus(99));
        setQuote(getRandomQuote('preWorkout'));
      }

      const { data: sets } = await supabase
        .from('sets').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(5);
      setRecentSets(sets || []);

      const { data: allWorkouts } = await supabase
        .from('workouts').select('id').eq('user_id', user.id);
      setTotalWorkouts(allWorkouts?.length || 0);

    } catch (error) {
      console.error('HomeScreen loadData error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatTimeSince = (totalHours) => {
    if (totalHours === null) return 'No sessions logged yet';
    const days = Math.floor(totalHours / 24);
    const hours = Math.floor(totalHours % 24);
    if (days === 0) return `${hours}h since last session`;
    if (hours === 0) return `${days}d since last session`;
    return `${days}d ${hours}h since last session`;
  };

  const phase = hoursSinceWorkout !== null ? getPhase(hoursSinceWorkout) : getPhase(999);
  const progress = hoursSinceWorkout !== null ? Math.min(hoursSinceWorkout / 120, 1) : 1;
  const daysSinceWorkout = hoursSinceWorkout !== null ? Math.floor(hoursSinceWorkout / 24) : null;
  const firstName = profile?.name?.split(' ')[0];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <ScreenHeader
        title="MENTZER"
        subtitle="HEAVY DUTY II"
        topContent={
          firstName
            ? <Text style={styles.greeting}>Welcome back, {firstName}.</Text>
            : null
        }
      />

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>WORKOUTS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{daysSinceWorkout ?? '—'}</Text>
          <Text style={styles.statLabel}>DAYS REST</Text>
        </View>
        <View style={[styles.statBox, recoveryStatus?.readyToTrain && styles.statBoxReady]}>
          <Text style={[styles.statNumber, { color: recoveryStatus?.readyToTrain ? COLORS.green : COLORS.red }]}>
            {recoveryStatus?.readyToTrain ? 'YES' : 'NO'}
          </Text>
          <Text style={styles.statLabel}>READY</Text>
        </View>
      </View>

      {/* Recovery Card */}
      <Card style={styles.cardSpacing}>
        <Text style={styles.sectionLabel}>RECOVERY STATUS</Text>

        <View style={styles.recoveryBody}>
          <CircularProgress progress={progress} color={COLORS.gold} />
          <View style={styles.phaseInfo}>
            <View style={[styles.phaseBadge, { backgroundColor: phase.color + '22', borderColor: phase.color + '55' }]}>
              <Text style={[styles.phaseLabel, { color: phase.color }]}>{phase.label}</Text>
            </View>
            <Text style={styles.timeSince}>{formatTimeSince(hoursSinceWorkout)}</Text>
            <Text style={styles.phaseAdvice}>{phase.advice}</Text>
          </View>
        </View>

        {/* Phase Bar */}
        <View style={styles.phaseBarRow}>
          {RECOVERY_PHASES.slice(0, 4).map((p) => (
            <View key={p.key} style={styles.phaseBarItem}>
              <View style={[
                styles.phaseBarSegment,
                { backgroundColor: p.key === phase.key ? p.color : COLORS.border },
              ]} />
              <Text style={[styles.phaseBarLabel, p.key === phase.key && { color: p.color }]}>
                {p.label.split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Train Button */}
      <TouchableOpacity
        style={[styles.trainButton, !recoveryStatus?.readyToTrain && styles.trainButtonDim]}
        onPress={() => navigation.navigate('Workout')}
        activeOpacity={0.8}
      >
        <Text style={[styles.trainButtonText, !recoveryStatus?.readyToTrain && styles.trainButtonTextDim]}>
          {recoveryStatus?.readyToTrain ? '+ START WORKOUT' : 'LOG WORKOUT ANYWAY'}
        </Text>
      </TouchableOpacity>

      {/* Quote */}
      <Card style={[styles.cardSpacing, styles.quoteAccent]}>
        <Text style={styles.quoteLabel}>MIKE MENTZER</Text>
        <Text style={styles.quoteText}>"{quote}"</Text>
      </Card>

      {/* Recent Sets */}
      {recentSets.length > 0 && (
        <View>
          <Text style={styles.sectionLabelPadded}>RECENT SETS</Text>
          <Card style={styles.cardSpacing}>
            {recentSets.map((set, index) => (
              <View
                key={set.id}
                style={[styles.setRow, index === recentSets.length - 1 && { borderBottomWidth: 0 }]}
              >
                <Text style={styles.setExercise}>{set.exercise_name}</Text>
                <Text style={styles.setDetails}>{set.weight_kg}kg × {set.reps}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  greeting:       { color: COLORS.textDim, fontSize: 13, marginBottom: 4 },
  statsRow:       { flexDirection: 'row', paddingHorizontal: SPACING.screen, gap: 10, marginBottom: SPACING.md },
  statBox: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  statBoxReady:   { borderColor: COLORS.greenFaint },
  statNumber:     { fontSize: 26, fontWeight: FONT.black, color: COLORS.white },
  statLabel:      { fontSize: 9, color: COLORS.textDim, letterSpacing: 2, marginTop: 4, fontWeight: FONT.semibold },
  cardSpacing:    { marginHorizontal: SPACING.screen, marginBottom: SPACING.md },
  sectionLabel:   { color: COLORS.textDim, fontSize: 10, fontWeight: FONT.semibold, letterSpacing: 2, marginBottom: SPACING.md },
  sectionLabelPadded: { color: COLORS.textDim, fontSize: 10, fontWeight: FONT.semibold, letterSpacing: 2, marginBottom: SPACING.md, paddingHorizontal: SPACING.screen },
  recoveryBody:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginBottom: SPACING.lg },

  // Circular progress
  progressCenter:   { position: 'absolute', top: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  circlePercent:    { fontSize: 26, fontWeight: FONT.black },
  circleLabel:      { color: COLORS.gold, fontSize: 8, letterSpacing: 2, fontWeight: FONT.semibold, marginTop: 2 },

  phaseInfo:      { flex: 1 },
  phaseBadge:     { alignSelf: 'flex-start', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, marginBottom: 10 },
  phaseLabel:     { fontSize: 10, fontWeight: FONT.black, letterSpacing: 1 },
  timeSince:      { color: COLORS.white, fontSize: 13, fontWeight: FONT.semibold, marginBottom: SPACING.sm },
  phaseAdvice:    { color: COLORS.textDim, fontSize: 12, lineHeight: 18 },
  phaseBarRow:    { flexDirection: 'row', gap: 6 },
  phaseBarItem:   { flex: 1, alignItems: 'center' },
  phaseBarSegment:{ height: 4, width: '100%', borderRadius: 2, marginBottom: 6 },
  phaseBarLabel:  { color: COLORS.textFaint, fontSize: 8, letterSpacing: 1, fontWeight: FONT.semibold },

  trainButton: {
    marginHorizontal: SPACING.screen, marginBottom: SPACING.md,
    backgroundColor: COLORS.gold, paddingVertical: 18, borderRadius: RADIUS.lg, alignItems: 'center',
  },
  trainButtonDim:     { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  trainButtonText:    { color: '#000', fontSize: 15, fontWeight: FONT.black, letterSpacing: 2 },
  trainButtonTextDim: { color: COLORS.textFaint },

  quoteAccent:  { borderLeftWidth: 3, borderLeftColor: COLORS.gold },
  quoteLabel:   { color: COLORS.gold, fontSize: 9, fontWeight: FONT.semibold, letterSpacing: 3, marginBottom: 10 },
  quoteText:    { color: COLORS.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 22 },

  setRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  setExercise: { color: COLORS.white, fontSize: 14 },
  setDetails:  { color: COLORS.gold, fontSize: 14, fontWeight: FONT.semibold },
});
