import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

// ── Helpers ────────────────────────────────────────────────────────────────────
const toLocalISO = d => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};
const parseSupabaseDate = str => {
  if (!str) return new Date(NaN);
  return new Date(str.replace(/(\.\d{3})\d*(Z|[+-]\d{2}:\d{2})$/, '$1$2'));
};
const wTs = w => parseSupabaseDate(w.date || w.created_at || '').getTime();
const calcTDEE = p => {
  if (!p?.bodyweight_kg || !p?.height_cm || !p?.age) return null;
  const bmr = 10*p.bodyweight_kg + 6.25*p.height_cm - 5*p.age + (p.sex === 'male' ? 5 : -161);
  return Math.round(bmr * 1.375);
};
const calcCalories = p => { const t = calcTDEE(p); return t ? t + (p.calorie_adjustment||0) : null; };

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

// ── Score calculations ─────────────────────────────────────────────────────────
const calcRestScore = workouts => {
  if (workouts.length < 2) return null;
  const sorted = [...workouts].sort((a, b) => wTs(a) - wTs(b));
  const scores = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = (wTs(sorted[i]) - wTs(sorted[i-1])) / 86400000;
    if      (days >= 4 && days <= 7)  scores.push(100);
    else if (days > 7  && days <= 10) scores.push(80);
    else if (days > 10 && days <= 14) scores.push(60);
    else if (days > 14)               scores.push(30);
    else if (days >= 3)               scores.push(20);
    else                              scores.push(0);
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

// ── Tip functions ──────────────────────────────────────────────────────────────
const getRestTip = rangeWkts => {
  if (rangeWkts.length < 2) return null;
  const sorted = [...rangeWkts].sort((a, b) => wTs(a) - wTs(b));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++)
    gaps.push((wTs(sorted[i]) - wTs(sorted[i-1])) / 86400000);
  const avg    = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const stdDev = Math.sqrt(gaps.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / gaps.length);
  if (gaps.some(g => g < 4) && gaps.some(g => g > 10) && stdDev > 3)
    return "Your rest gaps are all over the place. A steady 4-7 day rhythm every session is where the real gains live.";
  if (avg < 0.5)  return "Growth happens after you train, not during. Two sessions the same day mean the muscle never gets its recovery window. Give it 4 full days.";
  if (avg < 1)    return "Your muscles do their actual growing in the 96 hours after a session. Getting back before that window closes means less output for the same effort.";
  if (avg < 2)    return "Mentzer showed 4 days minimum is when supercompensation begins. One more rest day between sessions and each workout will hit significantly harder.";
  if (avg < 3)    return "Just one more day of rest between sessions unlocks the full recovery cycle. Supercompensation doesn't start rising until around day 4.";
  if (avg < 4)    return "Nearly there. Most sessions are landing around day 3 and Mentzer's minimum is 4. One extra rest day is a small change with a meaningful payoff.";
  if (avg <= 7)   return null;
  if (avg <= 10)  return "Supercompensation peaks around day 5-6 — try to get back in before day 8 to catch that window at its highest.";
  if (avg <= 14)  return "When you can, aim for that day 5-7 window — that's when the body is primed and ready.";
  if (avg <= 21)  return "Mentzer's whole system only asks for one focused session every 5-7 days — one of the most manageable commitments out there.";
  return "One focused session every 5-7 days is genuinely all Mentzer ever prescribed. You've got everything you need to make this work.";
};

