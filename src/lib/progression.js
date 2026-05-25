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

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// HD2 Recovery Status — minimum 4 days between sessions
export const getRecoveryStatus = (daysSinceWorkout) => {
  if (daysSinceWorkout === 0) {
    return {
      status: 'recovering',
      message: pick([
        'Training has broken the muscle down and depleted your entire system. Growth hasn\'t started yet — that comes later.',
        'Your muscles are at their weakest right now. Your body is in recovery mode — don\'t give it more to deal with.',
        'The damage is done — now stay out of the way. Every hour of rest and every gram of protein goes towards rebuilding.',
      ]),
      emoji: '💪',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 1) {
    return {
      status: 'repairing',
      message: pick([
        'The tears are being stitched back together. Your body is patching the damage — training now would just rip it open again.',
        'Repair is underway. The broken fibres are being rebuilt, but they\'re not ready yet — give it time.',
        'Your body is using protein to rebuild the damaged tissue. Let it finish the job.',
      ]),
      emoji: '🔧',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 2) {
    return {
      status: 'rebuilding',
      message: pick([
        'The fibres are nearly back to where they were. Your body is close to baseline — the growth phase is just around the corner.',
        'Repairs are almost done. The muscle is rebuilding to its previous level before it can grow beyond it.',
        'The tissue is being restored. Once it\'s back to where it was, your body starts building it stronger.',
      ]),
      emoji: '⚡',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 3) {
    return {
      status: 'growing',
      message: pick([
        'This is where the actual growth happens. Your muscle has been repaired and is now being built back stronger than before.',
        'Your body has fixed the damage and is now overcompensating — adding more muscle than was there before.',
        'The muscle is now growing past its previous size. This is the whole point — don\'t interrupt it.',
      ]),
      emoji: '📈',
      readyToTrain: false,
    };
  } else if (daysSinceWorkout === 4) {
    return {
      status: 'almost',
      message: pick([
        'Recovery is nearly complete. You may train today if you feel fully recovered. When in doubt, wait one more day.',
        'You\'re close to peak. Mentzer\'s minimum was Day 4 — if there\'s any doubt, one more day costs nothing.',
        'Almost there. The muscle is rebuilt and close to its peak. Listen to your body — if it\'s ready, train.',
      ]),
      emoji: '🎯',
      readyToTrain: true,
    };
  } else if (daysSinceWorkout === 5) {
    return {
      status: 'ready',
      message: pick([
        'You\'re fully recovered and stronger than last session. Get in, hit one set to failure, and leave.',
        'The muscle is rebuilt and peaked. Any longer and it starts declining — train today.',
        'Recovery is complete. Your body is primed and waiting. One set, maximum effort, done.',
      ]),
      emoji: '✅',
      readyToTrain: true,
    };
  } else if (daysSinceWorkout === 6) {
    return {
      status: 'ready',
      message: pick([
        'You\'re fully recovered and stronger than last session. Get in, hit one set to failure, and leave.',
        'The muscle is rebuilt and peaked. Any longer and it starts declining — train today.',
        'Recovery is complete. Your body is primed and waiting. One set, maximum effort, done.',
      ]),
      emoji: '✅',
      readyToTrain: true,
    };
  } else if (daysSinceWorkout === 7) {
    return {
      status: 'overdue',
      message: pick([
        'You\'ve missed the peak. The muscle your body built is slowly being broken back down. Train now.',
        'Your body built you up and you didn\'t use it. It\'s starting to take it back — get to the gym.',
        'Past your window. The gains from your last session are fading. Train as soon as possible.',
      ]),
      emoji: '⚠️',
      readyToTrain: true,
    };
  } else {
    return {
      status: 'overdue',
      message: pick([
        'You\'ve missed the peak. The muscle your body built is slowly being broken back down. Train now.',
        'Your body built you up and you didn\'t use it. It\'s starting to take it back — get to the gym.',
        'Past your window. The gains from your last session are fading. Train as soon as possible.',
      ]),
      emoji: '🚨',
      readyToTrain: true,
    };
  }
};

