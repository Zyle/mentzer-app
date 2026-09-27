import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getSessions, workoutAdherence, calcRoutineScore } from '../lib/routineScore';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, FONT, TYPE, RADIUS, SPACING } from '../theme';

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

const overallColor = s => s >= 80 ? COLORS.gold : s >= 60 ? COLORS.orange : COLORS.red;
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

const getRoutineTip = (rangeWkts, allSets, sessions) => {
  const rows = workoutAdherence(rangeWkts, allSets, sessions);
  if (!rows.length) return null;
  const completions = rows.map(r => r.completion);
  const avg    = completions.reduce((a, b) => a + b, 0) / completions.length;
  const pct    = Math.round(avg * 100);
  const rLen   = Math.max(1, Math.round(rows.reduce((a, r) => a + r.session.exercises.length, 0) / rows.length));
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
  if (days < 4)   return COLORS.orange;
  if (days <= 7)  return COLORS.green;
  if (days <= 14) return COLORS.textMuted;
  return COLORS.textFaint;
};
const dayColor = (consumed, target) => {
  if (!consumed || !target) return COLORS.border;
  const r = consumed / target;
  if (r >= 0.85 && r <= 1.15) return COLORS.green;
  if (r >= 0.70 && r <= 1.30) return COLORS.gold;
  return COLORS.red;
};

// ── Shared sub-components ──────────────────────────────────────────────────────
function StatBox({ label, value, sub }) {
  return (
    <View style={sb.box} accessible accessibilityLabel={`${label.toLowerCase()}: ${value}${sub ? `, ${sub}` : ''}`}>
      <Text style={sb.value}>{value}</Text>
      {sub ? <Text style={sb.sub}>{sub}</Text> : null}
      <Text style={sb.label}>{label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  box:   { flex: 1, alignItems: 'center' },
  value: { color: COLORS.white, fontSize: 20, fontWeight: FONT.black, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  sub:   { color: COLORS.textDim, fontSize: 11, marginTop: 1 },
  label: { ...TYPE.overline, fontSize: 11, letterSpacing: 1, color: COLORS.textMuted, marginTop: 3, textAlign: 'center' },
});

function TipBox({ text }) {
  if (!text) return null;
  return (
    <View style={tp.wrap}>
      <Feather name="message-circle" size={14} color={COLORS.gold} style={{ marginTop: 2 }} />
      <Text style={tp.text}>{text}</Text>
    </View>
  );
}
const tp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md,
          paddingHorizontal: 12, paddingVertical: 12, marginTop: 16 },
  text: { ...TYPE.callout, flex: 1, color: COLORS.textSecondary },
});