const getRoutineTip = (rangeWkts, allSets, userRoutine) => {
  if (!rangeWkts.length || !userRoutine.length) return null;
  const completions = rangeWkts.map(w => {
    const unique = new Set(allSets.filter(s => s.workout_id === w.id).map(s => s.exercise_name)).size;
    return unique / userRoutine.length;
  });
  const avg    = completions.reduce((a, b) => a + b, 0) / completions.length;
  const pct    = Math.round(avg * 100);
  const rLen   = userRoutine.length;
  const miss   = rLen - Math.max(1, Math.round(avg * rLen));
  const stdDev = Math.sqrt(completions.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / completions.length);
  if (stdDev > 0.25 && avg > 0.6)
    return "Some sessions you nail the full routine — that's the standard to aim for every time. Consistency over perfection.";
  const empty = rangeWkts.filter(w => !allSets.some(s => s.workout_id === w.id)).length;
  if (empty > 0 && empty >= rangeWkts.length * 0.3)
    return `${empty} session${empty > 1 ? 's' : ''} in this period ${empty > 1 ? 'have' : 'has'} no exercises recorded. Make sure to log your sets during the workout.`;
  if (pct <= 25)  return "Every exercise targets a specific stimulus no other movement can replicate. Try adding just one more each session.";
  if (pct <= 50)  return `You're averaging ${Math.max(1,Math.round(avg*rLen))} of ${rLen} exercises. The remaining ${miss} are receiving no stimulus this period.`;
  if (pct <= 75)  return `Those last ${miss} exercise${miss !== 1 ? 's are' : ' is'} worth pushing for — each one hits something the others don't.`;
  if (pct <= 90)  return `Just ${miss} exercise${miss !== 1 ? 's' : ''} short of a complete routine each session. Push to the end.`;
  return "Almost perfect. Make every session complete — Mentzer built each movement in for a reason.";
};

const getNutritionTip = (rangeLogs, calTarget, rangeDays, goal) => {
  if (!calTarget) return null;
  if (!rangeLogs.length) return "Start logging your meals and this score will come to life immediately.";
  const byDate = {};
  rangeLogs.forEach(l => { byDate[l.date] = (byDate[l.date] || 0) + l.calories; });
  const loggedDays   = Object.keys(byDate).length;
  const logRate      = loggedDays / rangeDays;
  const dailyIntakes = Object.values(byDate);
  const avg          = Math.round(dailyIntakes.reduce((a, b) => a + b, 0) / dailyIntakes.length);
  const diff         = calTarget - avg;
  const pctDiff      = diff / calTarget;
  const cv           = Math.sqrt(dailyIntakes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / dailyIntakes.length) / avg;
  if (logRate < 0.25) return `Only ${loggedDays} of ${rangeDays} days tracked. Log your first meal each day and the habit forms quickly.`;
  if (logRate < 0.5)  return `${loggedDays} of ${rangeDays} days tracked. Making it daily is the next step.`;
  if (logRate < 0.75 && Math.abs(pctDiff) < 0.15) return "Your intake looks great on the days you log — the opportunity is just making it daily.";
  if (logRate < 0.75) return `Tracking ${loggedDays} of ${rangeDays} days. Consistent daily logging is what gives this score its accuracy.`;
  if (Math.abs(pctDiff) < 0.08 && cv > 0.25) return `Average intake is on target but swinging day to day. Steady ${calTarget.toLocaleString()} kcal daily is what the body responds best to.`;
  if (pctDiff > 0.20) {
    if (goal === 'cut') return `${diff.toLocaleString()} below your cutting target. A deficit this deep risks breaking down muscle. Keep it controlled.`;
    return `${diff.toLocaleString()} kcal short of your ${calTarget.toLocaleString()} target. Eating more is as important as any rep in the gym.`;
  }
  if (pctDiff > 0.08) {
    if (goal === 'cut') return "Slightly under your cutting target — make sure protein stays high to protect the muscle you've built.";
    return `About ${diff.toLocaleString()} kcal short of your ${calTarget.toLocaleString()} target. Bringing it up slightly fuels full recovery.`;
  }
  if (pctDiff < -0.20) {
    if (goal === 'bulk') return `${Math.abs(diff).toLocaleString()} over your bulk target. Calories beyond what muscle synthesis can use store as fat. Pull back slightly.`;
    return `${Math.abs(diff).toLocaleString()} over your ${calTarget.toLocaleString()} target. Bringing it back down keeps body composition on track.`;
  }
  if (pctDiff < -0.08) {
    if (goal === 'bulk') return "Slightly over your bulk target — a small surplus is ideal, just keep it controlled.";
    return `Slightly over your ${calTarget.toLocaleString()} target. Trimming ${Math.abs(diff).toLocaleString()} kcal daily keeps everything dialled in.`;
  }
  return null;
};

