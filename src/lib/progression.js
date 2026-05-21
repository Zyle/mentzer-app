// Core Mentzer progression logic

export const analyzeSet = (exercise, weightKg, reps, previousBest) => {
  const { repRange } = exercise;
  const [minReps, maxReps] = repRange;
  const result = {
    nextWeight: weightKg,
    nextReps: null,
    message: '',
    action: '',
    restDays: 4,
  };

  // Determine progression action
  if (reps < minReps) {
    // Below minimum — reduce weight
    const newWeight = Math.round((weightKg * 0.9) * 4) / 4;
    result.nextWeight = newWeight;
    result.action = 'reduce';
    result.message = `You fell below ${minReps} reps. Reduce to ${newWeight}kg next session and push to failure.`;
  } else if (reps > maxReps) {
    // Above maximum — increase weight
    const newWeight = Math.round((weightKg * 1.1) * 4) / 4;
    result.nextWeight = newWeight;
    result.action = 'increase';
    result.message = `You hit ${reps} reps — above the maximum range. Increase to ${newWeight}kg next session. Expect ${minReps}-${Math.min(reps - 2, maxReps)} reps.`;
  } else {
    // Within range — same weight, push to absolute failure
    result.nextWeight = weightKg;
    result.action = 'maintain';
    result.message = `Stay at ${weightKg}kg. Push to absolute failure — do not count reps, just go until you cannot.`;
  }

  // Check for progression vs previous best
  if (previousBest) {
    if (weightKg > previousBest.weight_kg) {
      result.progressNote = 'New weight personal best.';
    } else if (reps > previousBest.reps && weightKg === previousBest.weight_kg) {
      result.progressNote = 'New rep personal best at this weight.';
    } else if (reps < previousBest.reps && weightKg === previousBest.weight_kg) {
      result.progressNote = 'Reps dropped from last session. Check your rest, sleep and calories.';
      result.restDays = 5;
    }
  }

  return result;
};

export const getRestRecommendation = (exerciseName, daysSinceLastWorkout, progressionRate) => {
  // Base rest by exercise type
  let baseDays = 4;

  const highDemandExercises = ['Squats', 'Deadlift', 'Leg Press'];
  if (highDemandExercises.includes(exerciseName)) {
    baseDays = 5;
  }

  // Adjust based on progression rate
  if (progressionRate === 'every_session') baseDays = 4;
  if (progressionRate === 'every_other') baseDays = 5;
  if (progressionRate === 'slow') baseDays = 6;
  if (progressionRate === 'plateau') baseDays = 7;

  return baseDays;
};

export const getRecoveryStatus = (daysSinceWorkout) => {
  if (daysSinceWorkout === 0) {
    return {
      status: 'recovering',
      message: 'Workout complete. Get out of the gym. Growth begins now.',
      emoji: '💪',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 1) {
    return {
      status: 'repairing',
      message: 'Day 1 of recovery. Muscle fibres are repairing. Your only job today is to rest.',
      emoji: '🔧',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 2) {
    return {
      status: 'rebuilding',
      message: 'Day 2. Supercompensation is beginning. Your body is actively rebuilding muscle tissue.',
      emoji: '⚡',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 3) {
    return {
      status: 'growing',
      message: 'Day 3. Your body is building additional muscle beyond its previous capacity. Stay patient.',
      emoji: '📈',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 4) {
    return {
      status: 'ready_soon',
      message: 'Day 4. Growth phase completing. Prepare for your next session.',
      emoji: '🎯',
      readyToTrain: true,
    };
  } else {
    return {
      status: 'ready',
      message: 'You are fully recovered and ready to train. Do not wait any longer.',
      emoji: '✅',
      readyToTrain: true,
    };
  }
};

export const getProgressionRate = (sets) => {
  if (!sets || sets.length < 3) return 'every_session';

  const recent = sets.slice(-6);
  let improvements = 0;

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    if (curr.weight_kg > prev.weight_kg || curr.reps > prev.reps) {
      improvements++;
    }
  }

  const rate = improvements / (recent.length - 1);

  if (rate >= 0.8) return 'every_session';
  if (rate >= 0.5) return 'every_other';
  if (rate >= 0.3) return 'slow';
  return 'plateau';
};
