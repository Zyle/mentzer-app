// HD2 Consolidated Routine — Mike Mentzer's most refined system
// One set per exercise, to absolute failure, every 4-7 days

export const EXERCISES = [
  // ── CORE HD2 EXERCISES ──────────────────────────────────────────
  // Legs
  {
    name: 'Squats',
    muscle: 'Legs',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    mentzerNote: 'The king of all exercises. Mentzer called this the single best muscle-builder. Go below parallel, full ROM.',
  },
  {
    name: 'Leg Press',
    muscle: 'Legs',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    mentzerNote: 'Primary alternative to Squats. Go full range of motion. Do not lock knees at top.',
  },
  {
    name: 'Deadlifts',
    muscle: 'Back',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    mentzerNote: 'Works more muscle than any other single exercise. Full body stimulus. Keep back straight, drive through heels.',
  },

  // Back / Pull
  {
    name: 'Close-Grip Pulldowns',
    muscle: 'Back',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    mentzerNote: 'Mentzer\'s preferred back movement. Supinated grip, pull to upper chest, full stretch at top.',
  },
  {
    name: 'Weighted Chin-Ups',
    muscle: 'Back',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    mentzerNote: 'Alternative to pulldowns. Add weight via belt. Full hang at bottom, chin over bar at top.',
  },

  // Chest / Push
  {
    name: 'Weighted Dips',
    muscle: 'Chest',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: true,
    mentzerNote: 'Mentzer\'s preferred chest movement. Lean forward slightly, go all the way down, full stretch at bottom.',
  },
  {
    name: 'Incline Press',
    muscle: 'Chest',
    type: 'compound',
    repRange: [6, 10],
    hd2Core: false,
    mentzerNote: 'Alternative to Dips. 30-45 degree incline. Focus on chest contraction, not shoulder involvement.',
  },

  // ── PRE-EXHAUSTION ISOLATION (used before compound) ─────────────
  {
    name: 'Leg Extensions',
    muscle: 'Legs',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    preExhaustFor: 'Leg Press',
    mentzerNote: 'Pre-exhaust isolation before Leg Press. Go immediately to Leg Press with no rest after this.',
  },
  {
    name: 'Leg Curls',
    muscle: 'Legs',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    mentzerNote: 'Hamstring isolation. Can be used as pre-exhaust before Deadlifts.',
  },
  {
    name: 'Pec Deck',
    muscle: 'Chest',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    preExhaustFor: 'Weighted Dips',
    mentzerNote: 'Pre-exhaust isolation before Dips. Fatigues pecs so they fail before triceps in Dips.',
  },
  {
    name: 'Dumbbell Flyes',
    muscle: 'Chest',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    preExhaustFor: 'Weighted Dips',
    mentzerNote: 'Alternative pre-exhaust for chest. Full stretch at bottom.',
  },
  {
    name: 'Dumbbell Pullover',
    muscle: 'Back',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    preExhaustFor: 'Close-Grip Pulldowns',
    mentzerNote: 'Pre-exhaust for back. Stretches lats. Go immediately to Pulldowns after.',
  },

  // ── SUPPLEMENTARY ────────────────────────────────────────────────
  {
    name: 'Dumbbell Lateral Raises',
    muscle: 'Shoulders',
    type: 'isolation',
    repRange: [8, 12],
    hd2Core: false,
    mentzerNote: 'Shoulders get significant stimulation from Dips and Presses. Use sparingly.',
  },
  {
    name: 'Barbell Curls',
    muscle: 'Biceps',
    type: 'isolation',
    repRange: [6, 10],
    hd2Core: false,
    mentzerNote: 'Biceps are heavily worked in all pulling movements. This is supplementary only.',
  },
  {
    name: 'Triceps Pressdowns',
    muscle: 'Triceps',
    type: 'isolation',
    repRange: [6, 10],
    hd2Core: false,
    mentzerNote: 'Triceps are heavily worked in Dips and Presses. This is supplementary only.',
  },
  {
    name: 'Standing Calf Raises',
    muscle: 'Calves',
    type: 'isolation',
    repRange: [12, 20],
    hd2Core: false,
    mentzerNote: 'Calves respond to higher reps. Full stretch at bottom, full contraction at top.',
  },
  {
    name: 'Shrugs',
    muscle: 'Traps',
    type: 'isolation',
    repRange: [6, 10],
    hd2Core: false,
    mentzerNote: 'Traps are heavily stimulated by Deadlifts. Use only if lagging.',
  },
];

export const MUSCLES = [...new Set(EXERCISES.map(e => e.muscle))];

export const HD2_CORE_EXERCISES = EXERCISES.filter(e => e.hd2Core);
