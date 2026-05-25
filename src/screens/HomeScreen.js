import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Modal, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Path, Line, Text as SvgText } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getRecoveryStatus } from '../lib/progression';
import { getRandomQuote } from '../data/quotes';
import Card from '../components/Card';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

// ── Dev override ───────────────────────────────────────────────────────────────
const DEV_HOURS_SINCE = null;

// ── Phase metadata ─────────────────────────────────────────────────────────────
const PHASE_META = {
  recovering: { label: 'RECOVERING',     color: '#e05c5c' },
  repairing:  { label: 'REPAIRING',      color: '#e07a3a' },
  rebuilding: { label: 'REBUILDING',     color: '#c9a84c' },
  growing:    { label: 'GROWING',        color: '#8aad5c' },
  almost:     { label: 'ALMOST READY',   color: '#4CAF50' },
  ready:      { label: 'READY TO TRAIN', color: '#4CAF50' },
  overdue:    { label: 'OVERDUE',        color: '#888'    },
};

// ── Readiness helpers ──────────────────────────────────────────────────────────
// Returns 0.0 → 1.0 based on hours since last workout (supercompensation curve)
const calcReadiness = hours => {
  if (hours === null || isNaN(hours)) return 1.0; // never trained → fully ready
  const days = hours / 24;
  if (days <= 0)   return 0.02;
  if (days <= 2)   return 0.02 + (days / 2) * 0.13;            // 2% → 15%
  if (days <= 3)   return 0.15 + (days - 2) * 0.15;            // 15% → 30%
  if (days <= 4)   return 0.30 + (days - 3) * 0.35;            // 30% → 65%
  if (days <= 5.5) return 0.65 + ((days - 4) / 1.5) * 0.35;   // 65% → 100%
  if (days <= 7.5) return 1.0;                                  // peak window
  return Math.max(0.65, 1.0 - ((days - 7.5) / 4.5) * 0.35);   // slowly declining
};

// Linearly interpolate between two RGB triples
const _lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const _rgb  = ([r, g, b]) => `rgb(${r},${g},${b})`;

