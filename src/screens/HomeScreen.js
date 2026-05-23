import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Path, Line, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getRecoveryStatus } from '../lib/progression';
import { getRandomQuote } from '../data/quotes';
import Card from '../components/Card';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

// ── Dev override — set to hours since last workout, null for real data ────────
const DEV_HOURS_SINCE = 51; // 2d 3h — set to null for real data

// ── Phase metadata ────────────────────────────────────────────────────────────
const PHASE_META = {
  recovering: { label: 'RECOVERING',     color: '#e05c5c' },
  repairing:  { label: 'REPAIRING',      color: '#e07a3a' },
  rebuilding: { label: 'REBUILDING',     color: '#c9a84c' },
  growing:    { label: 'GROWING',        color: '#8aad5c' },
  almost:     { label: 'ALMOST READY',   color: '#4CAF50' },
  ready:      { label: 'READY TO TRAIN', color: '#4CAF50' },
  overdue:    { label: 'OVERDUE',        color: '#888'    },
};

// ── Calorie / macro helpers ───────────────────────────────────────────────────
const calcTDEE = (p) => {
  if (!p?.bodyweight_kg || !p?.height_cm || !p?.age) return null;
  const bmr = 10 * p.bodyweight_kg + 6.25 * p.height_cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  return Math.round(bmr * 1.375);
};

const calcCalories = (p) => {
  const tdee = calcTDEE(p);
  return tdee ? tdee + (p.calorie_adjustment || 0) : null;
};

const calcMacros = (calories, bwKg) => {
  if (!calories || !bwKg) return null;
  const protein = Math.round(bwKg * 2.2);
  const fat     = Math.round((calories * 0.27) / 9);
  const carbs   = Math.round(Math.max(0, (calories - protein * 4 - fat * 9) / 4));
  return { protein, fat, carbs };
};

// ── Formatting helpers ────────────────────────────────────────────────────────
function getTodayLabel() {
  const D = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const M = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const n = new Date();
  return `${D[n.getDay()]} · ${M[n.getMonth()]} ${n.getDate()}`;
}

function fmtTimeSince(h) {
  if (h === null) return 'No workouts logged yet';
  const d = Math.floor(h / 24), hrs = Math.floor(h % 24);
  if (d === 0) return `${hrs}h since last workout`;
  if (hrs === 0) return `${d}d since last workout`;
  return `${d}d ${hrs}h since last workout`;
}

// ── 30-Day Activity Chart ─────────────────────────────────────────────────────
function ActivityChart({ workoutDates, containerWidth: w }) {
  const DAYS = 30;
  const H    = 44;
  const gap  = 2;
  const bw   = (w - gap * (DAYS - 1)) / DAYS;
  const MAX  = 34;
  const MIN  = 6;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Convert any date to "YYYY-MM-DD" in LOCAL time — locale-independent, no UTC shift
  const toLocalISO = (d) => {
    const dt = new Date(d);
    const y  = dt.getFullYear();
    const m  = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const trained = new Set(workoutDates.map(d => toLocalISO(d)));
  console.log('[ActivityChart] trained dates:', [...trained]);

  const bars = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const iso = toLocalISO(d);
    return { hit: trained.has(iso), isToday: i === DAYS - 1 };
  });

  if (w <= 0) return null;
  return (
    <Svg width={w} height={H}>
      {bars.map((b, i) => {
        const x = i * (bw + gap);
        const bh = b.hit ? MAX : MIN;
        return (
          <Rect
            key={i} x={x} y={H - bh}
            width={bw} height={bh}
            fill={b.hit ? COLORS.gold : b.isToday ? '#4a4a4e' : '#333336'}
            rx={Math.min(bw / 2, 3)}
          />
        );
      })}
    </Svg>
  );
}