// ── Accordion pillar card ──────────────────────────────────────────────────────
function PillarAccordion({ icon, label, color, score, children }) {
  const [open, setOpen] = useState(false);
  const scoreColor = score !== null ? overallColor(score) : COLORS.textDim;

  return (
    <View style={ac.card}>
      {/* Tappable header row */}
      <Pressable
        style={({ pressed }) => [ac.header, pressed && { backgroundColor: COLORS.surfaceRaised }]}
        onPress={() => setOpen(o => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label.toLowerCase()} score, ${score !== null ? `${score} out of 100` : 'no data yet'}`}
        accessibilityHint={open ? 'Collapses the breakdown' : 'Shows the breakdown'}
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
      </Pressable>

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
  card:     { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
              borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden' },
  header:   { flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 16 },
  iconBox:  { width: 32, height: 32, borderRadius: RADIUS.sm,
              alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  label:    { flex: 1, color: COLORS.white, fontSize: 13, fontWeight: FONT.bold, letterSpacing: 1.5 },
  badge:    { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:{ fontSize: 14, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  badgeSub: { fontSize: 11, fontWeight: FONT.medium },
  noData:   { ...TYPE.overline, color: COLORS.textDim },
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
          { color: COLORS.orange,    label: '3–4d'  },
          { color: COLORS.green,     label: '4–7d ✓' },
          { color: COLORS.textMuted, label: '7–14d' },
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
function RoutineContent({ rangeWkts, allSets, sessions }) {
  const tip = getRoutineTip(rangeWkts, allSets, sessions);

  if (!rangeWkts.length || !sessions.length) {
    return (
      <Text style={ct.emptyNote}>
        {!sessions.length
          ? 'Set up your programme to start tracking your routine.'
          : 'Log a session in this period to see your routine breakdown.'}
      </Text>
    );
  }

  const rows            = workoutAdherence(rangeWkts, allSets, sessions);
  const totalSessions   = rows.length;
  const perfectSessions = rows.filter(r => r.completion >= 1).length;
  const avgPct = Math.round((rows.reduce((a, r) => a + r.completion, 0) / totalSessions) * 100);

  // Per exercise: how often it was done in the sessions that programmed it
  const programmed = [...new Map(sessions.flatMap(ss => ss.exercises).map(e => [e.name, e])).values()];
  const exerciseStats = programmed.map(ex => {
    const relevant = rows.filter(r => r.session.exercises.some(e => e.name === ex.name));
    const hit = relevant.filter(r => r.done.has(ex.name)).length;
    return { name: ex.name, hit, total: relevant.length, pct: relevant.length ? hit / relevant.length : 0 };
  }).filter(ex => ex.total > 0).sort((a, b) => a.pct - b.pct);

  return (
    <>
      <View style={ct.statsRow}>
        <StatBox label="AVG COMPLETION" value={`${avgPct}%`} />
        <View style={ct.statDiv} />
        <StatBox label="COMPLETE"  value={`${perfectSessions}/${totalSessions}`} sub="sessions" />
        <View style={ct.statDiv} />
        <StatBox label="EXERCISES" value={`${programmed.length}`} sub={sessions.length > 1 ? `across ${sessions.length} workouts` : 'in routine'} />
      </View>

      <Text style={ct.sectionLabel}>EXERCISE BREAKDOWN</Text>
      {exerciseStats.map(ex => {
        const barColor = ex.pct >= 0.8 ? COLORS.green : ex.pct >= 0.5 ? COLORS.gold : COLORS.red;
        return (
          <View key={ex.name} style={ct.exRow} accessible accessibilityLabel={`${ex.name}: done in ${ex.hit} of ${ex.total} sessions`}>
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
          { color: COLORS.green,   label: 'On target'  },
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
      // Only count workouts with at least one set logged, matching the Home card
      const sets      = setRes.data || [];
      const loggedIds = new Set(sets.map(st => st.workout_id));
      setAllWorkouts((wktRes.data || []).filter(w => loggedIds.has(w.id)));
      setAllSets(sets);
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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScreenHeader title="Heavy Duty Score" subtitle="ROUTINE · REST · NUTRITION" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={COLORS.gold} accessibilityLabel="Loading score" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Range chips */}
          <View style={s.chips} accessibilityRole="tablist">
            {RANGE_OPTIONS.map(opt => {
              const active = rangeDays === opt.days;
              return (
                <Pressable
                  key={opt.days}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setRangeDays(opt.days)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Last ${opt.label}`}
                  hitSlop={6}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Overall score */}
          <View style={s.overallRow} accessible accessibilityLabel={overall !== null ? `Overall score ${overall} out of 100, ${label}` : 'No score yet'}>
            <Text style={[s.overallNum, { color: numColor }]}>
              {overall ?? '—'}<Text style={s.overallSub}>/100</Text>
            </Text>
            {label && (
              <View style={[s.labelBadge, { borderColor: numColor + '55', backgroundColor: numColor + '18' }]}>
                <Text style={[s.labelText, { color: numColor }]}>{label}</Text>
              </View>
            )}
          </View>

          <Text style={s.tapHint}>Tap a pillar to see the breakdown.</Text>

          {/* Accordion pillars */}
          <PillarAccordion icon="clock" label="REST" color={COLORS.blue} score={scores.rest}>
            <RestContent rangeWkts={rangeWkts} />
          </PillarAccordion>

          <PillarAccordion icon="check-circle" label="ROUTINE" color={COLORS.violet} score={scores.routine}>
            <RoutineContent rangeWkts={rangeWkts} allSets={allSets} sessions={sessions} />
          </PillarAccordion>

          <PillarAccordion icon="target" label="NUTRITION" color={COLORS.teal} score={scores.nutrition}>
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
  emptyNote:    { ...TYPE.callout, color: COLORS.textMuted },
  statsRow:     { flexDirection: 'row', marginBottom: 20 },
  statDiv:      { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },
  sectionLabel: { ...TYPE.overline, color: COLORS.textDim, marginBottom: 10 },

  gapRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  gapPill: { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  gapText: { fontSize: 12, fontWeight: FONT.bold },

  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: COLORS.textMuted, fontSize: 11 },

  exRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  exName:  { color: COLORS.textSecondary, fontSize: 13, width: 130, flexShrink: 0 },
  exTrack: { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginHorizontal: 8 },
  exFill:  { height: 4, borderRadius: 2 },
  exCount: { fontSize: 12, fontWeight: FONT.bold, width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },

  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  dayDot:  { width: 18, height: 18, borderRadius: 3 },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  loader:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:      { paddingHorizontal: SPACING.screen },

  chips:        { flexDirection: 'row', gap: 6, marginBottom: 20 },
  chip:         { minWidth: 44, height: 32, paddingHorizontal: 10, borderRadius: RADIUS.pill,
                  borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  chipActive:   { borderColor: COLORS.goldBorder, backgroundColor: COLORS.goldFaint },
  chipText:     { color: COLORS.textDim, fontSize: 12, fontWeight: FONT.bold },
  chipTextActive: { color: COLORS.gold },

  overallRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  overallNum:   { fontSize: 56, fontWeight: FONT.black, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  overallSub:   { fontSize: 20, fontWeight: FONT.semibold, letterSpacing: 0, color: COLORS.textDim },
  labelBadge:   { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  labelText:    { fontSize: 11, fontWeight: FONT.black, letterSpacing: 1.5 },

  tapHint:      { ...TYPE.callout, color: COLORS.textDim, marginBottom: 16 },
});
