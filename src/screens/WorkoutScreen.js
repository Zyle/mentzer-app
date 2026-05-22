import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, Modal,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { EXERCISES, MUSCLES } from '../data/exercises';
import { analyzeSet } from '../lib/progression';
import Card from '../components/Card';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

export default function WorkoutScreen({ navigation }) {
  const [workoutId, setWorkoutId] = useState(null);
  const [loggedSets, setLoggedSets] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState('Legs');
  const [result, setResult] = useState(null);
  const [userId, setUserId] = useState(null);
  const [prevBest, setPrevBest] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    initUser();
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Only fetch user on mount — no DB write until first set is logged
  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user.id);
  };

  // Creates a workout record the first time a set is logged, then reuses the same ID
  const ensureWorkout = async (uid) => {
    if (workoutId) return workoutId;
    const { data: workout } = await supabase
      .from('workouts').insert({ user_id: uid }).select().single();
    if (workout) {
      setWorkoutId(workout.id);
      return workout.id;
    }
    return null;
  };

  const selectExercise = async (exercise) => {
    setSelectedExercise(exercise);
    setShowExercisePicker(false);
    setResult(null);

    if (userId) {
      const { data: pb } = await supabase
        .from('personal_bests').select('*')
        .eq('user_id', userId)
        .eq('exercise_name', exercise.name)
        .single();
      setPrevBest(pb || null);
    }
  };

  const logSet = async () => {
    if (!selectedExercise || !weight || !reps) {
      Alert.alert('Missing info', 'Select an exercise and enter weight and reps.');
      return;
    }
    const weightNum = parseFloat(weight);
    const repsNum = parseInt(reps);
    if (isNaN(weightNum) || isNaN(repsNum)) {
      Alert.alert('Invalid input', 'Enter valid numbers for weight and reps.');
      return;
    }

    const analysis = analyzeSet(selectedExercise, weightNum, repsNum, prevBest);
    const wid = await ensureWorkout(userId);

    await supabase.from('sets').insert({
      user_id: userId,
      workout_id: wid,
      exercise_name: selectedExercise.name,
      weight_kg: weightNum,
      reps: repsNum,
    });

    const isPR = !prevBest || repsNum > prevBest.reps || weightNum > prevBest.weight_kg;

    if (isPR) {
      await supabase.from('personal_bests').upsert({
        user_id: userId,
        exercise_name: selectedExercise.name,
        weight_kg: weightNum,
        reps: repsNum,
        date: new Date().toISOString(),
      }, { onConflict: 'user_id,exercise_name' });
      setPrevBest({ weight_kg: weightNum, reps: repsNum });
    }

    setLoggedSets(prev => [...prev, {
      exercise: selectedExercise.name,
      weight: weightNum,
      reps: repsNum,
      analysis,
      isPR,
    }]);

    setResult(analysis);
    setWeight('');
    setReps('');
  };

  const finishWorkout = () => {
    Alert.alert(
      'Finish Workout',
      'Great work. Leave the gym now. Growth begins during rest.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'FINISH', onPress: () => navigation.navigate('Main') },
      ]
    );
  };

  const filteredExercises = EXERCISES.filter(e => e.muscle === selectedMuscle);

  return (
    <View style={styles.container}>
      {/* Custom header — back, timer, finish */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← BACK</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>LOG SET</Text>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={finishWorkout}>
          <Text style={styles.finishButton}>FINISH</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {/* Exercise Selector */}
        <TouchableOpacity style={styles.exerciseSelector} onPress={() => setShowExercisePicker(true)} activeOpacity={0.8}>
          <Text style={styles.fieldLabel}>EXERCISE</Text>
          <View style={styles.exerciseSelectorRow}>
            <Text style={[styles.exerciseSelectorValue, !selectedExercise && { color: COLORS.textFaint }]}>
              {selectedExercise ? selectedExercise.name : 'Select Exercise'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          {selectedExercise && (
            <Text style={styles.exerciseMeta}>
              {selectedExercise.hd2Core ? '★ HD2 CORE' : selectedExercise.type === 'isolation' ? 'ISOLATION' : 'COMPOUND'} · {selectedExercise.repRange[0]}-{selectedExercise.repRange[1]} REPS
            </Text>
          )}
        </TouchableOpacity>

        {/* Previous Best */}
        {selectedExercise && (
          <View style={styles.prevBestRow}>
            <Text style={styles.fieldLabel}>PREVIOUS BEST</Text>
            <Text style={styles.prevBestValue}>
              {prevBest
                ? `${prevBest.weight_kg}kg × ${prevBest.reps} reps`
                : 'No data yet — this is your first set'}
            </Text>
          </View>
        )}

        {/* Weight & Reps Inputs */}
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>WEIGHT (KG)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.border}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>REPS</Text>
            <TextInput
              style={styles.input}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.border}
            />
          </View>
        </View>

        {/* Failure Reminder */}
        {(weight !== '' || reps !== '') && (
          <View style={styles.failurePrompt}>
            <Text style={styles.failureText}>
              ⚠️  Go to absolute muscular failure — the point at which another rep is physically impossible.
            </Text>
          </View>
        )}

        {/* Log Button */}
        <TouchableOpacity style={styles.logButton} onPress={logSet} activeOpacity={0.8}>
          <Text style={styles.logButtonText}>LOG SET</Text>
        </TouchableOpacity>

        {/* Result Card */}
        {result && (
          <Card style={styles.resultCard}>
            <Text style={styles.resultLabel}>NEXT SESSION</Text>
            <Text style={styles.resultMessage}>{result.message}</Text>
            {result.progressNote && (
              <View style={styles.prBadge}>
                <Text style={styles.prBadgeText}>🏆 {result.progressNote}</Text>
              </View>
            )}
            <View style={styles.resultFooter}>
              <Text style={styles.restText}>Min rest: {result.restDays} days</Text>
              <Text style={styles.nextWeightText}>{result.nextWeight}kg next</Text>
            </View>
          </Card>
        )}

        {/* Logged Sets */}
        {loggedSets.length > 0 && (
          <Card style={styles.cardSpacing}>
            <Text style={styles.loggedTitle}>THIS WORKOUT · {loggedSets.length} SET{loggedSets.length > 1 ? 'S' : ''}</Text>
            {loggedSets.map((set, index) => (
              <View key={index} style={[styles.loggedSet, index === loggedSets.length - 1 && { borderBottomWidth: 0 }]}>
                <View>
                  <Text style={styles.loggedExercise}>{set.exercise}</Text>
                  {set.isPR && <Text style={styles.prTag}>🏆 PR</Text>}
                </View>
                <Text style={styles.loggedDetails}>{set.weight}kg × {set.reps}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Mentzer Note */}
        {selectedExercise?.mentzerNote && (
          <Card style={[styles.cardSpacing, styles.mentzerAccent]}>
            <Text style={styles.mentzerNoteLabel}>MENTZER ON {selectedExercise.name.toUpperCase()}</Text>
            <Text style={styles.mentzerNoteText}>{selectedExercise.mentzerNote}</Text>
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Exercise Picker Modal */}
      <Modal visible={showExercisePicker} animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>SELECT EXERCISE</Text>
            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
              <Text style={styles.modalClose}>CLOSE</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal style={styles.muscleFilter} showsHorizontalScrollIndicator={false}>
            {MUSCLES.map(muscle => (
              <TouchableOpacity
                key={muscle}
                style={[styles.muscleChip, selectedMuscle === muscle && styles.muscleChipActive]}
                onPress={() => setSelectedMuscle(muscle)}
              >
                <Text style={[styles.muscleChipText, selectedMuscle === muscle && styles.muscleChipTextActive]}>
                  {muscle}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView>
            {filteredExercises.map(exercise => (
              <TouchableOpacity
                key={exercise.name}
                style={styles.exerciseOption}
                onPress={() => selectExercise(exercise)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.exerciseOptionHeader}>
                    <Text style={styles.exerciseOptionName}>{exercise.name}</Text>
                    {exercise.hd2Core && (
                      <View style={styles.hd2Badge}>
                        <Text style={styles.hd2BadgeText}>HD2</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.exerciseOptionDetail}>
                    {exercise.type === 'compound' ? 'Compound' : 'Isolation'} · {exercise.repRange[0]}-{exercise.repRange[1]} reps
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Custom header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: SPACING.screen, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.surface,
  },
  backButton:   { color: COLORS.textDim, fontSize: 13, fontWeight: FONT.medium, letterSpacing: 1 },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { color: COLORS.white, fontSize: 14, fontWeight: FONT.black, letterSpacing: 3 },
  timerBadge: {
    marginTop: 4, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border,
  },
  timerText:    { color: COLORS.gold, fontSize: 12, fontWeight: FONT.semibold, letterSpacing: 1 },
  finishButton: { color: COLORS.gold, fontSize: 13, fontWeight: FONT.bold, letterSpacing: 1 },

  content: { flex: 1, padding: SPACING.screen },
  cardSpacing: { marginBottom: SPACING.md },

  // Exercise selector
  exerciseSelector: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  exerciseSelectorRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseSelectorValue: { color: COLORS.white, fontSize: 18, fontWeight: FONT.semibold },
  exerciseMeta:          { color: COLORS.gold, fontSize: 10, letterSpacing: 1, marginTop: 6, fontWeight: FONT.medium },
  chevron:               { color: COLORS.textDim, fontSize: 24 },

  // Previous best
  prevBestRow: {
    backgroundColor: '#161614', borderRadius: RADIUS.md, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  prevBestValue: { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.medium },

  // Inputs
  fieldLabel: { color: COLORS.textDim, fontSize: 10, letterSpacing: 2, fontWeight: FONT.semibold, marginBottom: SPACING.sm },
  inputRow:   { flexDirection: 'row', gap: 12, marginBottom: 12 },
  inputGroup: { flex: 1 },
  input: {
    backgroundColor: COLORS.surface, color: COLORS.white, fontSize: 40,
    fontWeight: FONT.black, textAlign: 'center', paddingVertical: 24,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
  },

  failurePrompt: {
    backgroundColor: '#161410', borderRadius: RADIUS.md, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.goldFaint,
  },
  failureText: { color: COLORS.gold, fontSize: 13, lineHeight: 20 },

  logButton:     { backgroundColor: COLORS.gold, paddingVertical: 18, borderRadius: RADIUS.lg, alignItems: 'center', marginBottom: SPACING.md },
  logButtonText: { color: '#000', fontSize: 15, fontWeight: FONT.black, letterSpacing: 2 },

  // Result card
  resultCard:    { backgroundColor: '#0d1a0d', borderWidth: 1, borderColor: '#2d4d2d', marginBottom: SPACING.md },
  resultLabel:   { color: COLORS.green, fontSize: 10, letterSpacing: 3, fontWeight: FONT.semibold, marginBottom: 10 },
  resultMessage: { color: COLORS.white, fontSize: 14, lineHeight: 22 },
  prBadge:       { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.sm, padding: 10, marginTop: 12, borderWidth: 1, borderColor: COLORS.goldBorder },
  prBadgeText:   { color: COLORS.gold, fontSize: 13, fontWeight: FONT.semibold },
  resultFooter:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  restText:      { color: COLORS.textDim, fontSize: 12 },
  nextWeightText:{ color: COLORS.gold, fontSize: 13, fontWeight: FONT.bold },

  // Logged sets
  loggedTitle:    { color: COLORS.textDim, fontSize: 10, letterSpacing: 2, fontWeight: FONT.semibold, marginBottom: 12 },
  loggedSet:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  loggedExercise: { color: COLORS.white, fontSize: 14, fontWeight: FONT.medium },
  prTag:          { color: COLORS.gold, fontSize: 11, marginTop: 2 },
  loggedDetails:  { color: COLORS.gold, fontSize: 15, fontWeight: FONT.black },

  // Mentzer note
  mentzerAccent:    { borderLeftWidth: 3, borderLeftColor: COLORS.gold, marginBottom: SPACING.md },
  mentzerNoteLabel: { color: COLORS.gold, fontSize: 9, letterSpacing: 2, fontWeight: FONT.semibold, marginBottom: SPACING.sm },
  mentzerNoteText:  { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, fontStyle: 'italic' },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: SPACING.screen, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.surface,
  },
  modalTitle: { color: COLORS.white, fontSize: 16, fontWeight: FONT.black, letterSpacing: 3 },
  modalClose: { color: COLORS.gold, fontSize: 13, fontWeight: FONT.semibold, letterSpacing: 1 },

  muscleFilter:        { paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md, maxHeight: 64 },
  muscleChip:          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  muscleChipActive:    { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  muscleChipText:      { color: COLORS.textDim, fontSize: 12, fontWeight: FONT.medium },
  muscleChipTextActive:{ color: '#000', fontWeight: FONT.bold },

  exerciseOption:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.surface },
  exerciseOptionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  exerciseOptionName:   { color: COLORS.white, fontSize: 16, fontWeight: FONT.medium },
  hd2Badge:     { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.goldBorder },
  hd2BadgeText: { color: COLORS.gold, fontSize: 9, fontWeight: FONT.bold, letterSpacing: 1 },
  exerciseOptionDetail: { color: COLORS.textDim, fontSize: 12 },
});
