// HD2 Consolidated Routine — Mike Mentzer's most refined system
// One set per exercise, to absolute failure, every 4-7 days
//
// Field notes:
//   region      'upper' | 'lower' — used to split a routine into Workout A / B
//   pattern     movement a compound trains; pre-exhaust isolations target a pattern
//   preExhaust  pattern this isolation pre-exhausts (superset straight into the compound)
//   systemic    very demanding on recovery — needs extra rest days

export const EXERCISES = [
  // ── CORE HD2 EXERCISES ──────────────────────────────────────────
  // Legs
  {
    name: 'Squats',
    muscle: 'Legs',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    region: 'lower', pattern: 'quads', systemic: true,
    mentzerNote: 'The king of all exercises. Mentzer called this the single best muscle-builder. Go below parallel, full ROM.',
  },
  {
    name: 'Leg Press',
    muscle: 'Legs',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    region: 'lower', pattern: 'quads', systemic: true,
    mentzerNote: 'Primary alternative to Squats. Go full range of motion. Do not lock knees at top.',
  },
  {
    name: 'Deadlifts',
    muscle: 'Back',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    region: 'lower', pattern: 'hinge', systemic: true,
    mentzerNote: 'Works more muscle than any other single exercise. Full body stimulus. Keep back straight, drive through heels.',
  },

  // Back / Pull
  {
    name: 'Close-Grip Pulldowns',
    muscle: 'Back',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    region: 'upper', pattern: 'pull',
    mentzerNote: 'Mentzer\'s preferred back movement. Supinated grip, pull to upper chest, full stretch at top.',
  },
  {
    name: 'Weighted Chin-Ups',
    muscle: 'Back',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    region: 'upper', pattern: 'pull',
    mentzerNote: 'Alternative to pulldowns. Add weight via belt. Full hang at bottom, chin over bar at top.',
  },

  // Chest / Push
  {
    name: 'Weighted Dips',
    muscle: 'Chest',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    region: 'upper', pattern: 'push',
    mentzerNote: 'Mentzer\'s preferred chest movement. Lean forward slightly, go all the way down, full stretch at bottom.',
  },
  {
    name: 'Incline Press',
    muscle: 'Chest',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: false,
    region: 'upper', pattern: 'push',
    mentzerNote: 'Alternative to Dips. 30-45 degree incline. Focus on chest contraction, not shoulder involvement.',
  },

  // ── PRE-EXHAUSTION ISOLATION (used before compound) ─────────────
  {
    name: 'Leg Extensions',
    muscle: 'Legs',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    region: 'lower',
    preExhaustFor: 'Leg Press', preExhaust: 'quads',
    mentzerNote: 'Pre-exhaust isolation before Leg Press. Go immediately to Leg Press with no rest after this.',
  },
  {
    name: 'Leg Curls',
    muscle: 'Legs',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    region: 'lower', preExhaust: 'hinge',
    mentzerNote: 'Hamstring isolation. Can be used as pre-exhaust before Deadlifts.',
  },
  {
    name: 'Pec Deck',
    muscle: 'Chest',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    region: 'upper',
    preExhaustFor: 'Weighted Dips', preExhaust: 'push',
    mentzerNote: 'Pre-exhaust isolation before Dips. Fatigues pecs so they fail before triceps in Dips.',
  },
  {
    name: 'Dumbbell Flyes',
    muscle: 'Chest',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    region: 'upper',
    preExhaustFor: 'Weighted Dips', preExhaust: 'push',
    mentzerNote: 'Alternative pre-exhaust for chest. Full stretch at bottom.',
  },
  {
    name: 'Dumbbell Pullover',
    muscle: 'Back',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    region: 'upper',
    preExhaustFor: 'Close-Grip Pulldowns', preExhaust: 'pull',
    mentzerNote: 'Pre-exhaust for back. Stretches lats. Go immediately to Pulldowns after.',
  },

  // ── SUPPLEMENTARY ────────────────────────────────────────────────
  {
    name: 'Dumbbell Lateral Raises',
    muscle: 'Shoulders',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    region: 'upper',
    mentzerNote: 'Shoulders get significant stimulation from Dips and Presses. Use sparingly.',
  },
  {
    name: 'Barbell Curls',
    muscle: 'Biceps',
    type: 'isolation',
    repRange: [6, 10],
    hd2Core: false,
    region: 'upper',
    mentzerNote: 'Biceps are heavily worked in all pulling movements. This is supplementary only.',
  },
  {
    name: 'Triceps Pressdowns',
    muscle: 'Triceps',
    type: 'isolation',
    repRange: [6, 10],
    hd2Core: false,
    region: 'upper',
    mentzerNote: 'Triceps are heavily worked in Dips and Presses. This is supplementary only.',
  },
  {
    name: 'Standing Calf Raises',
    muscle: 'Calves',
    type: 'isolation',
    repRange: [12, 20],
    hd2Core: false,
    region: 'lower',
    mentzerNote: 'Calves respond to higher reps. Full stretch at bottom, full contraction at top.',
  },
  {
    name: 'Shrugs',
    muscle: 'Traps',
    type: 'isolation',
    repRange: [6, 10],
    hd2Core: false,
    region: 'upper',
    mentzerNote: 'Traps are heavily stimulated by Deadlifts. Use only if lagging.',
  },

  // ── ALTERNATIVES offered in programme setup ──────────────────────
  // Legs
  { name: 'Hack Squat',            muscle: 'Legs', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'quads', systemic: true,
    mentzerNote: 'Deep knee flexion with less lower-back load. Full depth, controlled negative.' },
  { name: 'Smith Machine Squat',   muscle: 'Legs', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'quads', systemic: true,
    mentzerNote: 'Fixed bar path. Full depth, controlled negative, one set to failure.' },
  { name: 'Front Squat',           muscle: 'Legs', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'quads', systemic: true,
    mentzerNote: 'Upright torso, quad-dominant. Full depth.' },
  { name: 'Goblet Squat',          muscle: 'Legs', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'quads',
    mentzerNote: 'Weight held at chest. Enforces good mechanics — progress the load every session you can.' },
  { name: 'Bulgarian Split Squat', muscle: 'Legs', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'quads',
    mentzerNote: 'Log the weight per hand. Take each leg to failure.' },
  { name: 'Lunges',                muscle: 'Legs', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'quads',
    mentzerNote: 'Log the weight per hand. Controlled, full range.' },

  // Posterior chain
  { name: 'Romanian Deadlift',     muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'hinge', systemic: true,
    mentzerNote: 'Mentzer\'s alternative for lower-back issues. Deep hamstring stretch under load.' },
  { name: 'Trap Bar Deadlift',     muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'hinge', systemic: true,
    mentzerNote: 'Neutral grip, centred load, less shear on the lower back.' },
  { name: 'Rack Pull',             muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'hinge', systemic: true,
    mentzerNote: 'Deadlift from knee height. Heavy posterior-chain loading with less lower-back stress.' },
  { name: 'Good Mornings',         muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'hinge',
    mentzerNote: 'Strict technique. If form breaks down, the set is over.' },
  { name: 'Cable Pull-Through',    muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'hinge',
    mentzerNote: 'Hip hinge with constant tension and very low spinal loading.' },
  { name: 'Hip Thrust',            muscle: 'Legs', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'lower', pattern: 'hinge',
    mentzerNote: 'Glute-dominant. Pause at full contraction.' },

  // Push
  { name: 'Flat Bench Press',      muscle: 'Chest', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'push',
    mentzerNote: 'Controlled negative, touch the chest, press to lockout.' },
  { name: 'Dumbbell Press',        muscle: 'Chest', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'push',
    mentzerNote: 'Log the weight per dumbbell. Deep stretch at the bottom.' },
  { name: 'Machine Chest Press',   muscle: 'Chest', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'push',
    mentzerNote: 'Safe to take to true failure without a spotter.' },
  { name: 'Smith Machine Press',   muscle: 'Chest', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'push',
    mentzerNote: 'Fixed path. Use the safeties and go to true failure.' },
  { name: 'Weighted Push Ups',     muscle: 'Chest', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'push',
    mentzerNote: 'Log the added weight. Full range, chest to floor.' },
  { name: 'Overhead Press',        muscle: 'Shoulders', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'push',
    mentzerNote: 'Strict press, no leg drive.' },

  // Pull
  { name: 'Wide-Grip Pull-Ups',    muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'pull',
    mentzerNote: 'Log added weight. Full hang at the bottom.' },
  { name: 'Lat Pulldown',          muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'pull',
    mentzerNote: 'Full stretch at the top, pull to upper chest.' },
  { name: 'Barbell Row',           muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'pull',
    mentzerNote: 'Strict — no body English. Pull to the lower ribs.' },
  { name: 'Dumbbell Row',          muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'pull',
    mentzerNote: 'Log the weight per dumbbell. Full stretch at the bottom.' },
  { name: 'Cable Row',             muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'pull',
    mentzerNote: 'Constant tension. Squeeze the contraction, control the negative.' },
  { name: 'Machine Row',           muscle: 'Back', type: 'compound', repRange: [6, 10], hd2Core: false, region: 'upper', pattern: 'pull',
    mentzerNote: 'Fixed path. Safe to take to true failure.' },
];

