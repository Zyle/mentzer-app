export const EXERCISES = [
  // Chest
  { name: 'Weighted Dips', muscle: 'Chest', type: 'compound', repRange: [3, 5] },
  { name: 'Incline Press', muscle: 'Chest', type: 'compound', repRange: [6, 10] },
  { name: 'Dumbbell Flyes', muscle: 'Chest', type: 'isolation', repRange: [6, 10] },
  { name: 'Pec Deck', muscle: 'Chest', type: 'isolation', repRange: [6, 10] },
  { name: 'Cable Crossover', muscle: 'Chest', type: 'isolation', repRange: [6, 10] },

  // Back
  { name: 'Deadlift', muscle: 'Back', type: 'compound', repRange: [6, 10] },
  { name: 'Close-Grip Pulldown', muscle: 'Back', type: 'compound', repRange: [6, 10] },
  { name: 'Bent-over Barbell Row', muscle: 'Back', type: 'compound', repRange: [6, 10] },
  { name: 'Dumbbell Pullover', muscle: 'Back', type: 'isolation', repRange: [6, 10] },
  { name: 'Nautilus Pullover', muscle: 'Back', type: 'isolation', repRange: [6, 10] },
  { name: 'Hyperextensions', muscle: 'Back', type: 'isolation', repRange: [6, 10] },

  // Legs
  { name: 'Squats', muscle: 'Legs', type: 'compound', repRange: [6, 10] },
  { name: 'Leg Press', muscle: 'Legs', type: 'compound', repRange: [6, 10] },
  { name: 'Leg Extensions', muscle: 'Legs', type: 'isolation', repRange: [6, 10] },
  { name: 'Leg Curls', muscle: 'Legs', type: 'isolation', repRange: [6, 10] },
  { name: 'Standing Calf Raises', muscle: 'Legs', type: 'isolation', repRange: [12, 20] },

  // Shoulders
  { name: 'Dumbbell Lateral Raises', muscle: 'Shoulders', type: 'isolation', repRange: [6, 10] },
  { name: 'Bent-over Lateral Raises', muscle: 'Shoulders', type: 'isolation', repRange: [6, 10] },

  // Biceps
  { name: 'Barbell Curls', muscle: 'Biceps', type: 'isolation', repRange: [6, 10] },

  // Triceps
  { name: 'Triceps Pressdowns', muscle: 'Triceps', type: 'isolation', repRange: [6, 10] },
  { name: 'Lying French Press', muscle: 'Triceps', type: 'isolation', repRange: [6, 10] },

  // Traps / Core
  { name: 'Shrugs', muscle: 'Traps', type: 'isolation', repRange: [6, 10] },
  { name: 'Sit-Ups', muscle: 'Core', type: 'isolation', repRange: [10, 20] },
];

export const MUSCLES = [...new Set(EXERCISES.map(e => e.muscle))];
