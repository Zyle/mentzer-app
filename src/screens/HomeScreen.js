import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, RefreshControl, Modal, Animated, Easing, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Path, Line, Text as SvgText } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getRecoveryStatus } from '../lib/progression';
import { getRandomQuote } from '../data/quotes';
import { getSessions, workoutAdherence, calcRoutineScore } from '../lib/routineScore';
import Card from '../components/Card';
import Button from '../components/Button';
import SectionTitle from '../components/SectionTitle';
import RingGauge from '../components/RingGauge';
import TrendChart from '../components/TrendChart';
import { IconBadge } from '../components/Badges';
import { FadeInUp, PressableScale, useLoop, useReduceMotion, haptic } from '../lib/motion';
import { Feather } from '@expo/vector-icons';
import { COLORS, PHASE_COLORS, RING_COLORS, GRADIENTS, FONT, TYPE, RADIUS, SPACING } from '../theme';

// ── Dev override ───────────────────────────────────────────────────────────────
const DEV_HOURS_SINCE = null;

// ── Phase metadata ─────────────────────────────────────────────────────────────
const PHASE_META = {
  recovering: { label: 'RECOVERING',     color: PHASE_COLORS.recovering },
  repairing:  { label: 'REPAIRING',      color: PHASE_COLORS.repairing  },
  rebuilding: { label: 'REBUILDING',     color: PHASE_COLORS.rebuilding },
  growing:    { label: 'GROWING',        color: PHASE_COLORS.growing    },
  almost:     { label: 'ALMOST READY',   color: PHASE_COLORS.almost     },
  ready:      { label: 'READY TO TRAIN', color: PHASE_COLORS.ready      },
  overdue:    { label: 'OVERDUE',        color: PHASE_COLORS.overdue    },
};