// ── Visual helpers ─────────────────────────────────────────────────────────────
const gapColor = days => {
  if (days < 3)   return COLORS.red;
  if (days < 4)   return '#FB923C';
  if (days <= 7)  return '#4ADE80';
  if (days <= 14) return COLORS.textDim;
  return '#3a3a3a';
};
const dayColor = (consumed, target) => {
  if (!consumed || !target) return COLORS.border;
  const r = consumed / target;
  if (r >= 0.85 && r <= 1.15) return '#4ADE80';
  if (r >= 0.70 && r <= 1.30) return COLORS.gold;
  return COLORS.red;
};

// ── Shared sub-components ──────────────────────────────────────────────────────
function StatBox({ label, value, sub }) {
  return (
    <View style={sb.box}>
      <Text style={sb.value}>{value}</Text>
      {sub ? <Text style={sb.sub}>{sub}</Text> : null}
      <Text style={sb.label}>{label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  box:   { flex: 1, alignItems: 'center' },
  value: { color: COLORS.white, fontSize: 20, fontWeight: FONT.black, letterSpacing: -0.5 },
  sub:   { color: COLORS.textDim, fontSize: 10, marginTop: 1 },
  label: { color: COLORS.textDim, fontSize: 9, letterSpacing: 1.5, marginTop: 3 },
});

function TipBox({ text }) {
  if (!text) return null;
  return (
    <View style={tp.wrap}>
      <Feather name="arrow-up-circle" size={12} color={COLORS.gold} style={{ marginTop: 2 }} />
      <Text style={tp.text}>{text}</Text>
    </View>
  );
}
const tp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8,
          backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.sm,
          borderWidth: 1, borderColor: COLORS.goldBorder,
          paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 },
  text: { flex: 1, color: '#ddd', fontSize: 12, lineHeight: 18 },
});

