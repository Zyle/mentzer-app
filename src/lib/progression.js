// Mike Mentzer HD2 Progression Logic
// One set to absolute failure. Rest 4-7 days. Progress every session.

export const analyzeSet = (exercise, weightKg, reps, previousBest) => {
  const { repRange } = exercise;
  const [minReps, maxReps] = repRange;

  const result = {
    nextWeight: weightKg,
    action: '',
    message: '',
    progressNote: null,
    restDays: 4,
  };

  // HD2 Progression Rule:
  // Below min reps → reduce 10%
  // Within range → same weight, push to absolute failure again
  // Above max reps → increase 10%

  if (reps < minReps) {
    const newWeight = Math.round((weightKg * 0.9) * 4) / 4;
    result.nextWeight = newWeight;
    result.action = 'reduce';
    result.restDays = 5;
    result.message = `Fell below ${minReps} reps. Reduce to ${newWeight}kg next session. Failure came too early — either the weight was too heavy or recovery was incomplete. Ensure full ${result.restDays}+ days rest.`;
  } else if (reps > maxReps) {
    const newWeight = Math.round((weightKg * 1.1) * 4) / 4;
    result.nextWeight = newWeight;
    result.action = 'increase';
    result.restDays = 4;
    result.message = `${reps} reps — above the target range. Increase to ${newWeight}kg next session. This is progress. Rest a minimum of ${result.restDays} days before training again.`;
  } else {
    result.nextWeight = weightKg;
    result.action = 'maintain';
    result.restDays = 4;
    result.message = `Stay at ${weightKg}kg. Push to absolute muscular failure — not near failure, not comfortable failure. The point at which another rep is physically impossible.`;
  }

  // High-demand exercises need more rest
  const highDemandExercises = ['Squats', 'Deadlifts', 'Leg Press'];
  if (highDemandExercises.includes(exercise.name)) {
    result.restDays = Math.max(result.restDays, 5);
    result.message += ` ${exercise.name} taxes the entire system — take at least ${result.restDays} days before your next session.`;
  }

  // Check progress vs previous best
  if (previousBest) {
    if (weightKg > previousBest.weight_kg) {
      result.progressNote = `New weight PR. Up from ${previousBest.weight_kg}kg.`;
    } else if (reps > previousBest.reps && weightKg === previousBest.weight_kg) {
      result.progressNote = `New rep PR at this weight. Up from ${previousBest.reps} reps.`;
    } else if (reps < previousBest.reps && weightKg === previousBest.weight_kg) {
      result.progressNote = `Reps dropped from ${previousBest.reps}. Check rest, sleep and calorie intake. Consider adding an extra rest day next time.`;
      result.restDays = Math.max(result.restDays + 1, 6);
    }
  }

  return result;
};

// HD2 Recovery Status — minimum 4 days between sessions
export const getRecoveryStatus = (daysSinceWorkout) => {
  if (daysSinceWorkout === 0) {
    return {
      status: 'recovering',
      message: 'Leave the gym. Growth begins now — not when you train more.',
      emoji: '💪',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 1) {
    return {
      status: 'repairing',
      message: 'Muscle fibres are being repaired. Rest is not laziness — it is the work.',
      emoji: '🔧',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 2) {
    return {
      status: 'rebuilding',
      message: 'Your body is rebuilding beyond its previous state. Any training today interrupts this.',
      emoji: '⚡',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 3) {
    return {
      status: 'growing',
      message: 'Supercompensation is occurring. Your muscles are growing stronger. Stay out of the gym.',
      emoji: '📈',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 4) {
    return {
      status: 'almost',
      message: 'Recovery is nearly complete. When in doubt, wait one more day.',
      emoji: '🎯',
      readyToTrain: true,
    };
  } else if (daysSinceWorkout === 5) {
    return {
      status: 'ready',
      message: 'Fully recovered. One set per exercise, maximum intensity, then leave.',
      emoji: '✅',
      readyToTrain: true,
    };
  } else if (daysSinceWorkout === 6) {
    return {
      status: 'ready',
      message: 'Peak supercompensation. Today is your ideal training day.',
      emoji: '✅',
      readyToTrain: true,
    };
  } else if (daysSinceWorkout === 7) {
    return {
      status: 'overdue',
      message: 'Train today. Waiting longer will not improve growth — supercompensation has peaked.',
      emoji: '⚠️',
      readyToTrain: true,
    };
  } else {
    return {
      status: 'overdue',
      message: `Day ${daysSinceWorkout}. You are past your optimal window. Train as soon as possible.`,
      emoji: '🚨',
      readyToTrain: true,
    };
  }
};