// Coach headline for the hero card — what to do today, in plain words
const COACH_HEADLINE = {
  recovering: 'Rest day.',
  repairing:  'Rest day.',
  rebuilding: 'Rest day.',
  growing:    'Rest day.',
  almost:     'Almost ready.',
  ready:      'Ready to train.',
  overdue:    'Train today.',
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
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
// Plain-language countdown to Mentzer's day-4 minimum
function fmtReadyIn(h) {
  if (h === null || h === undefined || isNaN(h)) return null;
  const left = 96 - h;
  if (left <= 0) return null;
  if (left < 12) return 'Ready later today';
  if (left < 36) return 'Ready tomorrow';
  return `Ready in about ${Math.round(left / 24)} days`;
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
  { key: 'routine',   icon: 'check-circle', label: 'ROUTINE',   color: COLORS.gold   },
  { key: 'nutrition', icon: 'target',       label: 'NUTRITION', color: COLORS.cream  },
  { key: 'rest',      icon: 'moon',         label: 'REST',      color: COLORS.orange },
];

const RANGE_OPTIONS = [
  { label: '7D',  days: 7   },
  { label: '14D', days: 14  },
  { label: '30D', days: 30  },
  { label: '3M',  days: 90  },
  { label: '6M',  days: 180 },
];

const overallColor = s => s >= 80 ? COLORS.green : s >= 60 ? COLORS.goldBright : COLORS.red;
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

const getRoutineTip = (rangeWkts, allSets, sessions) => {
  const rows = workoutAdherence(rangeWkts, allSets, sessions);
  if (!rows.length) return null;

  const completions = rows.map(r => r.completion);
  const avg       = completions.reduce((a, b) => a + b, 0) / completions.length;
  const pct       = Math.round(avg * 100);
  const rLen      = Math.max(1, Math.round(rows.reduce((a, r) => a + r.session.exercises.length, 0) / rows.length));
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
  if (weakest.key === 'routine')   tip = getRoutineTip(rangeWkts, allSets, getSessions(profile));
  if (weakest.key === 'nutrition') tip = getNutritionTip(rangeLogs, calTarget, rangeDays, profile?.goal);

  return tip;
};

// ── HD Score Card ──────────────────────────────────────────────────────────────
function PillarBar({ icon, label, score, pillarColor }) {
  const val    = score ?? 0;
  const active = score !== null;
  return (
    <View
      style={pb.row}
      accessible
      accessibilityLabel={`${label.toLowerCase()} score ${active ? `${score} out of 100` : 'not enough data yet'}`}
    >
      <View style={pb.iconWrap}>
        <Feather name={icon} size={13} color={active ? pillarColor : COLORS.textFaint} />
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
  row:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconWrap: { width: 22, alignItems: 'center' },
  label:    { ...TYPE.overline, color: COLORS.textMuted, width: 92, flexShrink: 0, marginLeft: 4 },
  track:    { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginHorizontal: 8 },
  fill:     { height: 4, borderRadius: 2 },
  val:      { fontSize: 13, fontWeight: FONT.bold, width: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
});

function HDScoreCard({ allWorkouts, allSets, calLogs, profile }) {
  const [rangeDays, setRangeDays] = useState(30);
  const navigation = useNavigation();

  const cutoffMs    = Date.now() - rangeDays * 24 * 3600 * 1000;
  const cutoffDate  = toLocalISO(new Date(cutoffMs));
  const rangeWkts   = allWorkouts.filter(w => wTs(w) >= cutoffMs);
  const rangeLogs   = calLogs.filter(l => l.date >= cutoffDate);
  const sessions    = getSessions(profile);
  const calTarget   = calcCalories(profile);

  const scores = {
    rest:      calcRestScore(rangeWkts),
    routine:   calcRoutineScore(rangeWkts, allSets, sessions),
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
    <View>
      {/* Range chips */}
      <View style={hd.chips} accessibilityRole="tablist">
        {RANGE_OPTIONS.map(opt => {
          const active = rangeDays === opt.days;
          return (
            <Pressable
              key={opt.days}
              style={[hd.chip, active && hd.chipActive]}
              onPress={() => setRangeDays(opt.days)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Last ${opt.label}`}
              hitSlop={6}
            >
              <Text style={[hd.chipText, active && hd.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {overall !== null ? (
        <>
          {/* Score number + label — tap to open detail */}
          <Pressable
            style={({ pressed }) => [hd.scoreRow, pressed && { opacity: 0.7 }]}
            onPress={() => navigation.navigate('HDScoreDetail')}
            accessibilityRole="button"
            accessibilityLabel={`Heavy Duty score ${overall} out of 100, ${label}`}
            accessibilityHint="Opens the full score breakdown"
          >
            <Text style={[hd.number, { color: numColor }]}>
              {overall}<Text style={hd.outOf}>/100</Text>
            </Text>
            <View style={[hd.labelBadge, { borderColor: numColor + '66', backgroundColor: numColor + '1a' }]}>
              <Text style={[hd.labelText, { color: numColor }]}>{label}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={COLORS.textDim} style={{ marginLeft: 'auto' }} />
          </Pressable>

          <View style={hd.pillars}>
            {PILLAR_DEFS.map(p => (
              <PillarBar key={p.key} icon={p.icon} label={p.label}
                score={scores[p.key]} pillarColor={p.color} />
            ))}
          </View>

          {tip && (
            <View style={hd.tipBox}>
              <Feather name="message-circle" size={14} color={COLORS.gold} style={{ marginTop: 2 }} />
              <Text style={hd.tipText}>{tip}</Text>
            </View>
          )}
        </>
      ) : (
        <Text style={hd.empty}>Log your first workout to see your score. It rates your routine, rest and nutrition.</Text>
      )}
    </View>
  );
}
const hd = StyleSheet.create({
  chips:          { flexDirection: 'row', gap: 6, marginBottom: 16 },
  chip:           { minWidth: 44, height: 32, paddingHorizontal: 10, borderRadius: RADIUS.pill,
                    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  chipActive:     { borderColor: COLORS.goldBorder, backgroundColor: COLORS.goldFaint },
  chipText:       { color: COLORS.textDim, fontSize: 12, fontWeight: FONT.bold },
  chipTextActive: { color: COLORS.gold },
  scoreRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  number:         { fontSize: 52, fontWeight: FONT.black, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  outOf:          { fontSize: 20, fontWeight: FONT.semibold, letterSpacing: 0, color: COLORS.textDim },
  labelBadge:     { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  labelText:      { fontSize: 11, fontWeight: FONT.black, letterSpacing: 1.5 },
  pillars:        { marginBottom: 4 },
  tipBox:         { flexDirection: 'row', gap: 10, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md,
                    padding: 12, marginTop: 6 },
  tipText:        { ...TYPE.callout, color: COLORS.textSecondary, flex: 1 },
  empty:          { ...TYPE.callout, color: COLORS.textMuted },
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
// Matches getRecoveryStatus: ready from Mentzer's day-4 minimum, overdue after day 7
const STAGE_SEGS = [
  { key: 'recover', label: 'RECOVERING', from: 0, to: 2,  color: PHASE_COLORS.recovering },
  { key: 'rebuild', label: 'REBUILDING', from: 2, to: 4,  color: PHASE_COLORS.rebuilding },
  { key: 'ready',   label: 'READY',      from: 4, to: 7,  color: PHASE_COLORS.ready      },
  { key: 'overdue', label: 'OVERDUE',    from: 7, to: 10, color: PHASE_COLORS.overdue    },
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
    <View style={st.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'relative' }}>
        <View style={st.barRow}>
          {STAGE_SEGS.map((seg, i) => (
            <View
              key={seg.key}
              style={[
                st.seg,
                { flex: seg.to - seg.from,
                  backgroundColor: i === activeIdx ? seg.color : seg.color + '33' },
                i === 0                      && st.segFirst,
                i === STAGE_SEGS.length - 1  && st.segLast,
              ]}
            />
          ))}
        </View>

        {pct !== null && (
          <View style={st.tickRow} pointerEvents="none">
            <View style={{ flex: Math.max(pct * 100, 0.01) }} />
            <View style={st.tick} />
            <View style={{ flex: Math.max((1 - pct) * 100, 0.01) }} />
          </View>
        )}
      </View>

      <View style={st.labelRow}>
        <Text style={st.dayMark}>Day 0</Text>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {activeIdx >= 0 && (
            <Text style={[st.activeLabel, { color: STAGE_SEGS[activeIdx].color }]}>
              {STAGE_SEGS[activeIdx].label}
            </Text>
          )}
        </View>
        <Text style={st.dayMark}>Day 10</Text>
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  wrap:        { marginTop: 14 },
  barRow:      { flexDirection: 'row', height: 6, gap: 3 },
  seg:         { height: 6 },
  segFirst:    { borderTopLeftRadius:  3, borderBottomLeftRadius:  3 },
  segLast:     { borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  tickRow:     { position: 'absolute', top: -4, left: 0, right: 0,
                 flexDirection: 'row', alignItems: 'center' },
  tick:        { width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.white },
  labelRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  activeLabel: { ...TYPE.overline },
  dayMark:     { color: COLORS.textDim, fontSize: 11 },
});

function RecoveryChart({ hoursSince, width }) {
  const H=136, PL=6, PR=6, PT=22, PB=20;
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
  if (width <= 0) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        dayFloat === null
          ? 'Recovery curve. No workout logged yet.'
          : `Recovery curve. You are on day ${Math.floor(dayFloat)}. Mentzer's training window opens on day 4 and peaks around day 5 to 6.`
      }
    >
      <Svg width={width} height={H}>
        {/* Training window (day 4–7) */}
        <Rect x={toX(4)} y={PT} width={toX(7)-toX(4)} height={CH} fill={COLORS.gold} fillOpacity={0.09} rx={6} />
        <Line x1={PL} y1={baseY} x2={PL+CW} y2={baseY} stroke={COLORS.borderStrong} strokeWidth={1} strokeDasharray="4 3" />
        <SvgText x={PL+3} y={baseY-5} fontSize={10} fill={COLORS.textDim}>Baseline</SvgText>
        <Path d={fillPath} fill={COLORS.gold} fillOpacity={0.08} />
        <Path d={linePath} fill="none" stroke={COLORS.gold} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <SvgText x={toX(5.5)} y={PT-8} fontSize={10} fill={COLORS.gold} textAnchor="middle" fontWeight="700">Train window</SvgText>
        {curX !== null && (
          <>
            <Line x1={curX} y1={PT} x2={curX} y2={H-PB} stroke={COLORS.gold} strokeWidth={1.5} strokeDasharray="3 3" />
            <Circle cx={curX} cy={curY} r={10} fill={COLORS.gold} fillOpacity={0.15} />
            <Circle cx={curX} cy={curY} r={5}  fill={COLORS.gold} stroke={COLORS.background} strokeWidth={2} />
          </>
        )}
        {[0,2,4,6,8,10].map(d => (
          <SvgText key={d} x={Math.min(Math.max(toX(d), PL+8), PL+CW-8)} y={H-5} fontSize={10} fill={COLORS.textDim} textAnchor="middle">
            {`${d}d`}
          </SvgText>
        ))}
      </Svg>
    </View>
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
  const [trendWidth,     setTrendWidth]     = useState(0);
  const reduced  = useReduceMotion();
  const barAnim  = useRef(new Animated.Value(0)).current;

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
      const sets    = setsRes.data     || [];
      // Ignore workout rows with no sets logged (abandoned sessions) — they
      // would reset the recovery clock and skew the rest/routine scores
      const loggedIds = new Set(sets.map(st => st.workout_id));
      const wkts    = (workoutsRes.data || []).filter(w => loggedIds.has(w.id));
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

  const neverTrained = hoursSince === null || isNaN(hoursSince);
  const status    = recoveryStatus?.status || 'ready';
  const phase     = PHASE_META[status] || PHASE_META.ready;
  const daysSince = !neverTrained ? Math.floor(hoursSince/24) : null;
  const hourOfDay = !neverTrained ? Math.floor(hoursSince%24) : null;
  const preciseDay = daysSince !== null
    ? (hourOfDay > 0 ? `${daysSince}d ${hourOfDay}h` : `${daysSince}d`)
    : '—';
  const firstName = profile?.name?.split(' ')[0] || null;
  const readiness = calcReadiness(hoursSince);
  const optimal   = readiness >= 0.87;
  // Clear to train once Mentzer's day-4 minimum is reached (recoveryStatus.readyToTrain)
  // or at peak readiness; only warn while genuinely still recovering
  const clearToTrain = neverTrained || optimal || !!recoveryStatus?.readyToTrain;
  const readyIn   = fmtReadyIn(hoursSince);
  const breathe   = useLoop(3200, { active: clearToTrain });

  // Readiness bar fills in whenever recovery changes
  useEffect(() => {
    if (reduced) { barAnim.setValue(1); return; }
    barAnim.setValue(0);
    Animated.timing(barAnim, { toValue: 1, duration: 1100, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [hoursSince, reduced]);

  // Header computed values — only count workouts with at least one set logged
  const workedOutIds = new Set(allSets.map(s => s.workout_id));
  const completedWorkouts = allWorkouts.filter(w => workedOutIds.has(w.id));
  const totalSessions = completedWorkouts.length;
  const weeksOnProgram = (() => {
    if (!completedWorkouts.length) return null;
    const tsStr = w => w.date || w.created_at || w.inserted_at || '';
    const sorted = [...completedWorkouts].sort((a, b) => tsStr(a).localeCompare(tsStr(b)));
    const first = parseSupabaseDate(tsStr(sorted[0]));
    if (isNaN(first.getTime())) return null;
    const weeks = Math.floor((Date.now() - first.getTime()) / (7 * 24 * 3600 * 1000));
    return weeks < 1 ? 1 : weeks;
  })();
  const headerMilestone = totalSessions === 0
    ? null
    : weeksOnProgram
      ? `Week ${weeksOnProgram} · ${totalSessions} session${totalSessions === 1 ? '' : 's'}`
      : `${totalSessions} session${totalSessions === 1 ? '' : 's'} logged`;

  // Coach card copy
  const heroOverline = neverTrained
    ? 'DAY ONE'
    : `DAY ${daysSince} · ${phase.label}`;
  const heroTitle = neverTrained ? 'Your first session.' : (COACH_HEADLINE[status] || 'Rest day.');
  const heroBody  = neverTrained
    ? 'One set per exercise, taken to absolute muscular failure. Then leave, and let your body grow.'
    : recoveryStatus?.message || '';
  const heroColor = neverTrained ? COLORS.gold : phase.color;

  // Nutrition card
  const remaining = calTarget ? calTarget - todayConsumed : null;
  const calPct    = calTarget ? Math.min(todayConsumed / calTarget, 1) : 0;
  const calOver   = remaining !== null && remaining < 0;
  const GOAL_LABEL = { bulk:'Building', cut:'Cutting', recomp:'Recomp', maintain:'Maintain' };
  const goalLabel  = GOAL_LABEL[profile?.goal] || null;

  // Your activity — 30-day Heavy Duty score (same maths as the score card)
  const cutoff30   = Date.now() - 30 * 24 * 3600 * 1000;
  const wkts30     = allWorkouts.filter(w => wTs(w) >= cutoff30);
  const logs30     = allCalLogs.filter(l => l.date >= toLocalISO(new Date(cutoff30)));
  const score30Parts = [
    calcRestScore(wkts30),
    calcRoutineScore(wkts30, allSets, getSessions(profile)),
    calcNutritionScore(logs30, calTarget, 30),
  ].filter(v => v !== null);
  const score30 = score30Parts.length ? Math.round(score30Parts.reduce((a, b) => a + b, 0) / score30Parts.length) : null;

  // Strength index — each lift vs your first performance of it (estimated 1RM,
  // Epley), averaged per session. First session = 100. Comparable across
  // upper/lower days, unlike raw load.
  const trend = (() => {
    const tsStr = w => w.date || w.created_at || w.inserted_at || '';
    const ordered = [...completedWorkouts].sort((a, b) => tsStr(a).localeCompare(tsStr(b)));
    const base = {};
    const points = ordered.map(w => {
      const ratios = allSets.filter(st => st.workout_id === w.id && st.weight_kg > 0).map(st => {
        const e1rm = st.weight_kg * (1 + st.reps / 30);
        if (!base[st.exercise_name]) base[st.exercise_name] = e1rm;
        return e1rm / base[st.exercise_name];
      });
      if (!ratios.length) return null;
      const d = parseSupabaseDate(tsStr(w));
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, value: Math.round((ratios.reduce((x, y) => x + y, 0) / ratios.length) * 100) };
    }).filter(Boolean);
    return points.slice(-8);
  })();
  const trendDelta = trend.length >= 2 ? trend[trend.length - 1].value - 100 : null;
  const fmtLoad = v => `${Math.round(v)}`;

  const handleStart = () => {
    if (clearToTrain) { navigation.navigate('Workout'); return; }
    haptic.warning();
    setWarnReadiness(readiness);
    setShowWarning(true);
  };
  const warning = getWarningCopy(warnReadiness);
  const initial = (profile?.name || 'A').trim().charAt(0).toUpperCase();

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <FadeInUp index={0} style={s.header}>
          <LinearGradient colors={GRADIENTS.gold} style={s.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={s.greetingSmall}>{getGreeting()}</Text>
            <Text style={s.greetingName} accessibilityRole="header" numberOfLines={1}>{firstName || 'Athlete'}</Text>
          </View>
          <PressableScale
            onPress={() => navigation.navigate('Settings')}
            hapticStyle="tap"
            scaleTo={0.9}
            style={s.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Feather name="settings" size={19} color={COLORS.white} />
          </PressableScale>
        </FadeInUp>

        {/* Coach card — what to do today */}
        <FadeInUp index={1} style={s.heroWrap}>
          <View style={[s.hero, clearToTrain && s.heroReady]}>
            <LinearGradient
              colors={clearToTrain ? GRADIENTS.heroGlow : GRADIENTS.card}
              start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {clearToTrain && (
              <Animated.View
                pointerEvents="none"
                style={[s.heroOrb, {
                  opacity: breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.7, 0.35] }),
                  transform: [{ scale: breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] }) }],
                }]}
              />
            )}
            <View style={[s.chip, { backgroundColor: heroColor + '1f' }]}>
              <View style={[s.chipDot, { backgroundColor: heroColor }]} />
              <Text style={[s.chipText, { color: heroColor }]}>{heroOverline}</Text>
            </View>
            <Text style={s.heroTitle} accessibilityRole="header">{heroTitle}</Text>
            {!neverTrained && readyIn && <Text style={s.heroReadyIn}>{readyIn}</Text>}
            <Text style={s.heroBody}>{heroBody}</Text>

            {!neverTrained && (
              <View
                style={s.readyRow}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Recovery"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(readiness * 100), text: `${Math.round(readiness * 100)} percent recovered` }}
              >
                <View style={s.readyTrack}>
                  <Animated.View style={[s.readyFill, {
                    width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${readiness * 100}%`] }),
                  }]}>
                    <LinearGradient colors={GRADIENTS.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  </Animated.View>
                </View>
                <Text style={s.readyPct}>{Math.round(readiness * 100)}%</Text>
              </View>
            )}

            <Button
              title={clearToTrain ? 'Start workout' : 'Train anyway'}
              icon="zap"
              variant={clearToTrain ? 'primary' : 'secondary'}
              shimmer={clearToTrain}
              onPress={handleStart}
              hint={clearToTrain ? undefined : 'You are still recovering. A warning will be shown first.'}
              style={{ marginTop: SPACING.lg }}
            />
          </View>
        </FadeInUp>

        {/* Your activity — three rings */}
        <FadeInUp index={2}>
          <SectionTitle title="Your activity" />
          <Card style={s.section}>
            <View style={s.rings}>
              <RingGauge
                progress={neverTrained ? 1 : readiness}
                value={neverTrained ? 100 : Math.round(readiness * 100)}
                suffix="%"
                label="Recovery"
                sublabel={neverTrained ? 'Fresh' : phase.label.charAt(0) + phase.label.slice(1).toLowerCase()}
                color={RING_COLORS[0]}
              />
              <PressableScale
                style={{ flex: 1 }}
                onPress={() => navigation.navigate('HDScoreDetail')}
                hapticStyle="tap"
                accessibilityRole="button"
                accessibilityLabel={`Heavy Duty score ${score30 ?? 'not available'}. Opens the breakdown`}
              >
                <RingGauge
                  progress={(score30 ?? 0) / 100}
                  value={score30}
                  caption="/100"
                  label="HD Score"
                  sublabel={score30 !== null ? getScoreLabel(score30).charAt(0) + getScoreLabel(score30).slice(1).toLowerCase() : 'No data'}
                  color={RING_COLORS[1]}
                  delay={120}
                />
              </PressableScale>
              <RingGauge
                progress={calPct}
                value={calTarget ? Math.round(calPct * 100) : null}
                suffix="%"
                label="Calories"
                sublabel={calTarget ? `${Math.max(remaining, 0).toLocaleString()} left` : 'No target'}
                color={RING_COLORS[2]}
                delay={240}
              />
            </View>
          </Card>
        </FadeInUp>

        {/* Strength trend */}
        {trend.length >= 2 && (
          <FadeInUp index={3}>
            <SectionTitle title="Strength trend" action="History" onAction={() => navigation.navigate('History')} />
            <Card style={s.section}>
              <View style={s.trendHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Strength index</Text>
                  <Text style={s.cardSub}>Your lifts vs your first session (= 100)</Text>
                </View>
                {trendDelta !== null && (
                  <View style={[s.deltaChip, trendDelta < 0 && { backgroundColor: COLORS.redFaint }]}>
                    <Feather name={trendDelta >= 0 ? 'trending-up' : 'trending-down'} size={13} color={trendDelta >= 0 ? COLORS.gold : COLORS.red} />
                    <Text style={[s.deltaText, trendDelta < 0 && { color: COLORS.red }]}>{trendDelta >= 0 ? `+${trendDelta}% stronger` : `${trendDelta}%`}</Text>
                  </View>
                )}
              </View>
              <View onLayout={e => setTrendWidth(e.nativeEvent.layout.width)} style={{ marginTop: SPACING.md }}>
                <TrendChart
                  data={trend}
                  width={trendWidth}
                  formatY={fmtLoad}
                  accessibilityLabel={`Strength index over the last ${trend.length} sessions, from ${trend[0].value} to ${trend[trend.length - 1].value}. You are ${Math.abs(trendDelta)} percent ${trendDelta >= 0 ? 'stronger' : 'weaker'} than your first session.`}
                />
              </View>
              <View style={s.trendFoot}>
                <View>
                  <Text style={s.bigNum}>{totalSessions}</Text>
                  <Text style={s.cardSub}>{headerMilestone || 'sessions completed'}</Text>
                </View>
                <Button title="Start now" size="md" onPress={handleStart} style={{ paddingHorizontal: 22 }} />
              </View>
            </Card>
          </FadeInUp>
        )}

        {/* Recovery curve */}
        <FadeInUp index={4}>
          <SectionTitle title="Recovery" right={<Text style={s.meta}>{fmtTimeSince(hoursSince)}</Text>} />
          <Card style={s.section}>
            <View onLayout={e => setRecoveryWidth(e.nativeEvent.layout.width)}>
              {recoveryWidth > 0 && <RecoveryChart hoursSince={hoursSince} width={recoveryWidth} />}
            </View>
            <RecoveryStageBar hoursSince={hoursSince} />
            <View style={s.dayRow}>
              <Text style={s.dayLabel}>Since last session</Text>
              <Text style={s.dayCount}>{preciseDay}</Text>
            </View>
          </Card>
        </FadeInUp>

        {/* HD Score */}
        <FadeInUp index={5}>
          <SectionTitle title="Heavy Duty score" action="Details" onAction={() => navigation.navigate('HDScoreDetail')} />
          <Card style={s.section}>
            <HDScoreCard
              allWorkouts={allWorkouts}
              allSets={allSets}
              calLogs={allCalLogs}
              profile={profile}
            />
          </Card>
        </FadeInUp>

        {/* Nutrition — tappable calorie counter */}
        <FadeInUp index={6}>
          <SectionTitle title="Today's calories" right={goalLabel ? (
            <View style={s.goalBadge}><Text style={s.goalText}>{goalLabel}</Text></View>
          ) : null} />
          <Card
            style={s.section}
            onPress={() => navigation.navigate('CalorieTracker')}
            accessibilityLabel={calTarget
              ? `Calories. ${Math.abs(remaining)} ${calOver ? 'over target' : 'left today'}. ${todayConsumed} of ${calTarget} eaten.`
              : 'Calories'}
            accessibilityHint="Opens the calorie log"
          >
            {calTarget ? (
              <>
                <View style={s.calRow}>
                  <IconBadge icon="coffee" color={COLORS.cream} size={42} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.calNum, calOver && { color: COLORS.red }]}>
                      {Math.abs(remaining).toLocaleString()}
                      <Text style={s.calUnit}>  kcal {calOver ? 'over' : 'left'}</Text>
                    </Text>
                    <Text style={s.cardSub}>{todayConsumed.toLocaleString()} of {calTarget.toLocaleString()} eaten</Text>
                  </View>
                  <View style={s.logBtn}>
                    <Feather name="plus" size={18} color={COLORS.onGold} />
                  </View>
                </View>
                <View style={s.track}>
                  <View style={[s.trackFill, {
                    width: `${calPct * 100}%`,
                    backgroundColor: calOver ? COLORS.red : COLORS.cream,
                  }]} />
                </View>
              </>
            ) : (
              <Text style={s.empty}>Complete your profile to see your calorie target.</Text>
            )}
          </Card>
        </FadeInUp>

        {/* Principle */}
        {quote ? (
          <FadeInUp index={7} style={s.note}>
            <Text style={s.noteMark} accessibilityElementsHidden importantForAccessibility="no">“</Text>
            <Text style={s.noteText}>{quote}</Text>
            <Text style={s.noteLabel}>HEAVY DUTY PRINCIPLE</Text>
          </FadeInUp>
        ) : null}
      </ScrollView>

      {/* Early-training warning */}
      <Modal
        visible={showWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWarning(false)}
      >
        <View style={wm.overlay}>
          <View style={wm.sheet} accessibilityViewIsModal>
            <IconBadge icon="alert-triangle" color={COLORS.orange} size={54} style={{ marginBottom: 16 }} />
            <Text style={wm.title} accessibilityRole="header">{warning.title.charAt(0) + warning.title.slice(1).toLowerCase()}</Text>
            <Text style={wm.message}>{warning.message}</Text>
            <Button title="Rest up" onPress={() => setShowWarning(false)} />
            <Button
              title="Train anyway"
              variant="ghost"
              size="md"
              onPress={() => { setShowWarning(false); navigation.navigate('Workout'); }}
              style={{ marginTop: SPACING.sm }}
              textStyle={{ color: COLORS.orange }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header:        { flexDirection: 'row', alignItems: 'center', gap: 12,
                   paddingHorizontal: SPACING.screen, paddingBottom: SPACING.lg },
  avatarRing:    { width: 48, height: 48, borderRadius: 24, padding: 2 },
  avatar:        { flex: 1, borderRadius: 22, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { color: COLORS.gold, fontSize: 19, fontWeight: FONT.black },
  greetingSmall: { color: COLORS.textDim, fontSize: 13, fontWeight: FONT.medium },
  greetingName:  { color: COLORS.white, fontSize: 20, fontWeight: FONT.bold, letterSpacing: -0.3 },
  headerBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface,
                   alignItems: 'center', justifyContent: 'center' },

  // Coach card
  heroWrap:    { marginHorizontal: SPACING.screen },
  hero:        { padding: SPACING.lg, borderRadius: RADIUS.xl, overflow: 'hidden',
                 backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  heroReady:   { borderColor: COLORS.goldBorder },
  heroOrb:     { position: 'absolute', top: -90, right: -70, width: 230, height: 230, borderRadius: 115,
                 backgroundColor: COLORS.goldGlow },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
                 borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  chipDot:     { width: 7, height: 7, borderRadius: 4 },
  chipText:    { ...TYPE.overline, fontSize: 11 },
  heroTitle:   { ...TYPE.display, fontSize: 34, lineHeight: 40, color: COLORS.white },
  heroReadyIn: { ...TYPE.heading, color: COLORS.gold, marginTop: 2 },
  heroBody:    { ...TYPE.body, color: COLORS.textMuted, marginTop: 8 },
  readyRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: SPACING.lg },
  readyTrack:  { flex: 1, height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceRaised, overflow: 'hidden' },
  readyFill:   { height: 8, borderRadius: 4, overflow: 'hidden' },
  readyPct:    { color: COLORS.gold, fontSize: 15, fontWeight: FONT.black, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },

  section:   { marginHorizontal: SPACING.screen },
  rings:     { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { ...TYPE.heading, color: COLORS.white },
  cardSub:   { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  meta:      { color: COLORS.textDim, fontSize: 12 },
  empty:     { ...TYPE.callout, color: COLORS.textMuted },

  trendHead: { flexDirection: 'row', alignItems: 'flex-start' },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.goldFaint,
               borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  deltaText: { color: COLORS.gold, fontSize: 13, fontWeight: FONT.bold, fontVariant: ['tabular-nums'] },
  trendFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: SPACING.md },
  bigNum:    { color: COLORS.white, fontSize: 30, fontWeight: FONT.black, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },

  dayRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: SPACING.md },
  dayLabel:  { ...TYPE.callout, color: COLORS.textMuted },
  dayCount:  { color: COLORS.white, fontSize: 24, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },

  // Nutrition card
  calRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  calNum:    { color: COLORS.white, fontSize: 26, fontWeight: FONT.black, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  calUnit:   { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.medium, letterSpacing: 0 },
  track:     { height: 8, backgroundColor: COLORS.surfaceRaised, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4 },
  goalBadge: { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.pill, paddingHorizontal: 11, paddingVertical: 4 },
  goalText:  { color: COLORS.gold, fontSize: 12, fontWeight: FONT.semibold },
  logBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold,
               alignItems: 'center', justifyContent: 'center' },

  // Principle
  note:      { marginHorizontal: SPACING.screen, marginTop: SPACING.xxl, padding: SPACING.lg,
               borderRadius: RADIUS.xl, backgroundColor: COLORS.surface },
  noteMark:  { color: COLORS.gold, fontSize: 56, fontWeight: FONT.black, lineHeight: 56, marginBottom: -18 },
  noteText:  { color: COLORS.white, fontSize: 18, fontWeight: FONT.semibold, lineHeight: 26, letterSpacing: -0.2 },
  noteLabel: { ...TYPE.overline, color: COLORS.gold, marginTop: 14 },
});

const wm = StyleSheet.create({
  overlay:  { flex:1, backgroundColor: COLORS.overlay,
              justifyContent:'center', alignItems:'center', paddingHorizontal: SPACING.xl },
  sheet:    { width:'100%', maxWidth: 420, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl },
  title:    { ...TYPE.title, color: COLORS.white, marginBottom: 10 },
  message:  { ...TYPE.body, color: COLORS.textMuted, marginBottom: SPACING.xl },
});
