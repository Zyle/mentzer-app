// Programme logic — turns the routine saved at setup into the workout(s) the
// user actually follows, in HD2 order (pre-exhaust supersets first).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { findExercise } from '../data/exercises';

export const PROGRAMME_LABELS = {
  consolidation: 'Consolidation',
  two_way:       'HD Two-Way Split',
  ideal:         'Ideal Routine',
};

const ROUTINE_TYPE_KEY = 'routineType';

// The setup screens and App.js have used different spellings over time.
export const normaliseRoutineType = (type) => {
  if (!type) return null;
  if (type === 'two_way_split') return 'two_way';
  return type;
};

// Put each pre-exhaust isolation directly before the compound it pre-exhausts,
// and flag it as a superset (no rest between the two).
export const orderForSupersets = (exercises) => {
  const compounds = exercises.filter(e => !e.preExhaust);
  const prehausts = exercises.filter(e => e.preExhaust);
  const placed    = new Set();
  const ordered   = [];

  compounds.forEach(c => {
    if (c.pattern) {
      prehausts
        .filter(p => !placed.has(p.name) && p.preExhaust === c.pattern)
        .forEach(p => { placed.add(p.name); ordered.push({ ...p, supersetWith: c.name }); });
    }
    ordered.push(c);
  });
  // Pre-exhausts with no matching compound still get trained, just not as a superset.
  prehausts.filter(p => !placed.has(p.name)).forEach(p => ordered.push(p));
  return ordered;
};

// Build the list of sessions for a programme. Consolidation and Ideal are one
// workout; the Two-Way Split alternates Workout A (upper) and B (lower).
export const buildSessions = (routineNames, routineType) => {
  const exercises = (routineNames || []).map(findExercise).filter(Boolean);
  if (!exercises.length) return [];

  if (normaliseRoutineType(routineType) === 'two_way') {
    const upper = exercises.filter(e => e.region !== 'lower');
    const lower = exercises.filter(e => e.region === 'lower');
    const sessions = [];
    if (upper.length) sessions.push({ key: 'A', label: 'Workout A — Upper Body', exercises: orderForSupersets(upper) });
    if (lower.length) sessions.push({ key: 'B', label: 'Workout B — Lower Body', exercises: orderForSupersets(lower) });
    return sessions;
  }

  return [{ key: 'full', label: PROGRAMME_LABELS[routineType] || 'Your Routine', exercises: orderForSupersets(exercises) }];
};

// Choose the session to do next: the one that shares the fewest exercises
// with the most recent workout (i.e. A → B → A ...).
export const pickNextSession = (sessions, lastWorkoutExerciseNames = []) => {
  if (sessions.length <= 1) return sessions[0] || null;
  const last = new Set(lastWorkoutExerciseNames.map(n => findExercise(n)?.name));
  if (!last.size) return sessions[0];
  const scored = sessions.map(s => ({ s, overlap: s.exercises.filter(e => last.has(e.name)).length }));
  scored.sort((a, b) => a.overlap - b.overlap);
  return scored[0].s;
};

export const loadProgramme = async (userId) => {
  let routine = [];
  let routineType = null;

  // routine_type may not exist on older databases — fall back to routine only.
  const withType = await supabase.from('profiles').select('routine, routine_type').eq('id', userId).single();
  if (!withType.error) {
    routine = withType.data?.routine || [];
    routineType = withType.data?.routine_type || null;
  } else {
    const plain = await supabase.from('profiles').select('routine').eq('id', userId).single();
    routine = plain.data?.routine || [];
  }

  if (!routineType) {
    try { routineType = await AsyncStorage.getItem(ROUTINE_TYPE_KEY); } catch (_) {}
  }
  routineType = normaliseRoutineType(routineType);
  return { routine, routineType, sessions: buildSessions(routine, routineType) };
};

// Save routine and routine_type separately so a missing routine_type column
// can never cause the routine itself to be lost. Returns { error }.
export const saveProgramme = async (userId, routine, routineType) => {
  const type = normaliseRoutineType(routineType);
  if (type) {
    try { await AsyncStorage.setItem(ROUTINE_TYPE_KEY, type); } catch (_) {}
  }
  if (!userId) return { error: null };

  const { error } = await supabase.from('profiles').update({ routine }).eq('id', userId);
  if (error) return { error };

  if (type) {
    const { error: typeError } = await supabase.from('profiles').update({ routine_type: type }).eq('id', userId);
    if (typeError) console.warn('routine_type not saved (column missing?):', typeError.message);
  }
  return { error: null };
};

export const saveRoutineType = async (userId, routineType) => {
  const type = normaliseRoutineType(routineType);
  if (!type) return;
  try { await AsyncStorage.setItem(ROUTINE_TYPE_KEY, type); } catch (_) {}
  if (!userId) return;
  const { error } = await supabase.from('profiles').update({ routine_type: type }).eq('id', userId);
  if (error) console.warn('routine_type not saved (column missing?):', error.message);
};

// Fraction (0-1) of the programme session a workout covered. On the Two-Way
// Split each workout is scored against its own session (A or B), not the whole
// routine. Returns null if there is no programme.
export const sessionCompletion = (sessions, workoutExerciseNames) => {
  if (!sessions?.length) return null;
  const done = new Set((workoutExerciseNames || []).map(n => findExercise(n)?.name));
  return Math.max(...sessions.map(s =>
    s.exercises.length ? s.exercises.filter(e => done.has(e.name)).length / s.exercises.length : 0,
  ));
};
