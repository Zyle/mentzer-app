// Routine adherence for the Heavy Duty score (Home card + score detail screen).
// Each workout is judged against the programme session it most closely matches
// (Workout A or B on the Two-Way Split), not against the whole routine.
import { buildSessions } from './programme';
import { findExercise } from '../data/exercises';

const canonical = name => findExercise(name)?.name || name;

export const getSessions = profile => buildSessions(profile?.routine, profile?.routine_type);

// One entry per workout: { workout, done (Set of canonical names), session, completion 0–1 }
export const workoutAdherence = (workouts, sets, sessions) => {
  if (!sessions?.length) return [];
  return workouts.map(w => {
    const done = new Set(sets.filter(s => s.workout_id === w.id).map(s => canonical(s.exercise_name)));
    let session = sessions[0], completion = -1;
    sessions.forEach(sess => {
      const pct = sess.exercises.length
        ? sess.exercises.filter(e => done.has(e.name)).length / sess.exercises.length
        : 0;
      if (pct > completion) { session = sess; completion = pct; }
    });
    return { workout: w, done, session, completion };
  });
};

// Average adherence as a 0–100 score, or null when there is nothing to score.
export const calcRoutineScore = (workouts, sets, sessions) => {
  const rows = workoutAdherence(workouts, sets, sessions);
  if (!rows.length) return null;
  return Math.round((rows.reduce((a, r) => a + r.completion, 0) / rows.length) * 100);
};