// Colour stops: dark → vivid-red → orange → amber → gold → green
const READINESS_STOPS = [
  [0.00, [18,  18,  18 ]],
  [0.25, [215, 30,  20 ]],
  [0.50, [225, 85,  20 ]],
  [0.70, [210, 145, 30 ]],
  [0.87, [201, 168, 76 ]],
  [1.00, [76,  175, 80 ]],
];
const readinessColor = r => {
  const stops = READINESS_STOPS;
  for (let i = 0; i < stops.length - 1; i++) {
    if (r <= stops[i + 1][0]) {
      const t = (r - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      return _rgb(_lerp(stops[i][1], stops[i + 1][1], t));
    }
  }
  return _rgb(stops[stops.length - 1][1]);
};

// Warning copy based on readiness level
const getWarningCopy = readiness => {
  if (readiness < 0.35) return {
    title:   'TOO SOON',
    message: 'Your muscles are still in the early recovery phase. Training now cuts the process short and can set back your gains. Mentzer was adamant — rest is where growth actually happens.',
  };
  if (readiness < 0.65) return {
    title:   'NOT THERE YET',
    message: "You're in the repair phase but supercompensation hasn't peaked. Give it another day or two and every rep will produce more results than training right now.",
  };
  return {
    title:   'ALMOST READY',
    message: "You're close to your optimal window. One more day and you'll be training at peak capacity. But if you must — go for it.",
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const toLocalISO = d => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};

// Supabase returns microsecond timestamps e.g. "2025-05-25T20:30:00.531664+00:00"
// Hermes (React Native JS engine) only handles milliseconds — truncate before parsing
const parseSupabaseDate = str => {
  if (!str) return new Date(NaN);
  return new Date(str.replace(/(\.\d{3})\d*(Z|[+-]\d{2}:\d{2})$/, '$1$2'));
};

const calcTDEE = p => {
  if (!p?.bodyweight_kg || !p?.height_cm || !p?.age) return null;
  const bmr = 10*p.bodyweight_kg + 6.25*p.height_cm - 5*p.age + (p.sex === 'male' ? 5 : -161);
  return Math.round(bmr * 1.375);
};
const calcCalories = p => { const t = calcTDEE(p); return t ? t + (p.calorie_adjustment||0) : null; };

function getTodayLabel() {
  const D = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const M = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const n = new Date();
  return `${D[n.getDay()]} · ${M[n.getMonth()]} ${n.getDate()}`;
}
function fmtTimeSince(h) {
  if (h === null || h === undefined || isNaN(h)) return 'No workouts logged yet';
  const d = Math.floor(h/24), hrs = Math.floor(h%24);
  if (d === 0) return `${hrs}h since last workout`;
  if (hrs === 0) return `${d}d since last workout`;
  return `${d}d ${hrs}h since last workout`;
}

// ── HD Score config ────────────────────────────────────────────────────────────
const PILLAR_DEFS = [
  { key: 'rest',      icon: 'clock',        label: 'REST',      color: '#60A5FA' },
  { key: 'routine',   icon: 'check-circle', label: 'ROUTINE',   color: '#A78BFA' },
  { key: 'nutrition', icon: 'target',       label: 'NUTRITION', color: '#34D399' },
];

const RANGE_OPTIONS = [
  { label: '7D',  days: 7   },
  { label: '14D', days: 14  },
  { label: '30D', days: 30  },
  { label: '3M',  days: 90  },
  { label: '6M',  days: 180 },
];

const overallColor = s => s >= 80 ? '#4ADE80' : s >= 60 ? '#FBBF24' : '#F87171';
const getScoreLabel = s =>
  s >= 90 ? 'OPTIMAL' : s >= 75 ? 'DISCIPLINED' : s >= 60 ? 'ON TRACK' : s >= 40 ? 'NEEDS WORK' : 'OFF PROGRAM';


// ── Timestamp helper ───────────────────────────────────────────────────────────
const wTs = w => parseSupabaseDate(w.date || w.created_at || '').getTime();

// ── Score calculations ─────────────────────────────────────────────────────────
const calcRestScore = workouts => {
  if (workouts.length < 2) return null;
  const sorted = [...workouts].sort((a, b) => wTs(a) - wTs(b));
  const scores = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = (wTs(sorted[i]) - wTs(sorted[i-1])) / 86400000;
    if      (days >= 4 && days <= 7)   scores.push(100);
    else if (days > 7  && days <= 10)  scores.push(80);
    else if (days > 10 && days <= 14)  scores.push(60);
    else if (days > 14)                scores.push(30);
    else if (days >= 3)                scores.push(20);
    else                               scores.push(0);
  }
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
};

const calcRoutineScore = (workouts, sets, routine) => {
  if (!workouts.length || !routine.length) return null;
  const scores = workouts.map(w => {
    const unique = new Set(sets.filter(s => s.workout_id === w.id).map(s => s.exercise_name)).size;
    return Math.min(unique / routine.length, 1) * 100;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
};

const calcNutritionScore = (calLogs, calTarget, rangeDays) => {
  if (!calTarget || !calLogs.length) return null;
  const byDate = {};
  calLogs.forEach(l => { byDate[l.date] = (byDate[l.date] || 0) + l.calories; });
  let daysOn = 0;
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const consumed = byDate[toLocalISO(d)] || 0;
    if (consumed >= calTarget * 0.85 && consumed <= calTarget * 1.15) daysOn++;
  }
  return Math.round((daysOn / rangeDays) * 100);
};

// ── Tip helpers — one per pillar ───────────────────────────────────────────────

const getRestTip = rangeWkts => {
  if (rangeWkts.length < 2) return null;
  const sorted = [...rangeWkts].sort((a, b) => wTs(a) - wTs(b));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++)
    gaps.push((wTs(sorted[i]) - wTs(sorted[i-1])) / 86400000);

  const avg    = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const stdDev = Math.sqrt(gaps.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / gaps.length);

  // Mixed pattern: some gaps way too short, some way too long
  if (gaps.some(g => g < 4) && gaps.some(g => g > 10) && stdDev > 3)
    return "Your rest gaps are all over the place — some sessions are back-to-back while others are two weeks apart. A steady 4-7 day rhythm every session is where the real gains live. Consistency is everything here.";

  if (avg < 0.5)  return "The effort is real — the timing just needs adjusting. Growth happens after you train, not during. Two sessions the same day mean the muscle never gets its recovery window. Give it 4 full days and every rep will hit harder.";
  if (avg < 1)    return "You're putting in serious work. Your muscles do their actual growing in the 96 hours after a session — not during it. Getting back before that window closes means less output for the same effort. Rest up and come back stronger.";
  if (avg < 2)    return "Your drive to train is a real asset — now let it work for you in recovery too. Mentzer showed 4 days minimum is when supercompensation begins. One more rest day between sessions and each workout will hit significantly harder.";
  if (avg < 3)    return "You're almost at the sweet spot — just one more day of rest between sessions unlocks the full recovery cycle. Supercompensation doesn't start rising until around day 4. You're so close.";
  if (avg < 4)    return "Nearly there. Most sessions are landing around day 3 and Mentzer's minimum is 4. One extra rest day is a small change with a meaningful payoff.";
  if (avg <= 7)   return null; // optimal
  if (avg <= 10)  return "Your rest window is slightly extended, but you're still in great shape. Supercompensation peaks around day 5-6 — when life allows, try to get back in before day 8 to catch that window at its highest.";
  if (avg <= 14)  return "Life gets busy and getting back in the gym is always the win. When you can, aim for that day 5-7 window — that's when the body is primed and ready. You've got this.";
  if (avg <= 21)  return "The fact that you're back is what matters. Mentzer's whole system only asks for one focused session every 5-7 days — it's one of the most manageable training commitments out there. You can do this.";
  return "Coming back is the hardest step and you've done it. One focused session every 5-7 days is genuinely all Mentzer ever prescribed. You've got everything you need to make this work consistently.";
};

const getRoutineTip = (rangeWkts, allSets, userRoutine) => {
  if (!rangeWkts.length || !userRoutine.length) return null;

  const completions = rangeWkts.map(w => {
    const unique = new Set(allSets.filter(s => s.workout_id === w.id).map(s => s.exercise_name)).size;
    return unique / userRoutine.length;
  });
  const avg       = completions.reduce((a, b) => a + b, 0) / completions.length;
  const pct       = Math.round(avg * 100);
  const rLen      = userRoutine.length;
  const avgDone   = Math.max(1, Math.round(avg * rLen));
  const missing   = rLen - avgDone;
  const stdDev    = Math.sqrt(completions.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / completions.length);

  // Inconsistency: sometimes complete, sometimes not
  if (stdDev > 0.25 && avg > 0.6)
    return "Some sessions you nail the full routine — that's the standard to aim for every time. On the sessions where you fall short, finishing just one more exercise moves the needle. Consistency over perfection.";

  // Workouts with no sets recorded at all
  const emptySessions = rangeWkts.filter(w => !allSets.some(s => s.workout_id === w.id)).length;
  if (emptySessions > 0 && emptySessions >= rangeWkts.length * 0.3)
    return `${emptySessions} session${emptySessions > 1 ? 's' : ''} in this period ${emptySessions > 1 ? 'have' : 'has'} no exercises recorded. Make sure to log your sets during the workout — the app can only track what it knows about.`;

  if (pct <= 25)  return "Every exercise in your routine targets a specific stimulus no other movement can replicate. Try adding just one more exercise each session — small additions compound fast.";
  if (pct <= 50)  return `Good foundation — now build on it. You're averaging ${avgDone} out of ${rLen} exercises. The remaining ${missing} are receiving no stimulus this period. Add one or two more each session.`;
  if (pct <= 75)  return `You're getting through a solid amount each session. Those last ${missing} exercise${missing !== 1 ? 's are' : ' is'} worth pushing for — each one hits something the others don't. Finishing strong every session is the next level.`;
  if (pct <= 90)  return `You're close — just ${missing} exercise${missing !== 1 ? 's' : ''} short of a complete routine each session. Mentzer put each one in your program deliberately. Push to the end.`;
  return "Almost perfect. That final exercise is the last piece of the puzzle Mentzer built your routine around. Make every session complete.";
};

const getNutritionTip = (rangeLogs, calTarget, rangeDays, goal) => {
  if (!calTarget) return null;

  // Never tracked
  if (!rangeLogs.length)
    return "Once you start logging your meals, this score comes to life immediately. Even rough estimates give the system everything it needs. Try logging today's meals.";

  const byDate = {};
  rangeLogs.forEach(l => { byDate[l.date] = (byDate[l.date] || 0) + l.calories; });
  const loggedDays    = Object.keys(byDate).length;
  const logRate       = loggedDays / rangeDays;
  const dailyIntakes  = Object.values(byDate);
  const avgConsumed   = Math.round(dailyIntakes.reduce((a, b) => a + b, 0) / dailyIntakes.length);
  const diff          = calTarget - avgConsumed;   // positive = under, negative = over
  const pctDiff       = diff / calTarget;
  const cv            = Math.sqrt(dailyIntakes.reduce((a, b) => a + Math.pow(b - avgConsumed, 2), 0) / dailyIntakes.length) / avgConsumed;

  // Low logging rate
  if (logRate < 0.25)
    return `You've only tracked ${loggedDays} out of ${rangeDays} days. Log your first meal each day and the rest tends to follow — you'll be surprised how quickly the habit forms.`;
  if (logRate < 0.5)
    return `You're building the logging habit — ${loggedDays} out of ${rangeDays} days this period. The more consistent the tracking, the more useful every number becomes. You're on the right track.`;
  if (logRate < 0.75) {
    // Good intake on logged days? Acknowledge effort
    if (Math.abs(pctDiff) < 0.15)
      return `On the days you log, your intake looks great. The opportunity is just making it daily — you're already doing the hard part. Track every day and your score will reflect your actual effort.`;
    return `You're tracking ${loggedDays} out of ${rangeDays} days. Making it a daily habit is the next step — consistent tracking is what gives this score its accuracy.`;
  }

  // Good logging rate — analyse intake vs target
  // In range but inconsistent day-to-day
  if (Math.abs(pctDiff) < 0.08 && cv > 0.25)
    return `Your average intake is right on target — the opportunity is consistency day to day. Your body responds better to a steady ${calTarget.toLocaleString()} kcal every day than swinging above and below across the week.`;

  // Under target
  if (pctDiff > 0.20) {
    if (goal === 'cut') return `You're averaging ${avgConsumed.toLocaleString()} kcal — ${diff.toLocaleString()} below your cutting target. A deficit this deep risks breaking down muscle alongside fat. Mentzer prioritised protecting muscle above everything. Keep the deficit controlled.`;
    return `You're averaging ${avgConsumed.toLocaleString()} kcal — ${diff.toLocaleString()} kcal short of your ${calTarget.toLocaleString()} target. Without enough fuel, muscle growth stalls regardless of how hard you train. Eating more is as important as any rep in the gym.`;
  }
  if (pctDiff > 0.08) {
    if (goal === 'cut') return `You're slightly under your cutting target — averaging ${avgConsumed.toLocaleString()} kcal. If this is intentional, make sure protein stays high to protect the muscle you've built.`;
    return `You're averaging ${avgConsumed.toLocaleString()} kcal — about ${diff.toLocaleString()} kcal short of your ${calTarget.toLocaleString()} target. Bringing it up slightly gives your body what it needs to recover fully between sessions.`;
  }

  // Over target
  if (pctDiff < -0.20) {
    if (goal === 'bulk') return `You're averaging ${avgConsumed.toLocaleString()} kcal — ${Math.abs(diff).toLocaleString()} over your bulk target. Even bulking, calories beyond what muscle synthesis can use tend to store as fat. Pull back slightly towards ${calTarget.toLocaleString()} kcal.`;
    return `You're averaging ${avgConsumed.toLocaleString()} kcal — ${Math.abs(diff).toLocaleString()} over your ${calTarget.toLocaleString()} target. Bringing it back down keeps your body composition moving in the right direction.`;
  }
  if (pctDiff < -0.08) {
    if (goal === 'bulk') return `You're slightly over your bulk target — averaging ${avgConsumed.toLocaleString()} kcal. A small surplus is ideal for building. Just keep it controlled to minimise excess fat gain.`;
    return `You're averaging ${avgConsumed.toLocaleString()} kcal — slightly over your ${calTarget.toLocaleString()} target. Trimming ${Math.abs(diff).toLocaleString()} kcal daily keeps everything dialled in.`;
  }

  // Intake is in range and logging is consistent — no tip needed for nutrition
  return null;
};

// ── Master constructive tip ────────────────────────────────────────────────────
const getConstructiveTip = (scores, rangeWkts, allSets, rangeLogs, calTarget, rangeDays, profile, allWorkouts) => {
  const { rest, routine, nutrition } = scores;
  const nonNull = [rest, routine, nutrition].filter(v => v !== null);

  // Suppress tip when all active pillars are performing well
  if (nonNull.length && nonNull.every(v => v >= 80)) return null;

  // ── No workouts in the selected range ────────────────────────────────────────
  if (rangeWkts.length === 0) {
    return allWorkouts.length > 0
      ? "You haven't logged any sessions in this period. Get back in the gym and your full score will start building again."
      : "Log your first workout to start generating your score. Mentzer's system needs a few sessions to analyse your training pattern.";
  }

  // ── Only 1 workout in range (can't calculate rest yet) ───────────────────────
  if (rangeWkts.length === 1) {
    // Prioritise nutrition tip if it's clearly the issue
    if (nutrition !== null && nutrition < 60) {
      const nutTip = getNutritionTip(rangeLogs, calTarget, rangeDays, profile?.goal);
      if (nutTip) return nutTip;
    }
    return "Log your next session and your rest score will calculate from there. One more workout and the full picture comes into focus.";
  }

  // ── Limited data warning ──────────────────────────────────────────────────────
  const earliestTs   = allWorkouts.length ? Math.min(...allWorkouts.map(w => wTs(w))) : Date.now();
  const dataSpanDays = (Date.now() - earliestTs) / 86400000;
  const limitedData  = dataSpanDays < rangeDays * 0.4 && dataSpanDays < rangeDays - 7;

  // ── Find weakest pillar ───────────────────────────────────────────────────────
  const weakest = PILLAR_DEFS
    .map(p => ({ key: p.key, score: scores[p.key] }))
    .filter(p => p.score !== null)
    .sort((a, b) => a.score - b.score)[0];

  if (!weakest) return null;

  let tip = null;
  if (weakest.key === 'rest')      tip = getRestTip(rangeWkts);
  if (weakest.key === 'routine')   tip = getRoutineTip(rangeWkts, allSets, profile?.routine || []);
  if (weakest.key === 'nutrition') tip = getNutritionTip(rangeLogs, calTarget, rangeDays, profile?.goal);

  return tip;
};

// ── HD Score Card ──────────────────────────────────────────────────────────────
function PillarBar({ icon, label, score, pillarColor }) {
  const val    = score ?? 0;
  const active = score !== null;
  return (
    <View style={pb.row}>
      <View style={pb.iconWrap}>
        <Feather name={icon} size={12} color={active ? pillarColor : COLORS.textDim} />
      </View>
      <Text style={pb.label} numberOfLines={1}>{label}</Text>
      <View style={pb.track}>
        <View style={[pb.fill, { width: `${val}%`, backgroundColor: active ? pillarColor : COLORS.border }]} />
      </View>
      <Text style={[pb.val, { color: active ? pillarColor : COLORS.textDim }]}>
        {active ? score : '—'}
      </Text>
    </View>
  );
}
const pb = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  iconWrap: { width: 22, alignItems: 'center' },
  label:    { color: COLORS.textDim, fontSize: 9, letterSpacing: 1.5, width: 90, flexShrink: 0 },
  track:    { flex: 1, height: 3, backgroundColor: COLORS.border, borderRadius: 2, marginHorizontal: 8 },
  fill:     { height: 3, borderRadius: 2 },
  val:      { fontSize: 12, fontWeight: FONT.bold, width: 26, textAlign: 'right' },
});