// ── Supercompensation Curve ───────────────────────────────────────────────────
// Based on Mentzer's Heavy Duty II model:
//   - HD training (one set to failure) causes deeper fatigue than conventional
//   - Fatigue BOTTOM: ~36h (day 1.5) — DOMS peak + CNS depletion
//   - Returns to baseline: ~72h (day 3)
//   - Supercompensation starts: ~84h (day 3.5)
//   - Mentzer MINIMUM ready: 96h / day 4 ("when in doubt, wait one more day")
//   - TRUE PEAK: ~132h / day 5.5 (Mentzer's ideal training day)
//   - End of window: 168h / day 7 (Mentzer: "do NOT wait longer")
//   - Involution back to baseline: ~day 10-11
//
// Data: [day (fractional), muscle_capacity_%]. Points every 0.25–0.5d for
// sub-hour interpolation accuracy. Dot moves visibly each hour (~1.4px/h).
const SC_DATA = [
  [0,    100],  // workout complete — at baseline
  [0.25,  97],  // 6h  — fatigue accumulating
  [0.5,   91],  // 12h — significant fatigue
  [1.0,   83],  // 24h — deep fatigue, DOMS onset
  [1.5,   76],  // 36h — FATIGUE BOTTOM (DOMS peak + CNS depletion)
  [2.0,   79],  // 48h — repair begins, DOMS subsiding
  [2.5,   88],  // 60h — active tissue rebuilding
  [3.0,   96],  // 72h — approaching baseline
  [3.5,  104],  // 84h — entering supercompensation territory
  [4.0,  111],  // 96h — Mentzer Day 4: "almost ready, when in doubt wait"
  [4.5,  116],  // 108h — building to peak
  [5.0,  120],  // 120h — Mentzer Day 5: "fully recovered, train today"
  [5.5,  122],  // 132h — PEAK supercompensation
  [6.0,  121],  // 144h — Mentzer Day 6: "ideal training day"
  [6.5,  118],  // 156h — beginning to decline
  [7.0,  114],  // 168h — Mentzer Day 7: "train NOW, past peak"
  [7.5,  110],  // 180h
  [8.0,  106],  // 192h — Mentzer: "overdue"
  [8.5,  103],  // 204h
  [9.0,  101],  // 216h
  [9.5,  100],  // 228h — back to baseline
  [10.0, 100],  // 240h — baseline, involution complete
];

// Sparse key points used only for drawing the visual curve.
// Fewer, evenly-spaced points → Catmull-Rom stays stable with no oscillations.
const SC_CURVE = [
  [0.0,  100],
  [1.5,   76],
  [3.0,   96],
  [4.5,  116],
  [5.5,  122],
  [7.0,  114],
  [9.0,  101],
  [10.0, 100],
];

// Linear interpolation between dense data points.
// With points every 0.25–0.5 days, each hour moves the dot ~1.4px on a 340px chart.
function interpCap(dayFloat) {
  if (dayFloat <= SC_DATA[0][0]) return SC_DATA[0][1];
  if (dayFloat >= SC_DATA[SC_DATA.length - 1][0]) return SC_DATA[SC_DATA.length - 1][1];
  for (let i = 0; i < SC_DATA.length - 1; i++) {
    if (dayFloat >= SC_DATA[i][0] && dayFloat <= SC_DATA[i + 1][0]) {
      const t = (dayFloat - SC_DATA[i][0]) / (SC_DATA[i + 1][0] - SC_DATA[i][0]);
      return SC_DATA[i][1] + t * (SC_DATA[i + 1][1] - SC_DATA[i][1]);
    }
  }
  return 100;
}