// Names used by the programme setup screens (and older saved routines/templates)
// mapped to the canonical library name, so nothing is silently dropped.
const ALIASES = {
  'Barbell Squat':                 'Squats',
  'Squat':                         'Squats',
  'Deadlift':                      'Deadlifts',
  'Dips':                          'Weighted Dips',
  'Leg Extension':                 'Leg Extensions',
  'Leg Curl':                      'Leg Curls',
  'Close Grip Underhand Pulldown': 'Close-Grip Pulldowns',
  'Lateral Raise':                 'Dumbbell Lateral Raises',
  'Standing Calf Raise':           'Standing Calf Raises',
  'Bench Press':                   'Flat Bench Press',
  'Push-Ups (Weighted)':           'Weighted Push Ups',
};

const BY_NAME = new Map(EXERCISES.map(e => [e.name.toLowerCase(), e]));

// Resolve any stored exercise name to a library entry. Unknown names get a safe
// generic entry (HD2 6-10 rep range) rather than being dropped from the workout.
export const findExercise = (name) => {
  if (!name) return null;
  const trimmed = String(name).trim();
  const canonical = ALIASES[trimmed] || trimmed;
  const hit = BY_NAME.get(canonical.toLowerCase());
  if (hit) return hit;
  return {
    name: trimmed,
    muscle: 'Other',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: false,
    region: 'upper',
    mentzerNote: null,
  };
};

export const canonicalName = (name) => findExercise(name)?.name ?? name;

export const MUSCLES = [...new Set(EXERCISES.map(e => e.muscle))];

export const HD2_CORE_EXERCISES = EXERCISES.filter(e => e.hd2Core);