function HDScoreCard({ allWorkouts, allSets, calLogs, profile }) {
  const [rangeDays, setRangeDays] = useState(30);
  const navigation = useNavigation();

  const cutoffMs    = Date.now() - rangeDays * 24 * 3600 * 1000;
  const cutoffDate  = toLocalISO(new Date(cutoffMs));
  const rangeWkts   = allWorkouts.filter(w => wTs(w) >= cutoffMs);
  const rangeLogs   = calLogs.filter(l => l.date >= cutoffDate);
  const userRoutine = profile?.routine || [];
  const calTarget   = calcCalories(profile);

  const scores = {
    rest:      calcRestScore(rangeWkts),
    routine:   calcRoutineScore(rangeWkts, allSets, userRoutine),
    nutrition: calcNutritionScore(rangeLogs, calTarget, rangeDays),
  };

  const vals     = Object.values(scores).filter(v => v !== null);
  const overall  = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const numColor = overall !== null ? overallColor(overall) : COLORS.textDim;
  const label    = overall !== null ? getScoreLabel(overall) : null;
  const tip      = overall !== null
    ? getConstructiveTip(scores, rangeWkts, allSets, rangeLogs, calTarget, rangeDays, profile, allWorkouts)
    : null;

  return (
    <View style={hd.wrap}>
      <Text style={hd.title}>HEAVY DUTY SCORE</Text>

      {/* Range chips */}
      <View style={hd.chips}>
        {RANGE_OPTIONS.map(opt => {
          const active = rangeDays === opt.days;
          return (
            <TouchableOpacity
              key={opt.days}
              style={[hd.chip, active && hd.chipActive]}
              onPress={() => setRangeDays(opt.days)}
              activeOpacity={0.7}
            >
              <Text style={[hd.chipText, active && hd.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {overall !== null ? (
        <>
          {/* Score number + label — tap to open detail */}
          <TouchableOpacity
            style={hd.scoreRow}
            onPress={() => navigation.navigate('HDScoreDetail')}
            activeOpacity={0.75}
          >
            <Text style={[hd.number, { color: numColor }]}>
              {overall}<Text style={[hd.outOf, { color: numColor }]}>/100</Text>
            </Text>
            <View style={[hd.labelBadge, { borderColor: numColor + '55', backgroundColor: numColor + '18' }]}>
              <Text style={[hd.labelText, { color: numColor }]}>{label}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={COLORS.textDim} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {/* Pillar bars */}
          <View style={hd.pillars}>
            {PILLAR_DEFS.map(p => (
              <PillarBar key={p.key} icon={p.icon} label={p.label}
                score={scores[p.key]} pillarColor={p.color} />
            ))}
          </View>

          {tip && <Text style={hd.tipText}>{tip}</Text>}
        </>
      ) : (
        <Text style={hd.empty}>Log your first workout to see your score.</Text>
      )}
    </View>
  );
}
const hd = StyleSheet.create({
  wrap:           {},
  title:          { color: COLORS.white, fontSize: 11, fontWeight: FONT.bold, letterSpacing: 3, marginBottom: 10 },
  chips:          { flexDirection: 'row', gap: 6, marginBottom: 14 },
  chip:           { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                    borderWidth: 1, borderColor: COLORS.border },
  chipActive:     { borderColor: COLORS.gold, backgroundColor: COLORS.goldFaint },
  chipText:       { color: COLORS.textDim, fontSize: 9, fontWeight: FONT.bold, letterSpacing: 1 },
  chipTextActive: { color: COLORS.gold },
  scoreRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  number:         { fontSize: 52, fontWeight: FONT.black, letterSpacing: -2 },
  outOf:          { fontSize: 22, fontWeight: FONT.semibold, letterSpacing: -1 },
  labelBadge:     { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  labelText:      { fontSize: 10, fontWeight: FONT.black, letterSpacing: 2 },
  pillars:      { marginBottom: 10 },
  tipText:      { color: '#bbb', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  empty:        { color: '#aaa', fontSize: 12, lineHeight: 18 },
});

// ── Supercompensation curve ────────────────────────────────────────────────────
// SC_DATA — dense lookup table used only for the live dot position (interpCap)
const SC_DATA = [
  [0,    100],[0.25,  97],[0.5,   91],[1.0,   83],[1.5,   76],
  [2.0,   79],[2.5,   88],[3.0,   96],[3.5,  104],[4.0,  111],
  [4.5,  116],[5.0,  120],[5.5,  122],[6.0,  121],[6.5,  118],
  [7.0,  114],[7.5,  110],[8.0,  106],[8.5,  103],[9.0,  101],
  [9.5,  100],[10.0, 100],
];
// SC_CURVE — sparse control points used for drawing the path
const SC_CURVE = [
  [0.0, 100],[1.5, 76],[3.0, 96],[4.5, 116],[5.5, 122],
  [7.0, 114],[9.0, 101],[10.0, 100],
];

function interpCap(d) {
  if (d <= SC_DATA[0][0]) return SC_DATA[0][1];
  if (d >= SC_DATA[SC_DATA.length-1][0]) return SC_DATA[SC_DATA.length-1][1];
  for (let i = 0; i < SC_DATA.length-1; i++) {
    if (d >= SC_DATA[i][0] && d <= SC_DATA[i+1][0]) {
      const t = (d - SC_DATA[i][0]) / (SC_DATA[i+1][0] - SC_DATA[i][0]);
      return SC_DATA[i][1] + t * (SC_DATA[i+1][1] - SC_DATA[i][1]);
    }
  }
  return 100;
}

// Monotone cubic spline (Fritsch-Carlson algorithm).
// Unlike Catmull-Rom, this forces zero tangent at every local extremum so
// the curve NEVER overshoots between data points — no wiggle, no ripple.
function monotoneCubicPath(pts) {
  const n = pts.length;
  if (n < 2) return '';

  // Step 1 — slopes between consecutive points
  const delta = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i+1].x - pts[i].x;
    delta.push(dx === 0 ? 0 : (pts[i+1].y - pts[i].y) / dx);
  }

  // Step 2 — initial tangent estimates
  const m = new Array(n);
  m[0]     = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    // Sign change or flat neighbour → force horizontal tangent (no overshoot)
    m[i] = delta[i-1] * delta[i] <= 0 ? 0 : (delta[i-1] + delta[i]) / 2;
  }

  // Step 3 — Fritsch-Carlson rescaling to guarantee monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) { m[i] = m[i+1] = 0; continue; }
    const a = m[i]   / delta[i];
    const b = m[i+1] / delta[i];
    const h = Math.sqrt(a * a + b * b);
    if (h > 3) { const t = 3 / h; m[i] *= t; m[i+1] *= t; }
  }

  // Step 4 — emit SVG cubic bezier segments
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx  = (pts[i+1].x - pts[i].x) / 3;
    const cp1x = pts[i].x   + dx;
    const cp1y = pts[i].y   + m[i]     * dx;
    const cp2x = pts[i+1].x - dx;
    const cp2y = pts[i+1].y - m[i+1]  * dx;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${pts[i+1].x.toFixed(2)} ${pts[i+1].y.toFixed(2)}`;
  }
  return d;
}
// ── Recovery stage bar ─────────────────────────────────────────────────────────
const STAGE_SEGS = [
  { key: 'recover', label: 'RECOVERING', from: 0,   to: 2.5, color: '#e05c5c' },
  { key: 'repair',  label: 'REPAIRING',  from: 2.5, to: 5.0, color: '#e07a3a' },
  { key: 'rebuild', label: 'REBUILDING', from: 5.0, to: 7.5, color: '#c9a84c' },
  { key: 'ready',   label: 'READY',      from: 7.5, to: 10,  color: '#4CAF50' },
];

function RecoveryStageBar({ hoursSince }) {
  const dayFloat = (hoursSince !== null && !isNaN(hoursSince))
    ? Math.min(hoursSince / 24, 10) : null;

  const activeIdx = dayFloat !== null
    ? STAGE_SEGS.findIndex((s, i) =>
        dayFloat >= s.from && (i === STAGE_SEGS.length - 1 || dayFloat < STAGE_SEGS[i + 1].from))
    : -1;

  const pct = dayFloat !== null ? dayFloat / 10 : null;

  return (
    <View style={st.wrap}>
      {/* Segmented bar + position marker */}
      <View style={{ position: 'relative' }}>
        <View style={st.barRow}>
          {STAGE_SEGS.map((seg, i) => (
            <View
              key={seg.key}
              style={[
                st.seg,
                { flex: seg.to - seg.from,
                  backgroundColor: i === activeIdx ? seg.color + 'bb' : seg.color + '28' },
                i === 0                        && st.segFirst,
                i === STAGE_SEGS.length - 1   && st.segLast,
              ]}
            />
          ))}
        </View>

        {/* White tick marker at exact current position */}
        {pct !== null && (
          <View style={st.tickRow} pointerEvents="none">
            <View style={{ flex: Math.max(pct * 100, 0.01) }} />
            <View style={st.tick} />
            <View style={{ flex: Math.max((1 - pct) * 100, 0.01) }} />
          </View>
        )}
      </View>

      {/* Single active-stage label + day markers */}
      <View style={st.labelRow}>
        <Text style={st.dayMark}>0d</Text>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {activeIdx >= 0 && (
            <Text style={[st.activeLabel, { color: STAGE_SEGS[activeIdx].color }]}>
              {STAGE_SEGS[activeIdx].label}
            </Text>
          )}
        </View>
        <Text style={st.dayMark}>10d</Text>
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  wrap:        { marginTop: 12 },
  barRow:      { flexDirection: 'row', height: 5, gap: 2 },
  seg:         { height: 5 },
  segFirst:    { borderTopLeftRadius:  3, borderBottomLeftRadius:  3 },
  segLast:     { borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  tickRow:     { position: 'absolute', top: -3, left: 0, right: 0,
                 flexDirection: 'row', alignItems: 'center' },
  tick:        { width: 2, height: 11, borderRadius: 1, backgroundColor: '#fff', opacity: 0.9 },
  labelRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  activeLabel: { fontSize: 9, fontWeight: FONT.bold, letterSpacing: 1.5 },
  dayMark:     { color: '#333', fontSize: 8, letterSpacing: 0.5 },
});

function RecoveryChart({ hoursSince, width }) {
  const H=114, PL=6, PR=6, PT=20, PB=18;
  const CW=width-PL-PR, CH=H-PT-PB, MAX_D=10, MIN_C=74, MAX_C=126;
  const toX = d => PL+(d/MAX_D)*CW;
  const toY = c => PT+CH-((c-MIN_C)/(MAX_C-MIN_C))*CH;
  const baseY = toY(100);
  const pixPts = SC_CURVE.map(([d,c]) => ({ x: toX(d), y: toY(c) }));
  const linePath = monotoneCubicPath(pixPts);
  const fillPath = `${linePath} L ${toX(MAX_D)} ${baseY} L ${toX(0)} ${baseY} Z`;
  const dayFloat = hoursSince !== null ? Math.min(hoursSince/24, MAX_D) : null;
  const curX = dayFloat !== null ? toX(dayFloat) : null;
  const curY = dayFloat !== null ? toY(interpCap(dayFloat)) : null;
  const zones = [
    { from:0, to:3,    fill:'#e05c5c10' },
    { from:3, to:4,    fill:'#c9a84c10' },
    { from:4, to:7,    fill:'#4CAF5016' },
    { from:7, to:MAX_D,fill:'#28282820' },
  ];
  if (width <= 0) return null;
  return (
    <Svg width={width} height={H}>
      {zones.map((z,i) => (
        <Rect key={i} x={toX(z.from)} y={PT} width={toX(z.to)-toX(z.from)} height={CH} fill={z.fill} />
      ))}
      <Line x1={PL} y1={baseY} x2={PL+CW} y2={baseY} stroke="#3a3a3a" strokeWidth={1} strokeDasharray="4 3" />
      <SvgText x={PL+3} y={baseY-4} fontSize={7} fill="#444" letterSpacing={1}>BASELINE</SvgText>
      <Path d={fillPath} fill={`${COLORS.gold}0e`} />
      <Path d={linePath} fill="none" stroke={COLORS.gold} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <SvgText x={toX(5.5)} y={PT-8} fontSize={7} fill="#4CAF5099" textAnchor="middle" fontWeight="700" letterSpacing={1}>TRAIN WINDOW</SvgText>
      <Line x1={toX(4)} y1={PT+14} x2={toX(4)} y2={PT+CH} stroke="#4CAF5044" strokeWidth={1} strokeDasharray="2 3" />
      <SvgText x={toX(4)} y={PT+CH+2} fontSize={6.5} fill="#4CAF5077" textAnchor="middle">MIN</SvgText>
      <SvgText x={toX(5.5)} y={toY(122)-5} fontSize={7} fill={`${COLORS.gold}99`} textAnchor="middle" fontWeight="700">PEAK</SvgText>
      {curX !== null && (
        <>
          <Line x1={curX} y1={PT} x2={curX} y2={H-PB} stroke={COLORS.gold} strokeWidth={1.5} strokeDasharray="3 3" />
          <Circle cx={curX} cy={curY} r={10} fill={`${COLORS.gold}1a`} />
          <Circle cx={curX} cy={curY} r={6}  fill={`${COLORS.gold}33`} />
          <Circle cx={curX} cy={curY} r={4}  fill={COLORS.gold} />
        </>
      )}
      {[0,2,4,6,8].map(d => (
        <SvgText key={d} x={toX(d)} y={H-5} fontSize={8} fill="#555" textAnchor="middle">
          {d === 0 ? 'DAY 0' : `${d}d`}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [profile,        setProfile]        = useState(null);
  const [recoveryStatus, setRecoveryStatus] = useState(null);
  const [quote,          setQuote]          = useState('');
  const [hoursSince,     setHoursSince]     = useState(null);
  const [allWorkouts,    setAllWorkouts]    = useState([]);
  const [allSets,        setAllSets]        = useState([]);
  const [allCalLogs,     setAllCalLogs]     = useState([]);
  const [todayConsumed,  setTodayConsumed]  = useState(0);
  const [calTarget,      setCalTarget]      = useState(null);
  const [recoveryWidth,  setRecoveryWidth]  = useState(0);
  const [refreshing,     setRefreshing]     = useState(false);
  const [showWarning,    setShowWarning]    = useState(false);
  const [warnReadiness,  setWarnReadiness]  = useState(0);

  const shimmerAnim = useRef(new Animated.Value(-200)).current;

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    if (DEV_HOURS_SINCE !== null) {
      setHoursSince(DEV_HOURS_SINCE);
      const s = getRecoveryStatus(Math.floor(DEV_HOURS_SINCE/24));
      setRecoveryStatus(s);
      setQuote(getRandomQuote(s.readyToTrain ? 'preWorkout' : 'restDay'));
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          setProfile(data);
          setCalTarget(calcCalories(data));
        }
      } catch (_) {}
      return;
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) console.error('[HomeScreen] auth:', authErr);
      if (!user) { setRecoveryStatus(getRecoveryStatus(99)); setQuote(getRandomQuote('preWorkout')); return; }

      const today      = toLocalISO(new Date());
      // Fetch 6 months of cal logs to support the longest range chip
      const cutoff6M   = toLocalISO(new Date(Date.now() - 180*24*3600*1000));

      const [profRes, workoutsRes, setsRes, calLogsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('workouts').select('*').eq('user_id', user.id),
        supabase.from('sets').select('*').eq('user_id', user.id),
        supabase.from('calorie_logs').select('*').eq('user_id', user.id).gte('date', cutoff6M),
      ]);

      const prof    = profRes.data;
      const target  = calcCalories(prof);
      const wkts    = workoutsRes.data || [];
      const sets    = setsRes.data     || [];
      const calLogs = calLogsRes.data  || [];

      setProfile(prof);
      setCalTarget(target);
      setAllWorkouts(wkts);
      setAllSets(sets);
      setAllCalLogs(calLogs);

      // Today's consumed for the nutrition card
      const todayLogs = calLogs.filter(l => l.date === today);
      setTodayConsumed(todayLogs.reduce((s, l) => s + l.calories, 0));

      // Recovery curve — use most recent workout across all time
      const tsStr = w => w.date || w.created_at || w.inserted_at || '';
      const sorted = [...wkts].sort((a, b) => tsStr(b).localeCompare(tsStr(a)));
      let totalHours = null, daysSince = null;
      if (sorted.length) {
        const raw = tsStr(sorted[0]);
        const lastDate = parseSupabaseDate(raw);
        if (!isNaN(lastDate.getTime())) {
          totalHours = (Date.now() - lastDate.getTime()) / 3_600_000;
          daysSince  = Math.floor(totalHours / 24);
        }
      }
      setHoursSince(totalHours);

      const s = getRecoveryStatus(daysSince ?? 99);
      setRecoveryStatus(s);
      setQuote(getRandomQuote(s.readyToTrain ? 'preWorkout' : 'restDay'));

    } catch (e) {
      console.error('[HomeScreen] crash:', e);
      setRecoveryStatus(getRecoveryStatus(99));
      setQuote(getRandomQuote('preWorkout'));
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const status    = recoveryStatus?.status || 'ready';
  const phase     = PHASE_META[status] || PHASE_META.ready;
  const isReady   = recoveryStatus?.readyToTrain ?? true;
  const daysSince = (hoursSince !== null && !isNaN(hoursSince)) ? Math.floor(hoursSince/24) : null;
  const hourOfDay = (hoursSince !== null && !isNaN(hoursSince)) ? Math.floor(hoursSince%24) : null;
  const preciseDay = daysSince !== null
    ? (hourOfDay > 0 ? `${daysSince}d ${hourOfDay}h` : `${daysSince}d`)
    : '0d';
  const firstName = profile?.name?.split(' ')[0] || null;
  const readiness = calcReadiness(hoursSince);
  const optimal   = readiness >= 0.87;

  useEffect(() => {
    let cancelled = false;
    const runShimmer = () => {
      if (cancelled) return;
      shimmerAnim.setValue(-220);
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 550, duration: 600, useNativeDriver: true }),
        Animated.delay(2200),
      ]).start(({ finished }) => { if (finished && !cancelled) runShimmer(); });
    };
    if (optimal) { runShimmer(); }
    else { shimmerAnim.setValue(-220); }
    return () => { cancelled = true; };
  }, [optimal]);

  // Header computed values
  const totalSessions = allWorkouts.length;
  const weeksOnProgram = (() => {
    if (!allWorkouts.length) return null;
    const tsStr = w => w.date || w.created_at || w.inserted_at || '';
    const sorted = [...allWorkouts].sort((a, b) => tsStr(a).localeCompare(tsStr(b)));
    const first = parseSupabaseDate(tsStr(sorted[0]));
    if (isNaN(first.getTime())) return null;
    const weeks = Math.floor((Date.now() - first.getTime()) / (7 * 24 * 3600 * 1000));
    return weeks < 1 ? 1 : weeks;
  })();
  const headerMilestone = totalSessions === 0
    ? 'FIRST WORKOUT AWAITS'
    : weeksOnProgram
      ? `WEEK ${weeksOnProgram} · ${totalSessions} SESSION${totalSessions === 1 ? '' : 'S'}`
      : `${totalSessions} SESSION${totalSessions === 1 ? '' : 'S'} LOGGED`;
  const headerTagline = (() => {
    if (!recoveryStatus) return null;
    const s = recoveryStatus.status;
    if (s === 'ready')     return 'YOUR WINDOW IS OPEN. MAKE IT COUNT.';
    if (s === 'almost')    return "ALMOST THERE. ONE MORE DAY WINS.";
    if (s === 'rebuilding') return 'SUPERCOMPENSATION IN PROGRESS.';
    if (s === 'growing')   return 'MUSCLES ARE REBUILDING. TRUST THE PROCESS.';
    if (s === 'repairing') return 'REPAIR PHASE. PROTECT YOUR REST.';
    if (s === 'recovering') return 'RECOVERY STARTED. REST IS THE WORK.';
    if (s === 'overdue')   return "DON'T WAIT TOO LONG. YOUR PEAK IS FADING.";
    return 'REST IS WHERE THE GROWTH HAPPENS.';
  })();

  // Nutrition card
  const remaining = calTarget ? calTarget - todayConsumed : null;
  const calPct    = calTarget ? Math.min(todayConsumed / calTarget, 1) : 0;
  const calOver   = remaining !== null && remaining < 0;
  const GOAL_LABEL = { bulk:'GAINING', cut:'CUTTING', recomp:'RECOMP', maintain:'MAINTAIN' };
  const goalLabel  = GOAL_LABEL[profile?.goal] || null;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 80 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.greeting}>{getTodayLabel()}</Text>
            <Text style={s.heroName}>
              {firstName ? `WELCOME BACK, ${firstName.toUpperCase()}!` : 'WELCOME, ATHLETE!'}
            </Text>
            <Text style={s.milestone}>{headerMilestone}</Text>
            {headerTagline && (
              <View style={s.taglineRow}>
                <View style={[s.taglineDot, { backgroundColor: phase?.color || COLORS.gold }]} />
                <Text style={s.tagline}>{headerTagline}</Text>
              </View>
            )}
          </View>
          <Text style={s.logo}>MENTZER</Text>
        </View>

        {/* Recovery Curve */}
        <Card style={[s.section, s.cardRecovery, { borderLeftColor: '#3B82F6', backgroundColor: '#0e1420' }]}>
          <View style={s.row}>
            <Text style={s.label} numberOfLines={1}>RECOVERY CURVE</Text>
            <Text style={s.meta} numberOfLines={1} adjustsFontSizeToFit>{fmtTimeSince(hoursSince)}</Text>
          </View>
          <View onLayout={e => setRecoveryWidth(e.nativeEvent.layout.width)}>
            {recoveryWidth > 0 && <RecoveryChart hoursSince={hoursSince} width={recoveryWidth} />}
          </View>
          <RecoveryStageBar hoursSince={hoursSince} />
          <View style={[s.row, { marginTop: SPACING.md, marginBottom: 0 }]}>
            <View style={[s.phasePill, { borderColor: phase.color+'55', backgroundColor: phase.color+'18' }]}>
              <Text style={[s.phasePillText, { color: phase.color }]}>{phase.label}</Text>
            </View>
            <Text style={s.dayCount}>{preciseDay}</Text>
          </View>
          <Text style={[s.advice, { marginTop: 6 }]}>{recoveryStatus?.message || ''}</Text>
        </Card>

        {/* HD Score */}
        <Card style={[s.section, s.cardAccentGold, { backgroundColor: '#1a1500' }]}>
          <HDScoreCard
            allWorkouts={allWorkouts}
            allSets={allSets}
            calLogs={allCalLogs}
            profile={profile}
          />
        </Card>

        {/* Nutrition — tappable calorie counter */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('CalorieTracker')}>
          <Card style={[s.section, { borderLeftWidth: 3, borderLeftColor: calOver ? COLORS.red : '#34D399', backgroundColor: '#101614' }]}>
            <View style={s.row}>
              <Text style={s.label}>DAILY CALORIES</Text>
              <View style={s.row}>
                {goalLabel && (
                  <View style={[s.goalBadge, { marginRight: 8 }]}>
                    <Text style={s.goalText}>{goalLabel}</Text>
                  </View>
                )}
                <Text style={s.meta}>TAP TO LOG →</Text>
              </View>
            </View>

            {calTarget ? (
              <>
                <View style={s.calRow}>
                  <Text style={[s.calNum, calOver && { color: COLORS.red }]}>
                    {Math.abs(remaining).toLocaleString()}
                  </Text>
                  <Text style={s.calUnit}>{calOver ? 'kcal over' : 'kcal remaining'}</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.trackFill, {
                    width: `${calPct * 100}%`,
                    backgroundColor: calOver ? COLORS.red : COLORS.gold,
                  }]} />
                </View>
                <View style={s.row}>
                  <Text style={s.meta}>{todayConsumed.toLocaleString()} consumed</Text>
                  <Text style={s.meta}>{calTarget.toLocaleString()} target</Text>
                </View>
              </>
            ) : (
              <Text style={s.empty}>Complete onboarding to see your calorie target.</Text>
            )}
          </Card>
        </TouchableOpacity>
      </ScrollView>

      {/* Warning modal */}
      <Modal
        visible={showWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWarning(false)}
      >
        <View style={wm.overlay}>
          <View style={wm.sheet}>
            {/* Warning icon */}
            <View style={wm.iconWrap}>
              <Feather name="alert-triangle" size={28} color="#E07A3A" />
            </View>

            {/* Copy */}
            <Text style={wm.title}>{getWarningCopy(warnReadiness).title}</Text>
            <Text style={wm.message}>{getWarningCopy(warnReadiness).message}</Text>

            {/* Divider */}
            <View style={wm.divider} />

            {/* Buttons */}
            <View style={wm.btnRow}>
              <TouchableOpacity
                style={wm.btnCancel}
                onPress={() => setShowWarning(false)}
                activeOpacity={0.7}
              >
                <Text style={wm.btnCancelText}>REST UP</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={wm.btnConfirm}
                onPress={() => { setShowWarning(false); navigation.navigate('Workout'); }}
                activeOpacity={0.7}
              >
                <Text style={wm.btnConfirmText}>TRAIN ANYWAY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pinned START WORKOUT */}
      <View style={[s.trainBar, { paddingBottom: 12 + insets.bottom }]}>
        {(() => {
          const fillColor  = readinessColor(readiness);
          const handlePress = () => {
            if (optimal) { navigation.navigate('Workout'); return; }
            setWarnReadiness(readiness);
            setShowWarning(true);
          };
          return (
            <TouchableOpacity
              style={[s.trainBtn, { borderColor: fillColor, borderWidth: 1.5 }]}
              onPress={handlePress}
              activeOpacity={0.82}
            >
              {/* Coloured fill */}
              <View style={[s.trainFill, { width: `${readiness * 100}%`, backgroundColor: fillColor }]} />
              {/* Shimmer halo — wide soft strip behind */}
              {optimal && (
                <Animated.View
                  pointerEvents="none"
                  style={[s.shimmerHalo, { transform: [{ translateX: shimmerAnim }, { rotate: '15deg' }] }]}
                />
              )}
              {/* Shimmer core — bright narrow strip */}
              {optimal && (
                <Animated.View
                  pointerEvents="none"
                  style={[s.shimmerCore, { transform: [{ translateX: shimmerAnim }, { rotate: '15deg' }] }]}
                />
              )}
              {/* Text */}
              <View style={s.trainTextWrap}>
                <Text style={s.trainBtnText}>START WORKOUT</Text>
                {!optimal && (
                  <Text style={s.trainBtnSub}>
                    {readiness < 0.35 ? 'RECOVERING' : readiness < 0.65 ? 'REPAIRING' : 'ALMOST READY'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })()}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
// Shared card row styles used by both HDScoreCard and main screen
const sc = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { color: '#ccc', fontSize: 10, fontWeight: FONT.semibold, letterSpacing: 2 },
  meta:  { color: '#999', fontSize: 10, letterSpacing: 1 },
  empty: { color: '#aaa', fontSize: 12, lineHeight: 18 },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { paddingBottom: 20 },

  header:     { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start',
                paddingTop:52, paddingHorizontal:SPACING.screen, paddingBottom:20,
                overflow:'hidden' },
  headerGlow: { position:'absolute', top:0, left:0, right:0, bottom:0 },
  headerLeft:  { flex:1 },
  greeting:    { color:'#555', fontSize:9, fontWeight:FONT.bold, letterSpacing:3, marginBottom:8 },
  heroName:    { color:COLORS.white, fontSize:26, fontWeight:FONT.black, letterSpacing:0.5, marginBottom:7 },
  milestone:   { color:COLORS.gold, fontSize:9, fontWeight:FONT.bold, letterSpacing:3, marginBottom:8 },
  taglineRow:  { flexDirection:'row', alignItems:'center', gap:6 },
  taglineDot:  { width:4, height:4, borderRadius:2 },
  tagline:     { color:'#888', fontSize:9, fontWeight:FONT.semibold, letterSpacing:2, flex:1 },
  logo:        { fontSize:9, fontWeight:FONT.black, color:COLORS.gold, letterSpacing:5, marginTop:4 },

  section:        { marginHorizontal:SPACING.screen, marginBottom:8 },
  cardRecovery:   { borderLeftWidth:3 },
  cardAccentGold: { borderLeftWidth:3, borderLeftColor:COLORS.gold },
  row:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  label:     { color:'#ccc', fontSize:10, fontWeight:FONT.semibold, letterSpacing:2 },
  meta:      { color:'#999', fontSize:10, letterSpacing:1 },
  empty:     { color:'#aaa', fontSize:12, lineHeight:18 },

  phasePill:     { alignSelf:'flex-start', borderRadius:RADIUS.sm, borderWidth:1, paddingHorizontal:9, paddingVertical:3 },
  phasePillText: { fontSize:9, fontWeight:FONT.black, letterSpacing:2 },
  dayCount:      { color:COLORS.white, fontSize:28, fontWeight:FONT.black, letterSpacing:-0.5 },
  advice:        { color:'#bbb', fontSize:11, lineHeight:16 },

  // Nutrition card
  calRow:    { flexDirection:'row', alignItems:'baseline', marginBottom:10 },
  calNum:    { color:COLORS.white, fontSize:42, fontWeight:FONT.black, letterSpacing:-1 },
  calUnit:   { color:'#aaa', fontSize:12, marginLeft:8, fontWeight:FONT.semibold },
  track:     { height:4, backgroundColor:COLORS.border, borderRadius:2, marginBottom:8 },
  trackFill: { height:4, borderRadius:2 },
  goalBadge: { backgroundColor:COLORS.goldFaint, borderRadius:RADIUS.sm, paddingHorizontal:9, paddingVertical:3, borderWidth:1, borderColor:COLORS.goldBorder },
  goalText:  { color:COLORS.gold, fontSize:9, letterSpacing:1.5, fontWeight:FONT.semibold },

  // Train bar
  trainBar:      { position:'absolute', bottom:0, left:0, right:0,
                   paddingHorizontal:SPACING.screen, paddingTop:10,
                   backgroundColor:COLORS.background, borderTopWidth:1, borderTopColor:'#222' },
  trainBtn:      { height:58, borderRadius:100, overflow:'hidden',
                   backgroundColor:'#111' },
  trainFill:     { position:'absolute', left:0, top:0, bottom:0 },
  shimmerHalo:   { position:'absolute', top:-30, bottom:-30, width:110,
                   backgroundColor:'rgba(255,255,255,0.10)' },
  shimmerCore:   { position:'absolute', top:-30, bottom:-30, width:44,
                   backgroundColor:'rgba(255,255,255,0.38)', marginLeft:33 },
  trainTextWrap: { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', gap:3 },
  trainBtnText:  { color:'#fff', fontSize:14, fontWeight:FONT.black, letterSpacing:3 },
  trainBtnSub:   { color:'rgba(255,255,255,0.4)', fontSize:8, fontWeight:FONT.bold, letterSpacing:2 },
});

const wm = StyleSheet.create({
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.75)',
                  justifyContent:'center', alignItems:'center', paddingHorizontal:28 },
  sheet:        { width:'100%', backgroundColor:'#161410', borderRadius:RADIUS.xl,
                  borderWidth:1, borderColor:'#E07A3A44',
                  paddingTop:28, paddingHorizontal:24, paddingBottom:20 },
  iconWrap:     { width:52, height:52, borderRadius:26, backgroundColor:'#E07A3A18',
                  borderWidth:1, borderColor:'#E07A3A44',
                  alignItems:'center', justifyContent:'center', marginBottom:16 },
  title:        { color:COLORS.white, fontSize:14, fontWeight:FONT.black,
                  letterSpacing:2.5, marginBottom:10 },
  message:      { color:'#888', fontSize:12, lineHeight:19, marginBottom:20 },
  divider:      { height:1, backgroundColor:COLORS.border, marginBottom:16 },
  btnRow:       { flexDirection:'row', gap:10 },
  btnCancel:    { flex:1, paddingVertical:13, borderRadius:RADIUS.md,
                  borderWidth:1, borderColor:COLORS.border, alignItems:'center' },
  btnCancelText:{ color:COLORS.textDim, fontSize:11, fontWeight:FONT.black, letterSpacing:2 },
  btnConfirm:   { flex:1, paddingVertical:13, borderRadius:RADIUS.md,
                  backgroundColor:'#3a1010', borderWidth:1, borderColor:'#e05c5c55',
                  alignItems:'center' },
  btnConfirmText:{ color:'#e05c5c', fontSize:11, fontWeight:FONT.black, letterSpacing:2 },
});
