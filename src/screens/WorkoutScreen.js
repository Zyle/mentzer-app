import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { scheduleRecoveryNotifications } from '../lib/notifications';
import { EXERCISES, MUSCLES } from '../data/exercises';
import { analyzeSet } from '../lib/progression';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

export default function WorkoutScreen({ navigation }) {
  // Core
  const [phase, setPhase]         = useState('picking'); // 'picking' | 'active'
  const [templates, setTemplates] = useState([]);
  const [userId, setUserId]       = useState(null);

  // Active workout
  const [workoutId, setWorkoutId]           = useState(null);
  const [routine, setRoutine]               = useState([]);
  const [setData, setSetData]               = useState({});
  const [prevBests, setPrevBests]           = useState({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restTimer, setRestTimer]           = useState({ active: false, elapsed: 0 });

  const [weightIncrement, setWeightIncrement] = useState(2.5);

  // Modals
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [selectedMuscle, setSelectedMuscle]         = useState('Chest');
  const [saveModal, setSaveModal]   = useState(false);
  const [templateName, setTemplateName] = useState('');

  const workoutTimerRef = useRef(null);
  const restTimerRef    = useRef(null);

  useEffect(() => {
    initUser();
    return () => {
      clearInterval(workoutTimerRef.current);
      clearInterval(restTimerRef.current);
    };
  }, []);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  const initUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user.id);

      const { data } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setTemplates(data || []);

      const savedIncrement = await AsyncStorage.getItem('weightIncrement');
      if (savedIncrement) setWeightIncrement(parseFloat(savedIncrement));
    } catch (e) {
      console.error('initUser error:', e);
    }
  };

  // ── Load prev bests for a list of exercises ───────────────────────────────────
  const loadPrevBests = async (exercises, uid) => {
    const id = uid || userId;
    if (!id || !exercises.length) return;

    const names = exercises.map(e => e.name);
    const { data: pbs } = await supabase
      .from('personal_bests').select('*')
      .eq('user_id', id).in('exercise_name', names);

    const pbMap = {};
    (pbs || []).forEach(pb => { pbMap[pb.exercise_name] = pb; });
    setPrevBests(pbMap);

    const initialData = {};
    exercises.forEach(ex => {
      const pb = pbMap[ex.name];
      initialData[ex.name] = {
        weight: pb ? String(pb.weight_kg) : '',
        reps:   pb ? String(pb.reps) : '',
        logged: false, result: null, isPR: false,
      };
    });
    setSetData(initialData);
  };

  // ── Start from template ───────────────────────────────────────────────────────
  const startFromTemplate = async (template) => {
    const matched = template.exercises
      .map(name => EXERCISES.find(e => e.name === name))
      .filter(Boolean);

    setRoutine(matched);
    await loadPrevBests(matched, userId);
    startWorkoutTimer();
    setPhase('active');
  };

  // ── Start fresh ───────────────────────────────────────────────────────────────
  const startFresh = () => {
    setRoutine([]);
    setSetData({});
    setPrevBests({});
    setWorkoutId(null);
    startWorkoutTimer();
    setPhase('active');
  };

  const startWorkoutTimer = () => {
    setElapsedSeconds(0);
    clearInterval(workoutTimerRef.current);
    workoutTimerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
  };

  // ── Cancel active workout → back to picker ────────────────────────────────────
  const cancelWorkout = () => {
    const hasLogged = Object.values(setData).some(d => d.logged);
    const doCancel = () => {
      clearInterval(workoutTimerRef.current);
      clearInterval(restTimerRef.current);
      setPhase('picking');
      setWorkoutId(null);
      setRoutine([]);
      setSetData({});
      setPrevBests({});
      setElapsedSeconds(0);
      setRestTimer({ active: false, elapsed: 0 });
    };

    if (hasLogged) {
      Alert.alert('Cancel Workout', 'You have logged sets this session. Cancel anyway?', [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Cancel Workout', style: 'destructive', onPress: doCancel },
      ]);
    } else {
      doCancel();
    }
  };

  // ── Ensure workout row ────────────────────────────────────────────────────────
  const ensureWorkout = async (uid) => {
    if (workoutId) return workoutId;
    const { data: workout, error } = await supabase
      .from('workouts').insert({ user_id: uid }).select().single();
    if (error) console.error('ensureWorkout error:', error);
    if (workout) { setWorkoutId(workout.id); return workout.id; }
    return null;
  };

  // ── Weight / reps controls ────────────────────────────────────────────────────
  const adjustWeight = (name, delta) => {
    setSetData(prev => {
      const cur = parseFloat(prev[name]?.weight) || 0;
      const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
      return { ...prev, [name]: { ...prev[name], weight: String(next) } };
    });
  };

  const adjustReps = (name, delta) => {
    setSetData(prev => {
      const cur = parseInt(prev[name]?.reps) || 0;
      const next = Math.max(1, cur + delta);
      return { ...prev, [name]: { ...prev[name], reps: String(next) } };
    });
  };

  const updateField = (name, field, value) => {
    setSetData(prev => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };

  // ── Rest timer ────────────────────────────────────────────────────────────────
  const startRestTimer = () => {
    clearInterval(restTimerRef.current);
    setRestTimer({ active: true, elapsed: 0 });
    restTimerRef.current = setInterval(() => {
      setRestTimer(prev => ({ ...prev, elapsed: prev.elapsed + 1 }));
    }, 1000);
  };

  const dismissRestTimer = () => {
    clearInterval(restTimerRef.current);
    setRestTimer({ active: false, elapsed: 0 });
  };

  // ── Log a set ─────────────────────────────────────────────────────────────────
  const logSet = async (exercise) => {
    const data = setData[exercise.name] || {};
    const weightNum = parseFloat(data.weight);
    const repsNum   = parseInt(data.reps);

    if (!weightNum || !repsNum || isNaN(weightNum) || isNaN(repsNum)) {
      Alert.alert('Missing info', 'Enter weight and reps before logging.');
      return;
    }

    const pb       = prevBests[exercise.name] || null;
    const analysis = analyzeSet(exercise, weightNum, repsNum, pb);
    const wid      = await ensureWorkout(userId);

    await supabase.from('sets').insert({
      user_id: userId, workout_id: wid,
      exercise_name: exercise.name, weight_kg: weightNum, reps: repsNum,
    });

    const isPR = !pb || weightNum > pb.weight_kg || repsNum > pb.reps;
    if (isPR) {
      await supabase.from('personal_bests').upsert({
        user_id: userId, exercise_name: exercise.name,
        weight_kg: weightNum, reps: repsNum,
      }, { onConflict: 'user_id,exercise_name' });
      setPrevBests(prev => ({ ...prev, [exercise.name]: { weight_kg: weightNum, reps: repsNum } }));
    }

    setSetData(prev => ({
      ...prev,
      [exercise.name]: { ...prev[exercise.name], logged: true, result: analysis, isPR },
    }));
    startRestTimer();
  };

  // ── Add exercise mid-workout ──────────────────────────────────────────────────
  const addExercise = async (exercise) => {
    setShowExercisePicker(false);
    if (routine.find(e => e.name === exercise.name)) return;

    setRoutine(prev => [...prev, exercise]);

    let pb = prevBests[exercise.name];
    if (!pb && userId) {
      const { data } = await supabase
        .from('personal_bests').select('*')
        .eq('user_id', userId).eq('exercise_name', exercise.name).single();
      if (data) { setPrevBests(prev => ({ ...prev, [exercise.name]: data })); pb = data; }
    }

    setSetData(prev => ({
      ...prev,
      [exercise.name]: {
        weight: pb ? String(pb.weight_kg) : '',
        reps:   pb ? String(pb.reps) : '',
        logged: false, result: null, isPR: false,
      },
    }));
  };

  // ── Delete template ───────────────────────────────────────────────────────────
  const deleteTemplate = (template) => {
    Alert.alert('Delete Template', `Delete "${template.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('workout_templates').delete().eq('id', template.id);
          setTemplates(prev => prev.filter(t => t.id !== template.id));
        },
      },
    ]);
  };

  // ── Finish workout ────────────────────────────────────────────────────────────
  const doFinish = async () => {
    setSaveModal(false);
    clearInterval(workoutTimerRef.current);
    clearInterval(restTimerRef.current);
    await scheduleRecoveryNotifications();
    navigation.navigate('Main');
  };

  const saveAndFinish = async () => {
    if (!templateName.trim() || !userId) return;
    const { data: saved } = await supabase
      .from('workout_templates')
      .insert({ user_id: userId, name: templateName.trim(), exercises: routine.map(e => e.name) })
      .select().single();
    if (saved) setTemplates(prev => [saved, ...prev]);
    setTemplateName('');
    doFinish();
  };

  const finishWorkout = () => {
    const hasLogged = Object.values(setData).some(d => d.logged);
    if (hasLogged) {
      Alert.alert('Finish Workout', 'Great work. Growth begins during rest.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save & Finish', onPress: () => setSaveModal(true) },
        { text: 'Just Finish', style: 'destructive', onPress: doFinish },
      ]);
    } else {
      Alert.alert('End Workout', 'No sets logged. End this session?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End', onPress: doFinish },
      ]);
    }
  };

  const routineNames        = new Set(routine.map(e => e.name));
  const filteredExercises   = EXERCISES.filter(e => e.muscle === selectedMuscle);

  // ── PICKING PHASE ─────────────────────────────────────────────────────────────
  if (phase === 'picking') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← BACK</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>START WORKOUT</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>

          {templates.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>SAVED WORKOUTS</Text>
              {templates.map(template => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => startFromTemplate(template)}
                  activeOpacity={0.8}
                >
                  <View style={styles.templateCardMain}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateExercises} numberOfLines={1}>
                      {template.exercises.join(' · ')}
                    </Text>
                    <Text style={styles.templateCount}>
                      {template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.templateCardRight}>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteTemplate(template)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <View style={styles.sectionDivider} />
            </>
          ) : (
            <View style={styles.noTemplatesHint}>
              <Text style={styles.noTemplatesText}>
                No saved workouts yet.{'\n'}Finish a workout and save it to reuse it here.
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.freshCard} onPress={startFresh} activeOpacity={0.8}>
            <Text style={styles.freshIcon}>＋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.freshTitle}>Start Fresh</Text>
              <Text style={styles.freshSubtitle}>Build your workout as you go</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    );
  }

  // ── ACTIVE PHASE ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={cancelWorkout}>
          <Text style={styles.backButton}>← BACK</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>WORKOUT</Text>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={finishWorkout}>
          <Text style={styles.finishButton}>FINISH</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {routine.length === 0 ? (
          <TouchableOpacity style={styles.emptyCard} onPress={() => setShowExercisePicker(true)} activeOpacity={0.8}>
            <Text style={styles.emptyIcon}>＋</Text>
            <Text style={styles.emptyTitle}>ADD EXERCISE</Text>
            <Text style={styles.emptySubtitle}>Tap to select from your exercise library</Text>
          </TouchableOpacity>
        ) : (
          <>
            {routine.map((exercise) => {
              const data  = setData[exercise.name] || {};
              const pb    = prevBests[exercise.name];
              const ready = !!(data.weight && data.reps);

              if (data.logged) {
                return (
                  <View key={exercise.name} style={styles.cardDone}>
                    <View style={styles.doneHeader}>
                      <View style={styles.doneLeft}>
                        <View style={styles.doneCheck}>
                          <Text style={styles.doneCheckText}>✓</Text>
                        </View>
                        <Text style={styles.doneName}>{exercise.name}</Text>
                      </View>
                      {data.isPR && (
                        <View style={styles.prBadge}>
                          <Text style={styles.prBadgeText}>🏆 PR</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.doneStats}>{data.weight}kg × {data.reps} reps</Text>
                    {data.result && (
                      <View style={styles.doneResult}>
                        <Text style={styles.doneResultNext}>
                          Next: {data.result.nextWeight}kg · {data.result.restDays}+ days rest
                        </Text>
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <View key={exercise.name} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {exercise.muscle}  ·  {exercise.repRange[0]}–{exercise.repRange[1]} reps
                      </Text>
                    </View>
                    {exercise.hd2Core && (
                      <View style={styles.hd2Badge}>
                        <Text style={styles.hd2BadgeText}>HD2</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.prevRow}>
                    <Text style={styles.prevLabel}>PREV BEST</Text>
                    <Text style={styles.prevValue}>
                      {pb ? `${pb.weight_kg}kg × ${pb.reps} reps` : 'First time'}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.setRow}>
                    <View style={[styles.inputGroup, { flex: 3 }]}>
                      <Text style={styles.inputGroupLabel}>WEIGHT</Text>
                      <View style={styles.inputControls}>
                        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustWeight(exercise.name, -weightIncrement)}>
                          <Text style={styles.adjBtnText}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={styles.numberInput}
                          value={data.weight}
                          onChangeText={v => updateField(exercise.name, 'weight', v)}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={COLORS.textFaint}
                        />
                        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustWeight(exercise.name, weightIncrement)}>
                          <Text style={styles.adjBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.inputUnit}>kg</Text>
                    </View>

                    <View style={[styles.inputGroup, { flex: 2 }]}>
                      <Text style={styles.inputGroupLabel}>REPS</Text>
                      <View style={styles.inputControls}>
                        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustReps(exercise.name, -1)}>
                          <Text style={styles.adjBtnText}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={styles.numberInput}
                          value={data.reps}
                          onChangeText={v => updateField(exercise.name, 'reps', v)}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={COLORS.textFaint}
                        />
                        <TouchableOpacity style={styles.adjBtn} onPress={() => adjustReps(exercise.name, 1)}>
                          <Text style={styles.adjBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.inputUnit}>reps</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.completeBtn, ready && styles.completeBtnReady]}
                      onPress={() => logSet(exercise)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.completeBtnText, ready && styles.completeBtnTextReady]}>✓</Text>
                    </TouchableOpacity>
                  </View>

                  {exercise.mentzerNote && (
                    <Text style={styles.mentzerNote}>"{exercise.mentzerNote}"</Text>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={styles.addBtn} onPress={() => setShowExercisePicker(true)} activeOpacity={0.7}>
              <Text style={styles.addBtnText}>+ ADD EXERCISE</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Rest Timer */}
      {restTimer.active && (
        <View style={styles.restBar}>
          <View style={styles.restBarLeft}>
            <View style={styles.restDot} />
            <View>
              <Text style={styles.restBarLabel}>RESTING</Text>
              <Text style={styles.restBarTime}>{formatTime(restTimer.elapsed)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.restBarBtn} onPress={dismissRestTimer} activeOpacity={0.8}>
            <Text style={styles.restBarBtnText}>DONE RESTING</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Save Template Modal */}
      <Modal visible={saveModal} transparent animationType="fade">
        <View style={styles.saveOverlay}>
          <View style={styles.saveCard}>
            <Text style={styles.saveTitle}>SAVE WORKOUT</Text>
            <Text style={styles.saveSubtitle}>Name it to reuse next time</Text>
            <TextInput
              style={styles.saveInput}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="e.g. Push Day, Leg Day..."
              placeholderTextColor={COLORS.textFaint}
              autoFocus
              returnKeyType="done"
            />
            <Text style={styles.saveExerciseList} numberOfLines={2}>
              {routine.map(e => e.name).join(' · ')}
            </Text>
            <View style={styles.saveButtons}>
              <TouchableOpacity style={styles.skipBtn} onPress={doFinish}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !templateName.trim() && { opacity: 0.4 }]}
                onPress={saveAndFinish}
                disabled={!templateName.trim()}
              >
                <Text style={styles.saveBtnText}>SAVE & FINISH</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Exercise Picker Modal */}
      <Modal visible={showExercisePicker} animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ADD EXERCISE</Text>
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
            {filteredExercises.map(exercise => {
              const alreadyAdded = routineNames.has(exercise.name);
              return (
                <TouchableOpacity
                  key={exercise.name}
                  style={[styles.exerciseOption, alreadyAdded && styles.exerciseOptionAdded]}
                  onPress={() => !alreadyAdded && addExercise(exercise)}
                  activeOpacity={alreadyAdded ? 1 : 0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.exerciseOptionHeader}>
                      <Text style={[styles.exerciseOptionName, alreadyAdded && styles.exerciseOptionNameAdded]}>
                        {exercise.name}
                      </Text>
                      {exercise.hd2Core && (
                        <View style={styles.hd2Badge}><Text style={styles.hd2BadgeText}>HD2</Text></View>
                      )}
                      {alreadyAdded && <Text style={styles.addedTag}>✓ Added</Text>}
                    </View>
                    <Text style={styles.exerciseOptionDetail}>
                      {exercise.type === 'compound' ? 'Compound' : 'Isolation'} · {exercise.repRange[0]}–{exercise.repRange[1]} reps
                    </Text>
                  </View>
                  {!alreadyAdded && <Text style={styles.chevron}>›</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: SPACING.screen, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.surface,
  },
  backButton:   { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.medium, letterSpacing: 1 },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { color: COLORS.white, fontSize: 14, fontWeight: FONT.black, letterSpacing: 3 },
  timerBadge: {
    marginTop: 4, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border,
  },
  timerText:    { color: COLORS.gold, fontSize: 12, fontWeight: FONT.semibold, letterSpacing: 1 },
  finishButton: { color: COLORS.gold, fontSize: 13, fontWeight: FONT.bold, letterSpacing: 1 },

  content: { flex: 1, padding: SPACING.screen },

  // ── Picking phase ─────────────────────────────────────────────────────────────
  sectionLabel: {
    color: COLORS.textDim, fontSize: 10, fontWeight: FONT.semibold,
    letterSpacing: 2.5, marginBottom: 12, marginTop: 8,
  },
  templateCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: 10,
  },
  templateCardMain:  { flex: 1 },
  templateCardRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 },
  templateName:      { color: COLORS.white, fontSize: 17, fontWeight: FONT.bold, marginBottom: 4 },
  templateExercises: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  templateCount:     { color: COLORS.textDim, fontSize: 10, letterSpacing: 1 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.surfaceDark, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText:  { color: COLORS.textMuted, fontSize: 12 },
  sectionDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  noTemplatesHint: {
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
    borderRadius: RADIUS.lg, padding: 20, marginBottom: 20, alignItems: 'center',
  },
  noTemplatesText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  freshCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    borderWidth: 1.5, borderColor: COLORS.border, padding: SPACING.md,
  },
  freshIcon:    { color: COLORS.gold, fontSize: 24 },
  freshTitle:   { color: COLORS.white, fontSize: 16, fontWeight: FONT.bold, marginBottom: 2 },
  freshSubtitle:{ color: COLORS.textMuted, fontSize: 12 },

  // ── Active phase ──────────────────────────────────────────────────────────────
  emptyCard: {
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    borderRadius: RADIUS.xl, padding: 40, alignItems: 'center', marginTop: 20,
  },
  emptyIcon:     { color: COLORS.textDim, fontSize: 28, marginBottom: 12 },
  emptyTitle:    { color: COLORS.white, fontSize: 16, fontWeight: FONT.bold, letterSpacing: 2, marginBottom: 8 },
  emptySubtitle: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: 14,
  },
  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  cardHeaderLeft: { flex: 1 },
  exerciseName:   { color: COLORS.white, fontSize: 18, fontWeight: FONT.bold, marginBottom: 4 },
  exerciseMeta:   { color: COLORS.textMuted, fontSize: 12, letterSpacing: 0.5 },

  hd2Badge:     { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.sm, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.goldBorder, marginLeft: 8 },
  hd2BadgeText: { color: COLORS.gold, fontSize: 9, fontWeight: FONT.black, letterSpacing: 1 },

  prevRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  prevLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: FONT.semibold, letterSpacing: 2 },
  prevValue: { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.medium },
  divider:   { height: 1, backgroundColor: COLORS.border, marginBottom: 14 },

  setRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },

  inputGroup:      { alignItems: 'center' },
  inputGroupLabel: { color: COLORS.textDim, fontSize: 9, fontWeight: FONT.semibold, letterSpacing: 2, marginBottom: 6 },
  inputControls:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  inputUnit:       { color: COLORS.textDim, fontSize: 10, letterSpacing: 1, marginTop: 4 },

  adjBtn: {
    width: 26, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceDark, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  adjBtnText: { color: COLORS.white, fontSize: 18, fontWeight: FONT.medium },

  numberInput: {
    flex: 1, backgroundColor: COLORS.surfaceDark, color: COLORS.white,
    fontSize: 20, fontWeight: FONT.black, textAlign: 'center',
    paddingVertical: 6, paddingHorizontal: 2,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },

  completeBtn: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  completeBtnReady:     { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  completeBtnText:      { color: COLORS.textDim, fontSize: 20, fontWeight: FONT.bold },
  completeBtnTextReady: { color: '#000' },

  mentzerNote: {
    color: COLORS.textDim, fontSize: 11, fontStyle: 'italic',
    lineHeight: 16, marginTop: 14, borderTopWidth: 1,
    borderTopColor: COLORS.border, paddingTop: 12,
  },

  cardDone: {
    backgroundColor: '#0d120d', borderRadius: RADIUS.xl,
    borderWidth: 1.5, borderColor: '#2a402a',
    padding: SPACING.md, marginBottom: 14,
  },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  doneLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneCheck: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center',
  },
  doneCheckText:  { color: '#000', fontSize: 13, fontWeight: FONT.black },
  doneName:       { color: COLORS.white, fontSize: 16, fontWeight: FONT.bold },
  doneStats:      { color: COLORS.green, fontSize: 22, fontWeight: FONT.black, marginBottom: 6, marginLeft: 36 },
  doneResult:     { marginLeft: 36 },
  doneResultNext: { color: COLORS.textMuted, fontSize: 12 },

  prBadge:     { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.goldBorder },
  prBadgeText: { color: COLORS.gold, fontSize: 12, fontWeight: FONT.semibold },

  addBtn:     { alignSelf: 'center', marginTop: 4, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 24, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  addBtnText: { color: COLORS.textMuted, fontSize: 12, fontWeight: FONT.semibold, letterSpacing: 2 },

  // ── Rest timer ────────────────────────────────────────────────────────────────
  restBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#141208', borderTopWidth: 1.5, borderTopColor: COLORS.goldBorder,
    paddingHorizontal: SPACING.screen, paddingTop: 14, paddingBottom: 28,
  },
  restBarLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  restBarLabel:   { color: COLORS.gold, fontSize: 10, fontWeight: FONT.black, letterSpacing: 2, marginBottom: 2 },
  restBarTime:    { color: COLORS.white, fontSize: 22, fontWeight: FONT.black },
  restBarBtn:     { backgroundColor: COLORS.gold, borderRadius: RADIUS.lg, paddingHorizontal: 18, paddingVertical: 10 },
  restBarBtnText: { color: '#000', fontSize: 12, fontWeight: FONT.black, letterSpacing: 1.5 },

  // ── Save template modal ───────────────────────────────────────────────────────
  saveOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.screen,
  },
  saveCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, width: '100%',
  },
  saveTitle:        { color: COLORS.white, fontSize: 15, fontWeight: FONT.black, letterSpacing: 2, marginBottom: 6 },
  saveSubtitle:     { color: COLORS.textMuted, fontSize: 13, marginBottom: 18 },
  saveInput: {
    backgroundColor: COLORS.surfaceDark, color: COLORS.white,
    fontSize: 17, fontWeight: FONT.medium, padding: 14,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10,
  },
  saveExerciseList: { color: COLORS.textDim, fontSize: 11, lineHeight: 16, marginBottom: 20 },
  saveButtons:      { flexDirection: 'row', gap: 12 },
  skipBtn:          { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  skipBtnText:      { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.medium },
  saveBtn:          { flex: 2, backgroundColor: COLORS.gold, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center' },
  saveBtnText:      { color: '#000', fontSize: 13, fontWeight: FONT.black, letterSpacing: 1 },

  // ── Exercise picker modal ─────────────────────────────────────────────────────
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: SPACING.screen, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.surface,
  },
  modalTitle: { color: COLORS.white, fontSize: 16, fontWeight: FONT.black, letterSpacing: 3 },
  modalClose: { color: COLORS.gold, fontSize: 13, fontWeight: FONT.semibold, letterSpacing: 1 },

  muscleFilter:         { paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md, maxHeight: 64 },
  muscleChip:           { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  muscleChipActive:     { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  muscleChipText:       { color: '#999', fontSize: 12, fontWeight: FONT.medium },
  muscleChipTextActive: { color: '#000', fontWeight: FONT.bold },

  exerciseOption:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.surface },
  exerciseOptionAdded:     { opacity: 0.45 },
  exerciseOptionHeader:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  exerciseOptionName:      { color: COLORS.white, fontSize: 16, fontWeight: FONT.medium },
  exerciseOptionNameAdded: { color: COLORS.textMuted },
  exerciseOptionDetail:    { color: '#888', fontSize: 12 },
  addedTag:                { color: COLORS.green, fontSize: 11, fontWeight: FONT.medium },
  chevron:                 { color: COLORS.textMuted, fontSize: 24 },
});