function smoothPath(pts) {
  // Catmull-Rom → cubic bezier
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function RecoveryChart({ hoursSince, width }) {
  const H   = 114;
  const PL  = 6, PR = 6, PT = 20, PB = 18;
  const CW  = width - PL - PR;
  const CH  = H - PT - PB;
  const MAX_D = 10;
  const MIN_C = 74, MAX_C = 126;

  const toX = d => PL + (d / MAX_D) * CW;
  const toY = c => PT + CH - ((c - MIN_C) / (MAX_C - MIN_C)) * CH;
  const baseY = toY(100);

  // Visual curve uses sparse key points — stable Catmull-Rom, no oscillations
  const pixPts   = SC_CURVE.map(([d, c]) => ({ x: toX(d), y: toY(c) }));
  const linePath = smoothPath(pixPts);
  // Closed fill path (above baseline)
  const fillPath = `${linePath} L ${toX(MAX_D)} ${baseY} L ${toX(0)} ${baseY} Z`;

  const dayFloat = hoursSince !== null ? Math.min(hoursSince / 24, MAX_D) : null;
  const curX     = dayFloat !== null ? toX(dayFloat) : null;
  const curY     = dayFloat !== null ? toY(interpCap(dayFloat)) : null;

  const zones = [
    { from: 0,   to: 3,    fill: '#e05c5c10' },  // fatigue (red)
    { from: 3,   to: 4,    fill: '#c9a84c10' },  // rebuilding (amber)
    { from: 4,   to: 7,    fill: '#4CAF5016' },  // TRAIN WINDOW (green)
    { from: 7,   to: MAX_D, fill: '#28282820' },  // overdue (dark)
  ];

  if (width <= 0) return null;

  return (
    <Svg width={width} height={H}>
      {/* Zone background bands */}
      {zones.map((z, i) => (
        <Rect
          key={i}
          x={toX(z.from)} y={PT}
          width={toX(z.to) - toX(z.from)}
          height={CH}
          fill={z.fill}
        />
      ))}

      {/* Baseline — 100% capacity */}
      <Line
        x1={PL} y1={baseY} x2={PL + CW} y2={baseY}
        stroke="#3a3a3a" strokeWidth={1} strokeDasharray="4 3"
      />
      <SvgText x={PL + 3} y={baseY - 4} fontSize={7} fill="#444" letterSpacing={1}>
        BASELINE
      </SvgText>

      {/* Supercompensation fill */}
      <Path d={fillPath} fill={`${COLORS.gold}0e`} />

      {/* Curve */}
      <Path
        d={linePath} fill="none"
        stroke={COLORS.gold} strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* Train window label — sits in top padding, above the chart area */}
      <SvgText
        x={toX(5.5)} y={PT - 8}
        fontSize={7} fill="#4CAF5099"
        textAnchor="middle" fontWeight="700" letterSpacing={1}
      >
        TRAIN WINDOW
      </SvgText>

      {/* Day 4 minimum-ready dashed tick */}
      <Line
        x1={toX(4)} y1={PT + 14} x2={toX(4)} y2={PT + CH}
        stroke="#4CAF5044" strokeWidth={1} strokeDasharray="2 3"
      />
      <SvgText
        x={toX(4)} y={PT + CH + 2}
        fontSize={6.5} fill="#4CAF5077"
        textAnchor="middle"
      >
        MIN
      </SvgText>

      {/* Peak marker at day 5.5 */}
      <SvgText
        x={toX(5.5)} y={toY(122) - 5}
        fontSize={7} fill={`${COLORS.gold}99`}
        textAnchor="middle" fontWeight="700"
      >
        PEAK
      </SvgText>

      {/* Current day vertical marker */}
      {curX !== null && (
        <>
          <Line
            x1={curX} y1={PT} x2={curX} y2={H - PB}
            stroke={COLORS.gold} strokeWidth={1.5} strokeDasharray="3 3"
          />
          {/* Outer glow */}
          <Circle cx={curX} cy={curY} r={10} fill={`${COLORS.gold}1a`} />
          {/* Mid ring */}
          <Circle cx={curX} cy={curY} r={6}  fill={`${COLORS.gold}33`} />
          {/* Dot */}
          <Circle cx={curX} cy={curY} r={4}  fill={COLORS.gold} />
        </>
      )}

      {/* X-axis labels */}
      {[0, 2, 4, 6, 8].map(d => (
        <SvgText
          key={d}
          x={toX(d)} y={H - 5}
          fontSize={8} fill="#555"
          textAnchor="middle"
        >
          {d === 0 ? 'DAY 0' : `${d}d`}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Macro Bar ─────────────────────────────────────────────────────────────────
function MacroBar({ label, grams, color, totalCal, factor }) {
  const cals = grams * factor;
  const pct  = totalCal > 0 ? Math.min(1, cals / totalCal) : 0;
  return (
    <View style={mb.wrap}>
      <View style={mb.header}>
        <Text style={[mb.label, { color }]}>{label}</Text>
        <Text style={mb.grams}>{grams}g</Text>
      </View>
      <View style={mb.track}>
        <View style={[mb.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={mb.cals}>{cals} kcal</Text>
    </View>
  );
}

const mb = StyleSheet.create({
  wrap:   { flex: 1, paddingHorizontal: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label:  { fontSize: 9, letterSpacing: 1.5, fontWeight: FONT.black },
  grams:  { color: COLORS.white, fontSize: 13, fontWeight: FONT.semibold },
  track:  { height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginBottom: 5 },
  fill:   { height: 4, borderRadius: 2 },
  cals:   { color: COLORS.textFaint, fontSize: 9 },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [profile,        setProfile]        = useState(null);
  const [recoveryStatus, setRecoveryStatus] = useState(null);
  const [quote,          setQuote]          = useState('');
  const [totalWorkouts,  setTotalWorkouts]  = useState(0);
  const [hoursSince,     setHoursSince]     = useState(null);
  const [workoutDates,   setWorkoutDates]   = useState([]);
  const [chartWidth,     setChartWidth]     = useState(0);
  const [recoveryWidth,  setRecoveryWidth]  = useState(0);
  const [refreshing,     setRefreshing]     = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    // DEV override — mocks recovery timing but still fetches real profile for nutrition
    if (DEV_HOURS_SINCE !== null) {
      setHoursSince(DEV_HOURS_SINCE);
      const s = getRecoveryStatus(Math.floor(DEV_HOURS_SINCE / 24));
      setRecoveryStatus(s);
      setQuote(getRandomQuote(s.readyToTrain ? 'preWorkout' : 'restDay'));
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          setProfile(data);
        }
      } catch (_) {}
      return;
    }

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) { console.error('[HomeScreen] auth error:', authErr); }
      if (!user) {
        setRecoveryStatus(getRecoveryStatus(99));
        setQuote(getRandomQuote('preWorkout'));
        return;
      }

      // Fetch all workouts with select('*') — avoids referencing any specific column
      // that might not exist. Sort entirely in JS.
      const [profRes, workoutsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('workouts').select('*').eq('user_id', user.id),
      ]);

      if (profRes.error)    console.error('[HomeScreen] profiles error:', profRes.error);
      if (workoutsRes.error) console.error('[HomeScreen] workouts error:', workoutsRes.error);

      setProfile(profRes.data);

      // Find a timestamp from whatever column exists
      const ts = r => r.created_at || r.inserted_at || r.date || '';

      const allWorkouts = (workoutsRes.data || []).sort((a, b) => ts(b).localeCompare(ts(a)));
      console.log('[HomeScreen] allWorkouts count:', allWorkouts.length);
      console.log('[HomeScreen] first workout:', JSON.stringify(allWorkouts[0]));

      // Last 30 days
      const cutoffMs = Date.now() - 30 * 24 * 3600 * 1000;
      const recent   = allWorkouts.filter(w => new Date(ts(w)).getTime() >= cutoffMs);
      const dates    = recent.map(w => ts(w));
      console.log('[HomeScreen] recent workout dates:', JSON.stringify(dates));
      setWorkoutDates(dates);

      let daysSince = null, totalHours = null;
      if (allWorkouts.length) {
        totalHours = (Date.now() - new Date(ts(allWorkouts[0])).getTime()) / 3_600_000;
        daysSince  = Math.floor(totalHours / 24);
        console.log('[HomeScreen] totalHours:', totalHours, 'daysSince:', daysSince);
      }
      setHoursSince(totalHours);

      const s = getRecoveryStatus(daysSince ?? 99);
      setRecoveryStatus(s);
      setQuote(getRandomQuote(s.readyToTrain ? 'preWorkout' : 'restDay'));

    } catch (e) {
      console.error('[HomeScreen] loadData crash:', e);
      setRecoveryStatus(getRecoveryStatus(99));
      setQuote(getRandomQuote('preWorkout'));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Derived values
  const status     = recoveryStatus?.status || 'ready';
  const phase      = PHASE_META[status]     || PHASE_META.ready;
  const isReady    = recoveryStatus?.readyToTrain ?? true;
  const daysSince  = hoursSince !== null ? Math.floor(hoursSince / 24) : null;
  const hourOfDay  = hoursSince !== null ? Math.floor(hoursSince % 24) : null;
  // e.g. "Day 2 · 14h" — changes every hour so user sees the curve dot shift
  const preciseDay = daysSince !== null
    ? hourOfDay > 0 ? `Day ${daysSince} · ${hourOfDay}h` : `Day ${daysSince}`
    : 'Day 0';
  const firstName  = profile?.name?.split(' ')[0] || null;

  const calories  = calcCalories(profile);
  const macros    = calcMacros(calories, profile?.bodyweight_kg);
  const GOAL_LABEL = { bulk: 'GAINING', cut: 'CUTTING', recomp: 'RECOMP', maintain: 'MAINTAIN' };
  const goalLabel = GOAL_LABEL[profile?.goal] || null;

  const sessions30 = workoutDates.length;
  const avgRest    = sessions30 > 1 ? Math.round(30 / sessions30) : null;

  return (
    <View style={s.container}>
    <ScrollView
      contentContainerStyle={[s.content, { paddingBottom: 80 + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{firstName ? `Welcome back, ${firstName}.` : 'Welcome.'}</Text>
          <Text style={s.dateLabel}>{getTodayLabel()}</Text>
        </View>
        <Text style={s.logo}>M</Text>
      </View>

      {/* ── 30-Day Activity ──────────────────────────────────────────── */}
      <Card style={s.section}>
        <View style={s.row}>
          <Text style={s.label}>LAST 30 DAYS</Text>
          <Text style={s.meta}>
            {sessions30} session{sessions30 !== 1 ? 's' : ''}
            {avgRest ? ` · avg ${avgRest}d rest` : ''}
          </Text>
        </View>
        <View onLayout={e => setChartWidth(e.nativeEvent.layout.width)}>
          {chartWidth > 0 && (
            <ActivityChart workoutDates={workoutDates} containerWidth={chartWidth} />
          )}
        </View>
      </Card>

      {/* ── Recovery Curve ───────────────────────────────────────────── */}
      <Card style={s.section}>
        <View style={s.row}>
          <Text style={s.label}>RECOVERY CURVE</Text>
          <Text style={s.meta}>{fmtTimeSince(hoursSince)}</Text>
        </View>

        {/* Supercompensation SVG chart */}
        <View onLayout={e => setRecoveryWidth(e.nativeEvent.layout.width)}>
          {recoveryWidth > 0 && (
            <RecoveryChart hoursSince={hoursSince} width={recoveryWidth} />
          )}
        </View>

        {/* Phase status row below chart */}
        <View style={[s.row, { marginTop: SPACING.md, marginBottom: 0 }]}>
          <View style={[s.phasePill, { borderColor: phase.color + '55', backgroundColor: phase.color + '18' }]}>
            <Text style={[s.phasePillText, { color: phase.color }]}>{phase.label}</Text>
          </View>
          <Text style={[s.dayCount, { fontSize: 16 }]}>{preciseDay}</Text>
        </View>
        <Text style={[s.advice, { marginTop: 6 }]}>
          {recoveryStatus?.message || ''}
        </Text>
      </Card>

      {/* ── Nutrition ────────────────────────────────────────────────── */}
      <Card style={s.section}>
        <View style={s.row}>
          <Text style={s.label}>DAILY NUTRITION</Text>
          {goalLabel && (
            <View style={s.goalBadge}>
              <Text style={s.goalText}>{goalLabel}</Text>
            </View>
          )}
        </View>

        {calories ? (
          <>
            <View style={s.calRow}>
              <Text style={s.calNum}>{calories.toLocaleString()}</Text>
              <Text style={s.calUnit}>kcal / day</Text>
            </View>
            {macros && (
              <View style={s.macrosRow}>
                <MacroBar label="PROTEIN" grams={macros.protein} color={COLORS.gold}  totalCal={calories} factor={4} />
                <MacroBar label="CARBS"   grams={macros.carbs}   color="#7ab5e0"       totalCal={calories} factor={4} />
                <MacroBar label="FAT"     grams={macros.fat}     color="#8aad5c"       totalCal={calories} factor={9} />
              </View>
            )}
          </>
        ) : (
          <Text style={s.empty}>Complete onboarding to see your calorie target.</Text>
        )}
      </Card>

    </ScrollView>

    {/* ── Pinned START WORKOUT bar ─────────────────────────────────── */}
    <View style={[s.trainBar, { paddingBottom: 12 + insets.bottom }]}>
      <TouchableOpacity
        style={[s.trainBtn, !isReady && s.trainBtnDim]}
        onPress={() => navigation.navigate('Workout')}
        activeOpacity={0.85}
      >
        <Text style={[s.trainBtnText, !isReady && s.trainBtnTextDim]}>
          START WORKOUT
        </Text>
      </TouchableOpacity>
    </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { paddingBottom: 20 },

  // Header
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
               paddingTop: 44, paddingHorizontal: SPACING.screen, paddingBottom: 12 },
  greeting:  { color: '#999', fontSize: 12, marginBottom: 3 },
  dateLabel: { color: COLORS.white, fontSize: 11, letterSpacing: 3, fontWeight: FONT.semibold },
  logo:      { fontSize: 30, fontWeight: FONT.black, color: COLORS.gold, letterSpacing: 2 },

  // Cards
  section: { marginHorizontal: SPACING.screen, marginBottom: 8 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label:   { color: '#ccc', fontSize: 10, fontWeight: FONT.semibold, letterSpacing: 2 },
  meta:    { color: '#999', fontSize: 10, letterSpacing: 1 },
  empty:   { color: '#aaa', fontSize: 12, lineHeight: 18 },

  // Recovery
  phasePill:    { alignSelf: 'flex-start', borderRadius: RADIUS.sm, borderWidth: 1,
                  paddingHorizontal: 9, paddingVertical: 3 },
  phasePillText:{ fontSize: 9, fontWeight: FONT.black, letterSpacing: 2 },
  dayCount:     { color: COLORS.white, fontSize: 16, fontWeight: FONT.black },
  advice:       { color: '#bbb', fontSize: 11, lineHeight: 16 },

  // Pinned train bar
  trainBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.screen,
    paddingTop: 10,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  trainBtn:        { backgroundColor: COLORS.gold, paddingVertical: 15,
                     borderRadius: RADIUS.lg, alignItems: 'center' },
  trainBtnDim:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.goldBorder },
  trainBtnText:    { color: '#000', fontSize: 14, fontWeight: FONT.black, letterSpacing: 3 },
  trainBtnTextDim: { color: COLORS.gold },

  // Nutrition
  calRow:    { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  calNum:    { color: COLORS.white, fontSize: 34, fontWeight: FONT.black, letterSpacing: -1 },
  calUnit:   { color: '#aaa', fontSize: 12, marginLeft: 8, fontWeight: FONT.semibold },
  macrosRow: { flexDirection: 'row', marginHorizontal: -4 },
  goalBadge: { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.sm,
               paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.goldBorder },
  goalText:  { color: COLORS.gold, fontSize: 9, letterSpacing: 1.5, fontWeight: FONT.semibold },
});
