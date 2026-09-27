import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, TextInput, Alert, Modal, Animated, Easing, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { IconBadge, Tag, muscleIcon } from '../components/Badges';
import { FadeInUp, PressableScale, useLoop, useReduceMotion, haptic } from '../lib/motion';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { scheduleRecoveryNotificationsIfEnabled } from '../lib/notifications';
import { EXERCISES, MUSCLES, findExercise, canonicalName } from '../data/exercises';
import { analyzeSet, getNextTarget, isPersonalBest, setsByExercise, bestOf } from '../lib/progression';
import { loadProgramme, pickNextSession, PROGRAMME_LABELS } from '../lib/programme';
import { COLORS, GRADIENTS, FONT, TYPE, RADIUS, SPACING, HIT } from '../theme';

// Accept "82,5" as well as "82.5" (European keyboards)
const parseWeight = (v) => parseFloat(String(v ?? '').replace(',', '.'));

const formatShortDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

export default function WorkoutScreen({ navigation }) {
  // Core
  const [phase, setPhase]         = useState('picking'); // 'picking' | 'active'
  const [templates, setTemplates] = useState([]);
  const [userId, setUserId]       = useState(null);

  // Programme
  const [programme, setProgramme]     = useState({ sessions: [], routineType: null });
  const [nextSessionKey, setNextSessionKey] = useState(null);
  const [history, setHistory]         = useState({}); // exercise name → sets, newest first
  const [sessionLabel, setSessionLabel] = useState(null);

  // Active workout
  const [workoutId, setWorkoutId]           = useState(null);
  const [routine, setRoutine]               = useState([]);
  const [setData, setSetData]               = useState({});
  const [prevBests, setPrevBests]           = useState({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restTimer, setRestTimer]           = useState({ active: false, elapsed: 0 });
  const [supersetCue, setSupersetCue]       = useState(null);

  const [weightIncrement, setWeightIncrement] = useState(2.5);
  const workoutIdRef = useRef(null);
  const loggingRef   = useRef(new Set());

  // Modals
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [selectedMuscle, setSelectedMuscle]         = useState('Chest');
  const [saveModal, setSaveModal]   = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [pickerQuery, setPickerQuery]   = useState('');

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

      // Programme + recent history drive "next up" and per-exercise targets
      const [prog, { data: recentSets }] = await Promise.all([
        loadProgramme(user.id),
        supabase.from('sets')
          .select('exercise_name, weight_kg, reps, date, workout_id')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(1000),
      ]);
      const byExercise = setsByExercise(recentSets || [], canonicalName);
      setHistory(byExercise);
      setProgramme(prog);

      const lastWorkoutId = recentSets?.[0]?.workout_id;
      const lastNames = (recentSets || []).filter(s => s.workout_id === lastWorkoutId).map(s => s.exercise_name);
      setNextSessionKey(pickNextSession(prog.sessions, lastWorkoutId ? lastNames : [])?.key ?? null);
    } catch (e) {
      console.error('initUser error:', e);
    }
  };

  // Target for next set: from the most recent logged set, not the all-time best.
  const targetFor = (exercise) => {
    const sets = history[exercise.name] || [];
    return getNextTarget(exercise, sets[0], sets[1], weightIncrement);
  };

  const initialEntry = (exercise) => {
    const target = targetFor(exercise);
    return {
      weight: target ? String(target.weight) : '',
      reps:   target ? String(target.repGoal) : '',
      logged: false, result: null, isPR: false, setId: null,
    };
  };

  // ── Load personal bests + prefill targets for a list of exercises ────────────
  const loadPrevBests = async (exercises, uid) => {
    const id = uid || userId;
    const initialData = {};
    exercises.forEach(ex => { initialData[ex.name] = initialEntry(ex); });
    setSetData(initialData);
    if (!id || !exercises.length) return;

    const names = exercises.map(e => e.name);
    const { data: pbs } = await supabase
      .from('personal_bests').select('*')
      .eq('user_id', id).in('exercise_name', names);

    const pbMap = {};
    (pbs || []).forEach(pb => { pbMap[pb.exercise_name] = pb; });
    setPrevBests(pbMap);
  };

  const resetSession = () => {
    workoutIdRef.current = null;
    setWorkoutId(null);
    setSupersetCue(null);
  };

  // ── Start the programme's session ─────────────────────────────────────────────
  const startSession = async (session) => {
    resetSession();
    setSessionLabel(session.label);
    setRoutine(session.exercises);
    await loadPrevBests(session.exercises, userId);
    startWorkoutTimer();
    setPhase('active');
  };

  // ── Start from template ───────────────────────────────────────────────────────
  const startFromTemplate = async (template) => {
    const matched = (template.exercises || []).map(findExercise).filter(Boolean);
    resetSession();
    setSessionLabel(template.name);
    setRoutine(matched);
    await loadPrevBests(matched, userId);
    startWorkoutTimer();
    setPhase('active');
  };

  // ── Start fresh ───────────────────────────────────────────────────────────────
  const startFresh = () => {
    resetSession();
    setSessionLabel(null);
    setRoutine([]);
    setSetData({});
    setPrevBests({});
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
      discardEmptyWorkout();
      clearInterval(workoutTimerRef.current);
      clearInterval(restTimerRef.current);
      setPhase('picking');
      resetSession();
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
  // Shares one in-flight insert so two quick logs can't create two workout rows.
  const ensureWorkout = (uid) => {
    if (!workoutIdRef.current) {
      workoutIdRef.current = (async () => {
        const { data: workout, error } = await supabase
          .from('workouts').insert({ user_id: uid }).select().single();
        if (error || !workout) {
          console.error('ensureWorkout error:', error);
          workoutIdRef.current = null; // allow a retry
          return null;
        }
        setWorkoutId(workout.id);
        return workout.id;
      })();
    }
    return workoutIdRef.current;
  };

  // ── Weight / reps controls ────────────────────────────────────────────────────
  const adjustWeight = (name, delta) => {
    setSetData(prev => {
      const cur = parseWeight(prev[name]?.weight) || 0;
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
  // One set per exercise, to failure (HD2). Logging locks the exercise.
  const logSet = async (exercise) => {
    if (loggingRef.current.has(exercise.name)) return;
    const data = setData[exercise.name] || {};
    const weightNum = parseWeight(data.weight);
    const repsNum   = parseInt(data.reps, 10);

    if (isNaN(weightNum) || weightNum < 0 || !repsNum || isNaN(repsNum)) {
      Alert.alert('Missing info', 'Enter weight and reps before logging.');
      return;
    }

    loggingRef.current.add(exercise.name);
    try {
      const pb       = prevBests[exercise.name] || null;
      const lastSet  = (history[exercise.name] || [])[0] || null;
      const analysis = analyzeSet(exercise, weightNum, repsNum, lastSet, weightIncrement);

      let setId = null;
      if (userId) {
        const wid = await ensureWorkout(userId);
        if (!wid) throw new Error('Could not start workout');
        const { data: inserted, error } = await supabase.from('sets').insert({
          user_id: userId, workout_id: wid,
          exercise_name: exercise.name, weight_kg: weightNum, reps: repsNum,
        }).select('id').single();
        if (error) throw error;
        setId = inserted?.id ?? null;
      }

      const isPR = isPersonalBest(pb, weightNum, repsNum);
      if (isPR && userId) {
        const { error: pbError } = await supabase.from('personal_bests').upsert({
          user_id: userId, exercise_name: exercise.name,
          weight_kg: weightNum, reps: repsNum,
        }, { onConflict: 'user_id,exercise_name' });
        if (pbError) console.error('personal_bests upsert error:', pbError);
      }
      if (isPR) {
        setPrevBests(prev => ({ ...prev, [exercise.name]: { weight_kg: weightNum, reps: repsNum } }));
      }

      setSetData(prev => ({
        ...prev,
        [exercise.name]: {
          ...prev[exercise.name],
          weight: String(weightNum), reps: String(repsNum),
          logged: true, result: analysis, isPR, prevPB: pb, setId,
        },
      }));

      // Pre-exhaust → go straight into the compound: no rest (HD2 superset rule)
      const partner = exercise.supersetWith && routine.find(e => e.name === exercise.supersetWith);
      if (partner && !setData[partner.name]?.logged) {
        dismissRestTimer();
        setSupersetCue(partner.name);
      } else {
        setSupersetCue(null);
        startRestTimer();
      }
    } catch (e) {
      console.error('logSet error:', e);
      Alert.alert('Set not saved', 'Could not save this set. Check your connection and try again.');
    } finally {
      loggingRef.current.delete(exercise.name);
    }
  };

  // ── Undo a logged set (mis-typed weight or reps) ──────────────────────────────
  const undoSet = (exercise) => {
    const data = setData[exercise.name] || {};
    const doUndo = async () => {
      try {
        if (userId && data.setId) {
          const { error } = await supabase.from('sets').delete().eq('id', data.setId);
          if (error) throw error;
          // Restore the personal best from what remains in the log
          if (data.isPR) {
            const { data: remaining } = await supabase
              .from('sets').select('weight_kg, reps, date')
              .eq('user_id', userId).eq('exercise_name', exercise.name);
            const best = bestOf(remaining || []);
            if (best) {
              await supabase.from('personal_bests').upsert({
                user_id: userId, exercise_name: exercise.name,
                weight_kg: best.weight_kg, reps: best.reps,
              }, { onConflict: 'user_id,exercise_name' });
            } else {
              await supabase.from('personal_bests').delete()
                .eq('user_id', userId).eq('exercise_name', exercise.name);
            }
          }
        }
        if (data.isPR) {
          setPrevBests(prev => {
            const next = { ...prev };
            if (data.prevPB) next[exercise.name] = data.prevPB; else delete next[exercise.name];
            return next;
          });
        }
        setSetData(prev => ({
          ...prev,
          [exercise.name]: { ...prev[exercise.name], logged: false, result: null, isPR: false, setId: null, prevPB: null },
        }));
        setSupersetCue(null);
      } catch (e) {
        console.error('undoSet error:', e);
        Alert.alert('Could not undo', 'Check your connection and try again.');
      }
    };
    Alert.alert('Edit Set', `Remove the logged ${exercise.name} set so you can correct it?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: doUndo },
    ]);
  };

  // ── Add exercise mid-workout ──────────────────────────────────────────────────
  const addExercise = async (exercise) => {
    setShowExercisePicker(false);
    if (routine.find(e => e.name === exercise.name)) return;

    setRoutine(prev => [...prev, exercise]);
    setSetData(prev => ({ ...prev, [exercise.name]: initialEntry(exercise) }));

    if (!prevBests[exercise.name] && userId) {
      const { data } = await supabase
        .from('personal_bests').select('*')
        .eq('user_id', userId).eq('exercise_name', exercise.name).maybeSingle();
      if (data) setPrevBests(prev => ({ ...prev, [exercise.name]: data }));
    }
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
  // A workout row with no sets (e.g. every set was edited away) would reset the
  // recovery clock and drag down the HD score, so remove it.
  const discardEmptyWorkout = async () => {
    const hasLogged = Object.values(setData).some(d => d.logged);
    const pending = workoutIdRef.current;
    if (hasLogged || !pending) return;
    try {
      const wid = await pending;
      if (wid) await supabase.from('workouts').delete().eq('id', wid);
    } catch (e) {
      console.error('discardEmptyWorkout error:', e);
    }
  };

  const doFinish = async () => {
    setSaveModal(false);
    clearInterval(workoutTimerRef.current);
    clearInterval(restTimerRef.current);
    const hasLogged = Object.values(setData).some(d => d.logged);
    if (hasLogged) {
      try { await scheduleRecoveryNotificationsIfEnabled(); } catch (_) {}
    } else {
      await discardEmptyWorkout();
    }
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
    const nextSession = programme.sessions.find(ss => ss.key === nextSessionKey) || programme.sessions[0];
    const otherSessions = programme.sessions.filter(ss => ss !== nextSession);
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Start workout"
          subtitle={programme.routineType ? PROGRAMME_LABELS[programme.routineType] : 'One set per exercise, to failure'}
          onBack={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={styles.pickContent} showsVerticalScrollIndicator={false}>

          {nextSession && (
            <FadeInUp index={0}>
              <PressableScale
                onPress={() => startSession(nextSession)}
                scaleTo={0.985}
                style={styles.nextCard}
                accessibilityRole="button"
                accessibilityLabel={`Start ${nextSession.label}${programme.sessions.length > 1 ? ', next up' : ''}`}
              >
                <LinearGradient colors={GRADIENTS.heroGlow} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={styles.nextChip}>
                  <MaterialCommunityIcons name="lightning-bolt" size={13} color={COLORS.gold} />
                  <Text style={styles.nextChipText}>{programme.sessions.length > 1 ? 'NEXT UP' : 'YOUR SESSION'}</Text>
                </View>
                <Text style={styles.nextTitle}>{nextSession.label}</Text>
                <Text style={styles.nextMeta}>
                  {nextSession.exercises.length} exercise{nextSession.exercises.length !== 1 ? 's' : ''} · 1 set each to failure
                </Text>
                <View style={styles.nextList}>
                  {nextSession.exercises.map((ex, i) => (
                    <View key={ex.name} style={styles.nextRow}>
                      <IconBadge gym={muscleIcon(ex.muscle)} size={34} />
                      <Text style={styles.nextRowName} numberOfLines={1}>{ex.name}</Text>
                      {ex.supersetWith ? <Tag label="Superset" color={COLORS.gold} /> : <Tag label={ex.muscle} />}
                    </View>
                  ))}
                </View>
                <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Button title="Start session" icon="zap" shimmer onPress={() => {}} style={{ marginTop: SPACING.lg }} />
                </View>
              </PressableScale>
            </FadeInUp>
          )}

          {otherSessions.length > 0 && <Text style={styles.sectionLabel}>Other sessions</Text>}
          {otherSessions.map((session, i) => (
            <FadeInUp key={session.key} index={i + 1}>
              <PressableScale
                style={styles.listCard}
                onPress={() => startSession(session)}
                accessibilityRole="button"
                accessibilityLabel={`Start ${session.label}`}
              >
                <IconBadge gym="dumbbell" size={44} />
                <View style={styles.listCardMain}>
                  <Text style={styles.listCardTitle}>{session.label}</Text>
                  <Text style={styles.listCardSub} numberOfLines={1}>{session.exercises.map(e => e.name).join(' · ')}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={COLORS.textDim} />
              </PressableScale>
            </FadeInUp>
          ))}

          {templates.length > 0 && <Text style={styles.sectionLabel}>Saved workouts</Text>}
          {templates.map((template, i) => (
            <FadeInUp key={template.id} index={i + 2}>
              <PressableScale
                style={styles.listCard}
                onPress={() => startFromTemplate(template)}
                accessibilityRole="button"
                accessibilityLabel={`Start saved workout ${template.name}`}
              >
                <IconBadge icon="bookmark" size={44} />
                <View style={styles.listCardMain}>
                  <Text style={styles.listCardTitle}>{template.name}</Text>
                  <Text style={styles.listCardSub} numberOfLines={1}>
                    {(template.exercises || []).map(canonicalName).join(' · ')}
                  </Text>
                </View>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => deleteTemplate(template)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete saved workout ${template.name}`}
                >
                  <Feather name="trash-2" size={16} color={COLORS.textMuted} />
                </Pressable>
              </PressableScale>
            </FadeInUp>
          ))}

          {templates.length === 0 && programme.sessions.length === 0 && (
            <View style={styles.noTemplatesHint}>
              <Text style={styles.noTemplatesText}>
                No saved workouts yet.{'\n'}Finish a workout and save it to reuse it here.
              </Text>
            </View>
          )}

          <FadeInUp index={4}>
            <PressableScale
              style={styles.freshCard}
              onPress={startFresh}
              accessibilityRole="button"
              accessibilityLabel="Start fresh. Build your workout as you go"
            >
              <IconBadge icon="plus" size={44} filled />
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardTitle}>Start fresh</Text>
                <Text style={styles.listCardSub}>Build your workout as you go</Text>
              </View>
              <Feather name="chevron-right" size={20} color={COLORS.textDim} />
            </PressableScale>
          </FadeInUp>
        </ScrollView>
      </View>
    );
  }

  // ── ACTIVE PHASE ──────────────────────────────────────────────────────────────
  const doneCount = routine.filter(e => setData[e.name]?.logged).length;
  const allDone   = routine.length > 0 && doneCount === routine.length;
  const pickerList = pickerQuery.trim()
    ? EXERCISES.filter(e => e.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
    : filteredExercises;

  return (
    <View style={styles.container}>

      <ScreenHeader
        title={sessionLabel || 'Workout'}
        onBack={cancelWorkout}
        right={
          <View style={styles.headerRight}>
            <View style={styles.timerPill} accessible accessibilityLabel={`Elapsed ${formatTime(elapsedSeconds)}`}>
              <LiveDot />
              <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
            </View>
            <PressableScale
              onPress={finishWorkout}
              style={[styles.finishBtn, allDone && styles.finishBtnReady]}
              accessibilityRole="button"
              accessibilityLabel="Finish workout"
            >
              <Text style={[styles.finishText, allDone && { color: COLORS.onGold }]}>Finish</Text>
            </PressableScale>
          </View>
        }
      />

      {routine.length > 0 && (
        <View style={styles.progressWrap} accessible accessibilityLabel={`${doneCount} of ${routine.length} exercises done`}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(doneCount / routine.length) * 100}%` }]}>
              <LinearGradient colors={GRADIENTS.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </View>
          </View>
          <Text style={styles.progressText}>{doneCount}/{routine.length}</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {routine.length === 0 ? (
          <PressableScale
            style={styles.emptyCard}
            onPress={() => setShowExercisePicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
          >
            <IconBadge icon="plus" size={56} filled />
            <Text style={styles.emptyTitle}>Add your first exercise</Text>
            <Text style={styles.emptySubtitle}>Pick from the Heavy Duty exercise library</Text>
          </PressableScale>
        ) : (
          <>
            {routine.map((exercise, idx) => {
              const data  = setData[exercise.name] || {};
              const pb    = prevBests[exercise.name];
              const ready = !!(data.weight && data.reps);
              const target = targetFor(exercise);

              if (data.logged) {
                return (
                  <DoneCard key={exercise.name} exercise={exercise} data={data} onEdit={() => undoSet(exercise)} />
                );
              }

              const cued = supersetCue === exercise.name;
              return (
                <FadeInUp key={exercise.name} index={idx}>
                  <View style={[styles.card, cued && styles.cardCued]}>
                    <View style={styles.cardHeader}>
                      <IconBadge gym={muscleIcon(exercise.muscle)} size={44} />
                      <View style={styles.cardHeaderMain}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <View style={styles.tagRow}>
                          <Tag label={exercise.muscle} />
                          <Tag label={`${exercise.repRange[0]}–${exercise.repRange[1]} reps`} color={COLORS.textSecondary} />
                          {exercise.hd2Core && <Tag label="HD2" color={COLORS.gold} />}
                        </View>
                      </View>
                    </View>

                    {exercise.supersetWith && (
                      <View style={styles.supersetBanner}>
                        <MaterialCommunityIcons name="lightning-bolt" size={15} color={COLORS.gold} />
                        <Text style={styles.supersetNote}>Superset: straight into {exercise.supersetWith}, no rest</Text>
                      </View>
                    )}
                    {cued && (
                      <View style={[styles.supersetBanner, styles.supersetBannerGo]} accessibilityLiveRegion="polite">
                        <MaterialCommunityIcons name="fire" size={16} color={COLORS.onGold} />
                        <Text style={styles.supersetCue}>Go now: no rest after the pre-exhaust</Text>
                      </View>
                    )}

                    <View style={styles.statRow}>
                      <StatPill
                        label="Last time"
                        value={target ? `${target.lastWeight}kg × ${target.lastReps}` : 'First time'}
                        sub={target ? formatShortDate(target.lastDate) : `Aim ${exercise.repRange[0]}–${exercise.repRange[1]} reps`}
                      />
                      <StatPill
                        label="Target"
                        value={target ? `${target.weight}kg × ${target.repGoal}+` : '—'}
                        highlight={!!target}
                      />
                      <StatPill label="Best" value={pb ? `${pb.weight_kg}kg × ${pb.reps}` : '—'} />
                    </View>

                    <View style={styles.setRow}>
                      <Stepper
                        label="Weight"
                        unit="kg"
                        value={data.weight}
                        onChange={v => updateField(exercise.name, 'weight', v)}
                        onMinus={() => adjustWeight(exercise.name, -weightIncrement)}
                        onPlus={() => adjustWeight(exercise.name, weightIncrement)}
                        keyboardType="decimal-pad"
                        inputLabel={`${exercise.name} weight in kilograms`}
                        minusLabel={`Decrease weight by ${weightIncrement} kilograms`}
                        plusLabel={`Increase weight by ${weightIncrement} kilograms`}
                      />
                      <Stepper
                        label="Reps"
                        unit="reps"
                        value={data.reps}
                        onChange={v => updateField(exercise.name, 'reps', v)}
                        onMinus={() => adjustReps(exercise.name, -1)}
                        onPlus={() => adjustReps(exercise.name, 1)}
                        keyboardType="number-pad"
                        inputLabel={`${exercise.name} reps`}
                        minusLabel="Decrease reps by one"
                        plusLabel="Increase reps by one"
                      />
                    </View>

                    <Button
                      title="Log set to failure"
                      icon="check"
                      variant={ready ? 'primary' : 'secondary'}
                      onPress={() => logSet(exercise)}
                      accessibilityLabel={`Log ${exercise.name} set`}
                      style={{ marginTop: SPACING.md }}
                    />

                    {exercise.mentzerNote && (
                      <View style={styles.noteRow}>
                        <Feather name="info" size={13} color={COLORS.textDim} style={{ marginTop: 2 }} />
                        <Text style={styles.mentzerNote}>{exercise.mentzerNote}</Text>
                      </View>
                    )}
                  </View>
                </FadeInUp>
              );
            })}

            <PressableScale
              style={styles.addBtn}
              onPress={() => setShowExercisePicker(true)}
              hapticStyle="tap"
              accessibilityRole="button"
              accessibilityLabel="Add exercise"
            >
              <Feather name="plus" size={16} color={COLORS.gold} />
              <Text style={styles.addBtnText}>Add exercise</Text>
            </PressableScale>
          </>
        )}
      </ScrollView>

      {/* Rest Timer */}
      {restTimer.active && (
        <FadeInUp style={styles.restBar} distance={30}>
          <View style={styles.restBarLeft}>
            <IconBadge gym="timer-outline" size={44} />
            <View>
              <Text style={styles.restBarLabel}>Resting · keep it short</Text>
              <Text style={styles.restBarTime} accessibilityLiveRegion="none">{formatTime(restTimer.elapsed)}</Text>
            </View>
          </View>
          <Button title="I'm ready" size="md" onPress={dismissRestTimer} style={{ paddingHorizontal: 20 }} />
        </FadeInUp>
      )}

      {/* Save Template Modal */}
      <Modal visible={saveModal} transparent animationType="fade" onRequestClose={() => setSaveModal(false)}>
        <View style={styles.saveOverlay}>
          <View style={styles.saveCard} accessibilityViewIsModal>
            <IconBadge icon="bookmark" size={52} style={{ marginBottom: 14 }} />
            <Text style={styles.saveTitle} accessibilityRole="header">Save this workout</Text>
            <Text style={styles.saveSubtitle}>Name it to reuse it next time</Text>
            <TextInput
              style={styles.saveInput}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="e.g. Push day, Leg day…"
              placeholderTextColor={COLORS.textFaint}
              autoFocus
              returnKeyType="done"
              accessibilityLabel="Workout name"
            />
            <Text style={styles.saveExerciseList} numberOfLines={2}>
              {routine.map(e => e.name).join(' · ')}
            </Text>
            <View style={styles.saveButtons}>
              <Button title="Skip" variant="secondary" size="md" onPress={doFinish} style={{ flex: 1 }} />
              <Button title="Save & finish" size="md" onPress={saveAndFinish} disabled={!templateName.trim()} style={{ flex: 2 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Exercise Picker Modal */}
      <Modal visible={showExercisePicker} animationType="slide" onRequestClose={() => setShowExercisePicker(false)}>
        <View style={styles.modal}>
          <ScreenHeader title="Add exercise" onBack={() => { setShowExercisePicker(false); setPickerQuery(''); }} />

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Feather name="search" size={17} color={COLORS.textDim} />
              <TextInput
                style={styles.searchInput}
                value={pickerQuery}
                onChangeText={setPickerQuery}
                placeholder="Search exercise"
                placeholderTextColor={COLORS.textDim}
                accessibilityLabel="Search exercises"
                returnKeyType="search"
              />
            </View>
          </View>

          {!pickerQuery.trim() && (
            <ScrollView horizontal style={styles.muscleFilter} contentContainerStyle={{ gap: 8, paddingHorizontal: SPACING.screen }} showsHorizontalScrollIndicator={false}>
              {MUSCLES.map(muscle => {
                const active = selectedMuscle === muscle;
                return (
                  <Pressable
                    key={muscle}
                    style={[styles.muscleChip, active && styles.muscleChipActive]}
                    onPress={() => { haptic.tap(); setSelectedMuscle(muscle); }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.muscleChipText, active && styles.muscleChipTextActive]}>{muscle}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.screen, paddingBottom: 40 }}>
            {pickerList.length === 0 && <Text style={styles.noTemplatesText}>No exercises match "{pickerQuery}".</Text>}
            {pickerList.map(exercise => {
              const alreadyAdded = routineNames.has(exercise.name);
              return (
                <PressableScale
                  key={exercise.name}
                  style={[styles.pickRow, alreadyAdded && styles.pickRowAdded]}
                  onPress={() => { if (!alreadyAdded) { addExercise(exercise); setPickerQuery(''); } }}
                  disabled={alreadyAdded}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: alreadyAdded }}
                  accessibilityLabel={`${exercise.name}, ${exercise.type}, ${exercise.repRange[0]} to ${exercise.repRange[1]} reps${alreadyAdded ? ', already added' : ''}`}
                >
                  <IconBadge gym={muscleIcon(exercise.muscle)} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName}>{exercise.name}</Text>
                    <View style={styles.tagRow}>
                      <Tag label={exercise.muscle} />
                      <Tag label={exercise.type === 'compound' ? 'Compound' : 'Isolation'} color={COLORS.textSecondary} />
                      {exercise.hd2Core && <Tag label="HD2" color={COLORS.gold} />}
                    </View>
                  </View>
                  <View style={[styles.checkBox, alreadyAdded && styles.checkBoxOn]}>
                    <Feather name={alreadyAdded ? 'check' : 'plus'} size={15} color={alreadyAdded ? COLORS.onGold : COLORS.textMuted} />
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Presentational pieces ───────────────────────────────────────────────────
function LiveDot() {
  const pulse = useLoop(1200);
  return (
    <View style={styles.liveDotWrap}>
      <Animated.View style={[styles.liveDotRing, {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2] }) }],
      }]} />
      <View style={styles.liveDot} />
    </View>
  );
}

function StatPill({ label, value, sub, highlight }) {
  return (
    <View style={[styles.statPill, highlight && styles.statPillHi]} accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
      <Text style={[styles.statLabel, highlight && { color: COLORS.gold }]}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: COLORS.gold }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={styles.statSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

function Stepper({ label, unit, value, onChange, onMinus, onPlus, keyboardType, inputLabel, minusLabel, plusLabel }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <PressableScale onPress={onMinus} hapticStyle="tap" scaleTo={0.88} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={minusLabel}>
          <Feather name="minus" size={18} color={COLORS.white} />
        </PressableScale>
        <TextInput
          style={styles.stepInput}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          accessibilityLabel={inputLabel}
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={COLORS.textFaint}
        />
        <PressableScale onPress={onPlus} hapticStyle="tap" scaleTo={0.88} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={plusLabel}>
          <Feather name="plus" size={18} color={COLORS.white} />
        </PressableScale>
      </View>
      <Text style={styles.stepUnit}>{unit}</Text>
    </View>
  );
}

// Logged exercise: springs in with a success haptic; a PR gets a trophy burst
function DoneCard({ exercise, data, onEdit }) {
  const reduced = useReduceMotion();
  const pop = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (data.isPR) haptic.heavy(); else haptic.success();
    if (reduced) return;
    Animated.spring(pop, { toValue: 1, useNativeDriver: Platform.OS !== 'web', damping: 11, stiffness: 160 }).start();
    if (data.isPR) {
      Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    }
  }, []);

  const RAYS = 10;
  return (
    <View style={[styles.cardDone, data.isPR && styles.cardDonePR]} accessibilityLiveRegion="polite">
      {data.isPR && <LinearGradient colors={GRADIENTS.heroGlow} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />}
      <View style={styles.doneHeader}>
        <View style={styles.doneCheckWrap}>
          {data.isPR && !reduced && Array.from({ length: RAYS }).map((_, i) => {
            const angle = (i / RAYS) * 2 * Math.PI;
            return (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={[styles.ray, {
                  opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 34] }) },
                    { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 34] }) },
                  ],
                }]}
              />
            );
          })}
          <Animated.View style={[styles.doneCheck, { transform: [{ scale: pop }] }]}>
            <Feather name="check" size={18} color={COLORS.onGold} />
          </Animated.View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doneName}>{exercise.name}</Text>
          <Text style={styles.doneStats}>{data.weight}kg × {data.reps} reps</Text>
        </View>
        {data.isPR && (
          <Animated.View style={[styles.prBadge, { transform: [{ scale: pop }] }]} accessible accessibilityLabel="New personal record">
            <MaterialCommunityIcons name="trophy" size={14} color={COLORS.onGold} />
            <Text style={styles.prBadgeText}>New PR</Text>
          </Animated.View>
        )}
      </View>
      {data.result && (
        <View style={styles.doneResult}>
          {data.result.progressNote && (
            <Text style={styles.doneResultNote}>{data.result.progressNote}</Text>
          )}
          <View style={styles.doneNextRow}>
            <Feather name="arrow-up-right" size={14} color={COLORS.gold} />
            <Text style={styles.doneResultNext}>
              Next session: {data.result.nextWeight}kg · {data.result.restDays}+ days rest
            </Text>
          </View>
        </View>
      )}
      <Pressable
        style={styles.editSetBtn}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Edit logged ${exercise.name} set`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="edit-2" size={13} color={COLORS.textMuted} />
        <Text style={styles.editSetBtnText}>EDIT</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { flex: 1, paddingHorizontal: SPACING.screen },

  // ── Picking phase ─────────────────────────────────────────────────────────────
  pickContent:  { paddingHorizontal: SPACING.screen, paddingBottom: 60 },
  sectionLabel: { ...TYPE.section, color: COLORS.white, marginTop: SPACING.xl, marginBottom: SPACING.md },
  nextCard:     { borderRadius: RADIUS.xl, padding: SPACING.lg, overflow: 'hidden',
                  backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.goldBorder },
  nextChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                  backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  nextChipText: { ...TYPE.overline, color: COLORS.gold },
  nextTitle:    { ...TYPE.title, fontSize: 26, lineHeight: 32, color: COLORS.white, marginTop: 12 },
  nextMeta:     { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  nextList:     { marginTop: SPACING.md, gap: 10 },
  nextRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextRowName:  { flex: 1, color: COLORS.white, fontSize: 15, fontWeight: FONT.semibold },
  listCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.surface,
                  borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 10 },
  listCardMain: { flex: 1 },
  listCardTitle:{ color: COLORS.white, fontSize: 16, fontWeight: FONT.bold },
  listCardSub:  { color: COLORS.textDim, fontSize: 12, marginTop: 3 },
  iconBtn:      { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center' },
  noTemplatesHint: { borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: RADIUS.lg,
                     padding: 20, marginVertical: 20, alignItems: 'center' },
  noTemplatesText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  freshCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: RADIUS.lg, padding: SPACING.md,
                  marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.borderStrong, borderStyle: 'dashed' },

  // ── Active phase header ───────────────────────────────────────────────────────
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerPill:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.surface,
                   borderRadius: RADIUS.pill, paddingHorizontal: 11, height: 36 },
  timerText:     { color: COLORS.white, fontSize: 14, fontWeight: FONT.bold, fontVariant: ['tabular-nums'] },
  finishBtn:     { height: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceRaised,
                   alignItems: 'center', justifyContent: 'center' },
  finishBtnReady:{ backgroundColor: COLORS.gold },
  finishText:    { color: COLORS.gold, fontSize: 14, fontWeight: FONT.bold },
  liveDotWrap:   { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDotRing:   { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.red },
  liveDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.red },
  progressWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.screen, marginBottom: SPACING.md },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceRaised, overflow: 'hidden' },
  progressFill:  { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressText:  { color: COLORS.textMuted, fontSize: 12, fontWeight: FONT.bold, fontVariant: ['tabular-nums'] },

  // ── Exercise cards ────────────────────────────────────────────────────────────
  emptyCard:     { borderWidth: 1, borderColor: COLORS.borderStrong, borderStyle: 'dashed', borderRadius: RADIUS.xl,
                   padding: 40, alignItems: 'center', marginTop: 20, gap: 10 },
  emptyTitle:    { color: COLORS.white, fontSize: 17, fontWeight: FONT.bold, marginTop: 6 },
  emptySubtitle: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },

  card:           { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: 12,
                    borderWidth: 1, borderColor: 'transparent' },
  cardCued:       { borderColor: COLORS.gold },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardHeaderMain: { flex: 1 },
  exerciseName:   { color: COLORS.white, fontSize: 18, fontWeight: FONT.bold, letterSpacing: -0.2 },
  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },

  supersetBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.goldFaint,
                      borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  supersetBannerGo: { backgroundColor: COLORS.gold },
  supersetNote:     { color: COLORS.gold, fontSize: 13, fontWeight: FONT.semibold, flex: 1 },
  supersetCue:      { color: COLORS.onGold, fontSize: 13, fontWeight: FONT.black, flex: 1 },

  statRow:    { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statPill:   { flex: 1, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  statPillHi: { backgroundColor: COLORS.goldFaint },
  statLabel:  { color: COLORS.textDim, fontSize: 11, fontWeight: FONT.semibold },
  statValue:  { color: COLORS.white, fontSize: 14, fontWeight: FONT.bold, marginTop: 3, fontVariant: ['tabular-nums'] },
  statSub:    { color: COLORS.textDim, fontSize: 11, marginTop: 1 },

  setRow:       { flexDirection: 'row', gap: 10 },
  stepper:      { flex: 1, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.lg, padding: 10, alignItems: 'center' },
  stepLabel:    { color: COLORS.textDim, fontSize: 11, fontWeight: FONT.semibold, marginBottom: 6 },
  stepControls: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 6 },
  stepBtn:      { width: 40, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceRaised,
                  alignItems: 'center', justifyContent: 'center' },
  stepInput:    { flex: 1, minWidth: 0, color: COLORS.white, fontSize: 24, fontWeight: FONT.black, textAlign: 'center',
                  paddingVertical: 4, fontVariant: ['tabular-nums'] },
  stepUnit:     { color: COLORS.textDim, fontSize: 11, marginTop: 4 },

  noteRow:     { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  mentzerNote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },

  // ── Logged exercise ───────────────────────────────────────────────────────────
  cardDone:       { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: 12, overflow: 'hidden',
                    borderWidth: 1, borderColor: COLORS.border },
  cardDonePR:     { borderColor: COLORS.goldBorder },
  doneHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneCheckWrap:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  doneCheck:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  ray:            { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.goldBright },
  doneName:       { color: COLORS.white, fontSize: 16, fontWeight: FONT.bold },
  doneStats:      { color: COLORS.gold, fontSize: 20, fontWeight: FONT.black, marginTop: 1, fontVariant: ['tabular-nums'] },
  prBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.gold,
                    borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  prBadgeText:    { color: COLORS.onGold, fontSize: 12, fontWeight: FONT.black },
  doneResult:     { marginTop: 12, marginLeft: 52 },
  doneResultNote: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  doneNextRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneResultNext: { color: COLORS.textMuted, fontSize: 13 },
  editSetBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: SPACING.sm,
                    paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceRaised },
  editSetBtnText: { color: COLORS.textMuted, fontSize: 11, fontWeight: FONT.bold, letterSpacing: 1.2 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
                minHeight: HIT, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderStrong, borderStyle: 'dashed' },
  addBtnText: { color: COLORS.gold, fontSize: 14, fontWeight: FONT.bold },

  // ── Rest timer ────────────────────────────────────────────────────────────────
  restBar:      { position: 'absolute', bottom: 16, left: SPACING.screen, right: SPACING.screen,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: COLORS.surfaceRaised, borderRadius: RADIUS.xl, padding: 12,
                  borderWidth: 1, borderColor: COLORS.goldBorder,
                  shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  restBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restBarLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: FONT.semibold },
  restBarTime:  { color: COLORS.white, fontSize: 24, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },

  // ── Save template modal ───────────────────────────────────────────────────────
  saveOverlay:      { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: SPACING.screen },
  saveCard:         { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl, width: '100%', maxWidth: 440 },
  saveTitle:        { ...TYPE.title, color: COLORS.white, marginBottom: 4 },
  saveSubtitle:     { color: COLORS.textMuted, fontSize: 14, marginBottom: 18 },
  saveInput:        { backgroundColor: COLORS.surfaceDark, color: COLORS.white, fontSize: 17, fontWeight: FONT.medium,
                      paddingHorizontal: 14, minHeight: 52, borderRadius: RADIUS.md, marginBottom: 10 },
  saveExerciseList: { color: COLORS.textDim, fontSize: 12, lineHeight: 17, marginBottom: 20 },
  saveButtons:      { flexDirection: 'row', gap: 10 },

  // ── Exercise picker modal ─────────────────────────────────────────────────────
  modal:       { flex: 1, backgroundColor: COLORS.background },
  searchRow:   { paddingHorizontal: SPACING.screen, marginBottom: SPACING.md },
  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surface,
                 borderRadius: RADIUS.md, paddingHorizontal: 14, minHeight: 48 },
  searchInput: { flex: 1, color: COLORS.white, fontSize: 15, paddingVertical: 10 },

  muscleFilter:         { flexGrow: 0, marginBottom: SPACING.md },
  muscleChip:           { paddingHorizontal: 16, height: 36, justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLORS.surface },
  muscleChipActive:     { backgroundColor: COLORS.gold },
  muscleChipText:       { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.semibold },
  muscleChipTextActive: { color: COLORS.onGold, fontWeight: FONT.bold },

  pickRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface,
                  borderRadius: RADIUS.lg, padding: 12, marginBottom: 8 },
  pickRowAdded: { opacity: 0.55 },
  pickName:     { color: COLORS.white, fontSize: 16, fontWeight: FONT.bold },
  checkBox:     { width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.borderStrong,
                  alignItems: 'center', justifyContent: 'center' },
  checkBoxOn:   { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
});