// ── Accordion pillar card ──────────────────────────────────────────────────────
function PillarAccordion({ icon, label, color, score, children }) {
  const [open, setOpen] = useState(false);
  const scoreColor = score !== null ? overallColor(score) : COLORS.textDim;

  return (
    <View style={ac.card}>
      {/* Tappable header row */}
      <TouchableOpacity
        style={ac.header}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.75}
      >
        {/* Icon box */}
        <View style={[ac.iconBox, { backgroundColor: color + '20' }]}>
          <Feather name={icon} size={15} color={color} />
        </View>

        {/* Label */}
        <Text style={ac.label}>{label}</Text>

        {/* Score badge */}
        {score !== null ? (
          <View style={[ac.badge, { borderColor: scoreColor + '55', backgroundColor: scoreColor + '18' }]}>
            <Text style={[ac.badgeText, { color: scoreColor }]}>{score}<Text style={ac.badgeSub}>/100</Text></Text>
          </View>
        ) : (
          <Text style={ac.noData}>NO DATA</Text>
        )}

        {/* Chevron */}
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={COLORS.textDim}
          style={{ marginLeft: 10 }}
        />
      </TouchableOpacity>

      {/* Expanded content */}
      {open && (
        <View style={ac.body}>
          <View style={ac.divider} />
          {children}
        </View>
      )}
    </View>
  );
}
const ac = StyleSheet.create({
  card:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
              borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden' },
  header:   { flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 16 },
  iconBox:  { width: 32, height: 32, borderRadius: RADIUS.sm,
              alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  label:    { flex: 1, color: COLORS.white, fontSize: 12, fontWeight: FONT.bold, letterSpacing: 2 },
  badge:    { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:{ fontSize: 14, fontWeight: FONT.black },
  badgeSub: { fontSize: 10, fontWeight: FONT.medium },
  noData:   { color: COLORS.textDim, fontSize: 10, letterSpacing: 2 },
  divider:  { height: 1, backgroundColor: COLORS.border, marginBottom: 16 },
  body:     { paddingHorizontal: 16, paddingBottom: 16 },
});

// ── REST content ───────────────────────────────────────────────────────────────
function RestContent({ rangeWkts }) {
  const tip = getRestTip(rangeWkts);

  if (rangeWkts.length < 2) {
    return <Text style={ct.emptyNote}>Log at least 2 sessions in this period to see your rest breakdown.</Text>;
  }

  const sorted   = [...rangeWkts].sort((a, b) => wTs(a) - wTs(b));
  const gaps     = [];
  for (let i = 1; i < sorted.length; i++)
    gaps.push((wTs(sorted[i]) - wTs(sorted[i-1])) / 86400000);

  const avgGap      = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const bestGap     = Math.min(...gaps);
  const optimalCount = gaps.filter(g => g >= 4 && g <= 7).length;

  return (
    <>
      <View style={ct.statsRow}>
        <StatBox label="AVG GAP"  value={`${avgGap.toFixed(1)}d`} />
        <View style={ct.statDiv} />
        <StatBox label="SHORTEST" value={`${bestGap.toFixed(1)}d`} />
        <View style={ct.statDiv} />
        <StatBox label="OPTIMAL"  value={`${optimalCount}/${gaps.length}`} sub="sessions" />
      </View>

      <Text style={ct.sectionLabel}>SESSION GAPS</Text>
      <View style={ct.gapRow}>
        {gaps.map((g, i) => (
          <View key={i} style={[ct.gapPill, { backgroundColor: gapColor(g) + '22', borderColor: gapColor(g) + '66' }]}>
            <Text style={[ct.gapText, { color: gapColor(g) }]}>{g < 1 ? '<1d' : `${Math.round(g)}d`}</Text>
          </View>
        ))}
      </View>

      <View style={ct.legend}>
        {[
          { color: COLORS.red,     label: '< 3d'  },
          { color: '#FB923C',      label: '3–4d'  },
          { color: '#4ADE80',      label: '4–7d ✓' },
          { color: COLORS.textDim, label: '7–14d' },
        ].map(item => (
          <View key={item.label} style={ct.legendItem}>
            <View style={[ct.legendDot, { backgroundColor: item.color }]} />
            <Text style={ct.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <TipBox text={tip} />
    </>
  );
}

// ── ROUTINE content ────────────────────────────────────────────────────────────
function RoutineContent({ rangeWkts, allSets, userRoutine }) {
  const tip = getRoutineTip(rangeWkts, allSets, userRoutine);

  if (!rangeWkts.length || !userRoutine.length) {
    return (
      <Text style={ct.emptyNote}>
        {!userRoutine.length
          ? 'Set up your routine in your profile to start tracking.'
          : 'Log a session in this period to see your routine breakdown.'}
      </Text>
    );
  }

  const totalSessions   = rangeWkts.length;
  const perfectSessions = rangeWkts.filter(w => {
    const unique = new Set(allSets.filter(s => s.workout_id === w.id).map(s => s.exercise_name)).size;
    return unique >= userRoutine.length;
  }).length;

  const completions = rangeWkts.map(w => {
    const unique = new Set(allSets.filter(s => s.workout_id === w.id).map(s => s.exercise_name)).size;
    return unique / userRoutine.length;
  });
  const avgPct = Math.round((completions.reduce((a, b) => a + b, 0) / completions.length) * 100);

  const exerciseStats = userRoutine.map(ex => {
    const hitCount = rangeWkts.filter(w =>
      allSets.some(s => s.workout_id === w.id && s.exercise_name === ex)
    ).length;
    return { name: ex, hit: hitCount, total: totalSessions, pct: hitCount / totalSessions };
  }).sort((a, b) => a.pct - b.pct);

  return (
    <>
      <View style={ct.statsRow}>
        <StatBox label="AVG COMPLETION" value={`${avgPct}%`} />
        <View style={ct.statDiv} />
        <StatBox label="PERFECT"  value={`${perfectSessions}/${totalSessions}`} sub="sessions" />
        <View style={ct.statDiv} />
        <StatBox label="EXERCISES" value={`${userRoutine.length}`} sub="in routine" />
      </View>

      <Text style={ct.sectionLabel}>EXERCISE BREAKDOWN</Text>
      {exerciseStats.map(ex => {
        const barColor = ex.pct >= 0.8 ? '#4ADE80' : ex.pct >= 0.5 ? COLORS.gold : COLORS.red;
        return (
          <View key={ex.name} style={ct.exRow}>
            <Text style={ct.exName} numberOfLines={1}>{ex.name}</Text>
            <View style={ct.exTrack}>
              <View style={[ct.exFill, { width: `${ex.pct * 100}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[ct.exCount, { color: barColor }]}>{ex.hit}/{ex.total}</Text>
          </View>
        );
      })}

      <TipBox text={tip} />
    </>
  );
}

// ── NUTRITION content ──────────────────────────────────────────────────────────
function NutritionContent({ rangeLogs, calTarget, rangeDays, goal }) {
  const tip = getNutritionTip(rangeLogs, calTarget, rangeDays, goal);

  if (!calTarget) {
    return <Text style={ct.emptyNote}>Complete your profile to set a calorie target.</Text>;
  }

  const byDate       = {};
  rangeLogs.forEach(l => { byDate[l.date] = (byDate[l.date] || 0) + l.calories; });
  const loggedDays   = Object.keys(byDate).length;
  const daysOnTarget = Object.values(byDate).filter(v => v >= calTarget * 0.85 && v <= calTarget * 1.15).length;
  const avgIntake    = loggedDays
    ? Math.round(Object.values(byDate).reduce((a, b) => a + b, 0) / loggedDays)
    : 0;
  const diff = avgIntake - calTarget;

  const displayDays = Math.min(rangeDays, 30);
  const dayDots = [];
  for (let i = displayDays - 1; i >= 0; i--) {
    const d   = new Date(); d.setDate(d.getDate() - i);
    const key = toLocalISO(d);
    dayDots.push({ key, consumed: byDate[key] || 0 });
  }

  return (
    <>
      <View style={ct.statsRow}>
        <StatBox
          label="AVG INTAKE"
          value={avgIntake ? `${(avgIntake/1000).toFixed(1)}k` : '—'}
          sub={avgIntake ? `${diff >= 0 ? '+' : ''}${diff} vs target` : null}
        />
        <View style={ct.statDiv} />
        <StatBox label="ON TARGET" value={`${daysOnTarget}/${loggedDays || '0'}`} sub="logged days" />
        <View style={ct.statDiv} />
        <StatBox label="LOGGED" value={`${loggedDays}/${rangeDays}`} sub="days" />
      </View>

      <Text style={ct.sectionLabel}>
        LAST {displayDays} DAYS{rangeDays > 30 ? ' (most recent 30)' : ''}
      </Text>
      <View style={ct.dayGrid}>
        {dayDots.map(({ key, consumed }) => (
          <View key={key} style={[ct.dayDot, { backgroundColor: dayColor(consumed, calTarget) }]} />
        ))}
      </View>

      <View style={ct.legend}>
        {[
          { color: '#4ADE80',      label: 'On target'  },
          { color: COLORS.gold,    label: 'Close'       },
          { color: COLORS.red,     label: 'Off'         },
          { color: COLORS.border,  label: 'Not logged'  },
        ].map(item => (
          <View key={item.label} style={ct.legendItem}>
            <View style={[ct.legendDot, { backgroundColor: item.color }]} />
            <Text style={ct.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <TipBox text={tip} />
    </>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function HDScoreDetailScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [rangeDays,   setRangeDays]   = useState(30);
  const [profile,     setProfile]     = useState(null);
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [allSets,     setAllSets]     = useState([]);
  const [calLogs,     setCalLogs]     = useState([]);
  const [loading,     setLoading]     = useState(true);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cutoff6M = toLocalISO(new Date(Date.now() - 180*24*3600*1000));
      const [profRes, wktRes, setRes, logRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('workouts').select('*').eq('user_id', user.id),
        supabase.from('sets').select('*').eq('user_id', user.id),
        supabase.from('calorie_logs').select('*').eq('user_id', user.id).gte('date', cutoff6M),
      ]);
      setProfile(profRes.data);
      setAllWorkouts(wktRes.data || []);
      setAllSets(setRes.data || []);
      setCalLogs(logRes.data || []);
    } catch (e) {
      console.error('[HDScoreDetail]', e);
    } finally {
      setLoading(false);
    }
  };

  const cutoffMs   = Date.now() - rangeDays * 24 * 3600 * 1000;
  const cutoffDate = toLocalISO(new Date(cutoffMs));
  const rangeWkts  = allWorkouts.filter(w => wTs(w) >= cutoffMs);
  const rangeLogs  = calLogs.filter(l => l.date >= cutoffDate);
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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: 44 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.title}>HD SCORE</Text>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={COLORS.gold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Range chips */}
          <View style={s.chips}>
            {RANGE_OPTIONS.map(opt => {
              const active = rangeDays === opt.days;
              return (
                <TouchableOpacity
                  key={opt.days}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setRangeDays(opt.days)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Overall score */}
          <View style={s.overallRow}>
            <Text style={[s.overallNum, { color: numColor }]}>
              {overall ?? '—'}<Text style={[s.overallSub, { color: numColor }]}>/100</Text>
            </Text>
            {label && (
              <View style={[s.labelBadge, { borderColor: numColor + '55', backgroundColor: numColor + '18' }]}>
                <Text style={[s.labelText, { color: numColor }]}>{label}</Text>
              </View>
            )}
          </View>

          <Text style={s.tapHint}>TAP A PILLAR TO EXPAND</Text>

          {/* Accordion pillars */}
          <PillarAccordion icon="clock" label="REST" color="#60A5FA" score={scores.rest}>
            <RestContent rangeWkts={rangeWkts} />
          </PillarAccordion>

          <PillarAccordion icon="check-circle" label="ROUTINE" color="#A78BFA" score={scores.routine}>
            <RoutineContent rangeWkts={rangeWkts} allSets={allSets} userRoutine={userRoutine} />
          </PillarAccordion>

          <PillarAccordion icon="target" label="NUTRITION" color="#34D399" score={scores.nutrition}>
            <NutritionContent
              rangeLogs={rangeLogs}
              calTarget={calTarget}
              rangeDays={rangeDays}
              goal={profile?.goal}
            />
          </PillarAccordion>
        </ScrollView>
      )}
    </View>
  );
}

// ── Shared content styles ──────────────────────────────────────────────────────
const ct = StyleSheet.create({
  emptyNote:    { color: COLORS.textDim, fontSize: 12, lineHeight: 18 },
  statsRow:     { flexDirection: 'row', marginBottom: 20 },
  statDiv:      { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },
  sectionLabel: { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, marginBottom: 10 },

  gapRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  gapPill: { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  gapText: { fontSize: 11, fontWeight: FONT.bold },

  legend:     { flexDirection: 'row', gap: 14, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: COLORS.textDim, fontSize: 9 },

  exRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  exName:  { color: '#ccc', fontSize: 11, width: 130, flexShrink: 0 },
  exTrack: { flex: 1, height: 3, backgroundColor: COLORS.border, borderRadius: 2, marginHorizontal: 8 },
  exFill:  { height: 3, borderRadius: 2 },
  exCount: { fontSize: 11, fontWeight: FONT.bold, width: 30, textAlign: 'right' },

  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  dayDot:  { width: 18, height: 18, borderRadius: 3 },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header:       { paddingHorizontal: SPACING.screen, paddingBottom: 16 },
  backBtn:      { marginBottom: 12 },
  backText:     { color: COLORS.textDim, fontSize: 11, letterSpacing: 2 },
  title:        { fontSize: 28, fontWeight: FONT.black, color: COLORS.white, letterSpacing: 5 },
  loader:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:      { paddingHorizontal: SPACING.screen },

  chips:        { flexDirection: 'row', gap: 6, marginBottom: 20 },
  chip:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                  borderWidth: 1, borderColor: COLORS.border },
  chipActive:   { borderColor: COLORS.gold, backgroundColor: COLORS.goldFaint },
  chipText:     { color: COLORS.textDim, fontSize: 9, fontWeight: FONT.bold, letterSpacing: 1 },
  chipTextActive: { color: COLORS.gold },

  overallRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  overallNum:   { fontSize: 52, fontWeight: FONT.black, letterSpacing: -2 },
  overallSub:   { fontSize: 22, fontWeight: FONT.semibold, letterSpacing: -1 },
  labelBadge:   { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  labelText:    { fontSize: 10, fontWeight: FONT.black, letterSpacing: 2 },

  tapHint:      { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, marginBottom: 16 },
});
