import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, Modal,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { EXERCISES, MUSCLES } from '../data/exercises';
import { analyzeSet } from '../lib/progression';
import { getRandomQuote } from '../data/quotes';

export default function WorkoutScreen({ navigation }) {
  const [workoutId, setWorkoutId] = useState(null);
  const [loggedSets, setLoggedSets] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState('Chest');
  const [result, setResult] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    initWorkout();
  }, []);

  const initWorkout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user.id);

    const { data: workout, error } = await supabase
      .from('workouts')
      .insert({ user_id: user.id })
      .select()
      .single();

    if (workout) setWorkoutId(workout.id);
  };

  const logSet = async () => {
    if (!selectedExercise || !weight || !reps) {
      Alert.alert('Error', 'Please select an exercise and enter weight and reps.');
      return;
    }

    const weightNum = parseFloat(weight);
    const repsNum = parseInt(reps);

    if (isNaN(weightNum) || isNaN(repsNum)) {
      Alert.alert('Error', 'Please enter valid numbers.');
      return;
    }

    // Get previous best
    const { data: prevBest } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_name', selectedExercise.name)
      .single();

    // Analyze the set
    const analysis = analyzeSet(selectedExercise, weightNum, repsNum, prevBest);

    // Save the set
    await supabase.from('sets').insert({
      user_id: userId,
      workout_id: workoutId,
      exercise_name: selectedExercise.name,
      weight_kg: weightNum,
      reps: repsNum,
    });

    // Update personal best if better
    if (!prevBest || repsNum > prevBest.reps || weightNum > prevBest.weight_kg) {
      await supabase.from('personal_bests').upsert({
        user_id: userId,
        exercise_name: selectedExercise.name,
        weight_kg: weightNum,
        reps: repsNum,
        date: new Date().toISOString(),
      }, { onConflict: 'user_id,exercise_name' });
    }

    setLoggedSets([...loggedSets, {
      exercise: selectedExercise.name,
      weight: weightNum,
      reps: repsNum,
      analysis,
    }]);

    setResult(analysis);
    setWeight('');
    setReps('');
  };

  const finishWorkout = () => {
    Alert.alert(
      'Finish Workout',
      'Great work. Get out of the gym and rest.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'FINISH',
          onPress: () => navigation.navigate('Home'),
        },
      ]
    );
  };

  const filteredExercises = EXERCISES.filter(e => e.muscle === selectedMuscle);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LOG SET</Text>
        <TouchableOpacity onPress={finishWorkout}>
          <Text style={styles.finishButton}>FINISH</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Exercise Selector */}
        <TouchableOpacity
          style={styles.exerciseSelector}
          onPress={() => setShowExercisePicker(true)}
        >
          <Text style={styles.exerciseSelectorLabel}>EXERCISE</Text>
          <Text style={styles.exerciseSelectorValue}>
            {selectedExercise ? selectedExercise.name : 'Select Exercise'}
          </Text>
        </TouchableOpacity>

        {/* Weight & Reps */}
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>WEIGHT (KG)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#444"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>REPS</Text>
            <TextInput
              style={styles.input}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#444"
            />
          </View>
        </View>

        {/* Failure Prompt */}
        {reps !== '' && (
          <View style={styles.failurePrompt}>
            <Text style={styles.failureText}>
              ⚠️ Did you go to absolute muscular failure? Be honest — your results depend on it.
            </Text>
          </View>
        )}

        {/* Log Button */}
        <TouchableOpacity style={styles.logButton} onPress={logSet}>
          <Text style={styles.logButtonText}>LOG SET</Text>
        </TouchableOpacity>

        {/* Result */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>NEXT SESSION</Text>
            <Text style={styles.resultMessage}>{result.message}</Text>
            {result.progressNote && (
              <Text style={styles.progressNote}>{result.progressNote}</Text>
            )}
            <Text style={styles.restRecommendation}>
              Recommended rest: {result.restDays} days
            </Text>
          </View>
        )}

        {/* Logged Sets */}
        {loggedSets.length > 0 && (
          <View style={styles.loggedSets}>
            <Text style={styles.loggedTitle}>THIS WORKOUT</Text>
            {loggedSets.map((set, index) => (
              <View key={index} style={styles.loggedSet}>
                <Text style={styles.loggedExercise}>{set.exercise}</Text>
                <Text style={styles.loggedDetails}>{set.weight}kg × {set.reps}</Text>
              </View>
            ))}
          </View>
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

          {/* Muscle Filter */}
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
                onPress={() => {
                  setSelectedExercise(exercise);
                  setShowExercisePicker(false);
                }}
              >
                <View>
                  <Text style={styles.exerciseOptionName}>{exercise.name}</Text>
                  <Text style={styles.exerciseOptionDetail}>
                    {exercise.type === 'compound' ? 'Compound' : 'Isolation'} · {exercise.repRange[0]}-{exercise.repRange[1]} reps
                  </Text>
                </View>
                <Text style={styles.exerciseArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: { color: '#666', fontSize: 12, letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  finishButton: { color: '#c9a84c', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  content: { flex: 1, padding: 16 },
  exerciseSelector: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  exerciseSelectorLabel: { color: '#666', fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  exerciseSelectorValue: { color: '#fff', fontSize: 18, fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  inputGroup: { flex: 1 },
  inputLabel: { color: '#666', fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  failurePrompt: {
    backgroundColor: '#1a1a00',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c9a84c44',
  },
  failureText: { color: '#c9a84c', fontSize: 13, lineHeight: 20 },
  logButton: {
    backgroundColor: '#c9a84c',
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  logButtonText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  resultCard: {
    backgroundColor: '#0d1f0d',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF5044',
  },
  resultTitle: { color: '#4CAF50', fontSize: 10, letterSpacing: 3, marginBottom: 8 },
  resultMessage: { color: '#fff', fontSize: 15, lineHeight: 22 },
  progressNote: { color: '#c9a84c', fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  restRecommendation: { color: '#666', fontSize: 12, marginTop: 8 },
  loggedSets: { marginTop: 8 },
  loggedTitle: { color: '#666', fontSize: 10, letterSpacing: 3, marginBottom: 12 },
  loggedSet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  loggedExercise: { color: '#fff', fontSize: 14 },
  loggedDetails: { color: '#c9a84c', fontSize: 14, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#0a0a0a' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  modalClose: { color: '#c9a84c', fontSize: 12, letterSpacing: 1 },
  muscleFilter: { paddingHorizontal: 16, paddingVertical: 16, maxHeight: 60 },
  muscleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  muscleChipActive: { backgroundColor: '#c9a84c', borderColor: '#c9a84c' },
  muscleChipText: { color: '#666', fontSize: 12 },
  muscleChipTextActive: { color: '#000', fontWeight: '700' },
  exerciseOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  exerciseOptionName: { color: '#fff', fontSize: 16, marginBottom: 4 },
  exerciseOptionDetail: { color: '#666', fontSize: 12 },
  exerciseArrow: { color: '#c9a84c', fontSize: 18 },
});
