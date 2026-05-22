import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

// ─── Step definitions ─────────────────────────────────────────────────────────
// Steps 0-3: one compound group each
// Step 4: isolation (optional)
// Step 5: summary
const STEPS = ['legs', 'push', 'pull', 'posterior', 'isolation', 'summary'];

// ─── Compound groups ──────────────────────────────────────────────────────────
const COMPOUND_GROUPS = [
  {
    id: 'legs',
    label: 'LEGS',
    tagline: 'The foundation of everything.',
    note: 'Heavy leg work triggers a systemic hormonal surge that grows every muscle in your body — not just your legs.',
    options: [
      { name: 'Squats',    sub: 'Full ROM · Below parallel' },
      { name: 'Leg Press', sub: 'Safer alternative · Full ROM only' },
    ],
  },
  {
    id: 'push',
    label: 'PUSH',
    tagline: 'The upper body squat.',
    note: 'Chest, shoulders and triceps loaded simultaneously through a full, natural range of motion.',
    options: [
      { name: 'Weighted Dips',  sub: 'Mentzer\'s #1 upper body exercise' },
      { name: 'Incline Press',  sub: '30–45° · Use if Dips cause shoulder pain' },
    ],
  },
  {
    id: 'pull',
    label: 'PULL',
    tagline: 'The stretch that drives growth.',
    note: 'Palms facing you. Full dead-hang at the top. The supinated grip allows maximum lat stretch — that stretch is everything.',
    options: [
      { name: 'Close-Grip Pulldowns', sub: 'Mentzer\'s preferred pull · Palms up' },
      { name: 'Weighted Chin-Ups',    sub: 'Add weight via belt · Dead hang required' },
    ],
  },
  {
    id: 'posterior',
    label: 'POSTERIOR CHAIN',
    tagline: 'The king of all exercises.',
    note: 'Works more total muscle than any other single movement ever devised. Non-negotiable.',
    options: [
      { name: 'Deadlifts', sub: 'The ultimate mass builder · No alternative' },
    ],
  },
];

// ─── Compound exercise info ───────────────────────────────────────────────────
const COMPOUND_INFO = {
  'Squats': {
    quote: '"The single most productive exercise known to man. Heavy squats stimulate more muscle, trigger a greater hormonal response, and produce more systemic growth stimulus than any other movement ever devised."',
    why: 'Heavy squats don\'t just build legs. They trigger a whole-body release of testosterone and growth hormone that makes every other muscle in your body grow faster too.',
    systemic: true,
  },
  'Leg Press': {
    quote: '"A worthy alternative for those with structural limitations. The same systemic principles apply — one set, maximum intensity, absolute failure."',
    why: 'Provides the same systemic hormonal stimulus as Squats in a mechanically safer position. Full range of motion is non-negotiable.',
    systemic: true,
  },
  'Weighted Dips': {
    quote: '"Dips are the upper body squat. They work the chest, shoulders and triceps through a full, natural range of motion more effectively than any pressing movement. I rate them above the bench press in every respect."',
    why: 'The forward lean shifts emphasis to the pectorals. The deep stretch at the bottom recruits far more muscle fibre than a bench press. Add weight via a dipping belt as soon as bodyweight becomes manageable.',
    systemic: false,
  },
  'Incline Press': {
    quote: '"If Dips cause shoulder discomfort, the incline press at 30–45 degrees is the most effective pressing alternative. The incline removes impingement risk while maintaining strong pec involvement."',
    why: 'The incline angle reduces anterior deltoid involvement and increases upper pec activation. A controlled 4-second negative phase dramatically increases the growth stimulus.',
    systemic: false,
  },
  'Close-Grip Pulldowns': {
    quote: '"The supinated grip pulldown is the finest lat exercise available. The palms-facing-you grip allows full bicep assistance and the lats to achieve maximum stretch at the top — the stretch that drives growth."',
    why: 'Pull to the upper chest, pause, then allow a complete dead-hang stretch at the top. The full ROM is everything. Without the stretch at the top, you are leaving the most productive part of the movement on the table.',
    systemic: false,
  },
  'Weighted Chin-Ups': {
    quote: '"Weighted chin-ups are among the most demanding and productive upper body exercises. A full dead hang at the bottom is non-negotiable — anything less is a waste of effort."',
    why: 'Bodyweight plus external load creates enormous tension through the entire lat from full stretch to full contraction. Add weight via a dipping belt the moment bodyweight becomes manageable for 10+ reps.',
    systemic: false,
  },
  'Deadlifts': {
    quote: '"The deadlift works more muscle than any other single exercise. It is so systemically demanding that one set taken to absolute failure is sufficient — and frequently all the body can recover from in 4 to 7 days."',
    why: 'Deadlifts activate virtually every muscle simultaneously. The systemic hormonal surge that follows a maximum set creates an anabolic environment that benefits ALL muscle groups — including those not directly trained.',
    systemic: true,
    experiment: true,
  },
};

const SYSTEMIC_TEXT = 'In a study cited by Mentzer, subjects who trained only one arm for 12 weeks gained 13% strength in the trained arm — but also 8% in the completely untrained opposite arm. No direct training. Pure systemic response.\n\nGrowth hormone spiked 300–500% above baseline after heavy squat and deadlift sets, versus just 50–100% after isolation work. One set of squats to failure does more for your biceps than a set of curls.';

const COLORADO_TEXT = 'In 1973 at Colorado State University, Casey Viator trained under Arthur Jones for 28 days using high-intensity compound movements with maximum rest between sessions.\n\n· 63.21 lbs of muscle gained\n· 17.93 lbs of fat lost\n· Training no more than 3x per week\n\nThe programme was built on squats, deadlifts and dips — not isolation, not high volume. This experiment became the single most cited piece of evidence for HIT and directly shaped everything Mentzer built Heavy Duty on.';

// ─── Isolation exercises ──────────────────────────────────────────────────────
const ISOLATION_LIST = [
  { name: 'Leg Curls',              tier: 'A', muscle: 'LEGS',          desc: 'Pre-exhaust hamstrings before Deadlifts. Zero rest between.' },
  { name: 'Leg Extensions',         tier: 'B', muscle: 'LEGS',          desc: 'Pre-exhaust quads before Squats or Leg Press.' },
  { name: 'Pec Deck',               tier: 'A', muscle: 'CHEST',         desc: 'Pre-exhaust pecs so they — not triceps — fail first in Dips.' },
  { name: 'Dumbbell Flyes',         tier: 'B', muscle: 'CHEST',         desc: 'Alternative chest pre-exhaust. Full stretch is the entire point.' },
  { name: 'Dumbbell Pullover',      tier: 'A', muscle: 'BACK',          desc: 'Pre-exhaust lats before Pulldowns. Move immediately — no rest.' },
  { name: 'Dumbbell Lateral Raises',tier: 'B', muscle: 'SHOULDERS',     desc: 'Shoulders already hit by Dips. Only add if lagging.' },
  { name: 'Barbell Curls',          tier: 'B', muscle: 'ARMS',          desc: 'Supplementary. Biceps are already worked heavily in all pulls.' },
  { name: 'Triceps Pressdowns',     tier: 'B', muscle: 'ARMS',          desc: 'Supplementary. Triceps are already worked heavily in Dips.' },
  { name: 'Standing Calf Raises',   tier: 'B', muscle: 'CALVES',        desc: 'Full stretch at bottom, full contraction at top. Higher reps.' },
  { name: 'Shrugs',                 tier: 'B', muscle: 'TRAPS',         desc: 'Traps are hammered by Deadlifts. Only add if noticeably lagging.' },
];

const TIER_COLOR = {
  A: { bg: '#0d1400', border: '#1a3300', text: '#6abf3a' },
  B: { bg: '#111',    border: '#222',    text: COLORS.textMuted },
};

const DEFAULT_COMPOUNDS = {
  legs:      'Squats',
  push:      'Weighted Dips',
  pull:      'Close-Grip Pulldowns',
  posterior: 'Deadlifts',
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ExerciseSelectionScreen({ onComplete }) {
  const [step, setStep]           = useState(0);
  const [compounds, setCompounds] = useState({ ...DEFAULT_COMPOUNDS });
  const [isolation, setIsolation] = useState(new Set());
  const [expanded, setExpanded]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => { loadProfile(); }, []);

  // Reset expanded state when step changes
  useEffect(() => { setExpanded(false); }, [step]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('routine')
        .eq('id', user.id)
        .single();

      if (profile?.routine?.length > 0) {
        const saved = new Set(profile.routine);
        const restored = { ...DEFAULT_COMPOUNDS };
        COMPOUND_GROUPS.forEach(g => {
          const match = g.options.find(o => saved.has(o.name));
          if (match) restored[g.id] = match.name;
        });
        const isoNames = new Set(ISOLATION_LIST.map(e => e.name));
        setCompounds(restored);
        setIsolation(new Set(profile.routine.filter(n => isoNames.has(n))));
      }
    } catch (_) {
      // defaults
    } finally {
      setLoading(false);
    }
  };

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const selectCompound = (groupId, name) => {
    setCompounds(p => ({ ...p, [groupId]: name }));
    setExpanded(false);
  };

  const toggleIsolation = (name) => setIsolation(p => {
    const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n;
  });

  const saveRoutine = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const routine = [...Object.values(compounds), ...Array.from(isolation)];
      await supabase.from('profiles').update({ routine }).eq('id', user.id);
      onComplete();
    } catch (_) {
      Alert.alert('Error', 'Could not save your routine. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator color={COLORS.gold} size="large" /></View>;
  }

  const currentGroup   = COMPOUND_GROUPS[step];
  const isCompoundStep = step < 4;
  const isIsolation    = step === 4;
  const isSummary      = step === 5;

  return (
    <View style={styles.container}>

      {/* Progress dots */}
      <View style={styles.progressBar}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── COMPOUND STEPS (0–3) ────────────────────────── */}
        {isCompoundStep && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepLabel}>
              STEP {step + 1} OF 4 — {currentGroup.label}
            </Text>
            <Text style={styles.tagline}>{currentGroup.tagline}</Text>
            <Text style={styles.note}>{currentGroup.note}</Text>

            {/* Options */}
            <View style={[
              styles.optionsRow,
              currentGroup.options.length === 1 && styles.optionsRowSingle,
            ]}>
              {currentGroup.options.map(opt => {
                const sel = compounds[currentGroup.id] === opt.name;
                const only = currentGroup.options.length === 1;
                return (
                  <TouchableOpacity
                    key={opt.name}
                    style={[styles.optionCard, sel && styles.optionCardSelected, only && styles.optionCardLocked]}
                    onPress={() => !only && selectCompound(currentGroup.id, opt.name)}
                    activeOpacity={only ? 1 : 0.7}
                  >
                    <View style={styles.optionTopRow}>
                      <Text style={[styles.optionName, sel && styles.optionNameSelected]}>
                        {opt.name}
                      </Text>
                      {only
                        ? <Text style={styles.starIcon}>★</Text>
                        : sel && <View style={styles.selectedDot} />
                      }
                    </View>
                    <Text style={styles.optionSub}>{opt.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Info card */}
            {(() => {
              const info = COMPOUND_INFO[compounds[currentGroup.id]];
              if (!info) return null;
              return (
                <View style={styles.infoCard}>
                  <Text style={styles.infoQuote}>{info.quote}</Text>
                  <Text style={styles.infoAttrib}>— Mike Mentzer</Text>

                  <TouchableOpacity
                    style={styles.readMoreBtn}
                    onPress={() => setExpanded(e => !e)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.readMoreText}>
                      {expanded ? 'SHOW LESS ↑' : 'READ MORE ↓'}
                    </Text>
                  </TouchableOpacity>

                  {expanded && (
                    <>
                      <View style={styles.infoDivider} />
                      <Text style={styles.infoWhy}>{info.why}</Text>

                      {info.systemic && (
                        <View style={styles.calloutCard}>
                          <View style={styles.calloutBadge}>
                            <Text style={styles.calloutBadgeText}>SYSTEMIC EFFECT</Text>
                          </View>
                          <Text style={styles.calloutText}>{SYSTEMIC_TEXT}</Text>
                        </View>
                      )}
                      {info.experiment && (
                        <View style={[styles.calloutCard, styles.calloutCardPurple]}>
                          <View style={[styles.calloutBadge, styles.calloutBadgePurple]}>
                            <Text style={[styles.calloutBadgeText, styles.calloutBadgeTextPurple]}>
                              THE COLORADO EXPERIMENT
                            </Text>
                          </View>
                          <Text style={[styles.calloutText, styles.calloutTextPurple]}>
                            {COLORADO_TEXT}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {/* ── ISOLATION STEP (4) ──────────────────────────── */}
        {isIsolation && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepLabel}>OPTIONAL — ISOLATION</Text>
            <Text style={styles.tagline}>Keep it pure, or add finishing work.</Text>
            <Text style={styles.note}>
              Mentzer cautioned against excess volume. The Core 4 is the complete programme. These are only worth adding if a specific muscle is lagging.
            </Text>

            {ISOLATION_LIST.map(ex => {
              const sel = isolation.has(ex.name);
              const tc = TIER_COLOR[ex.tier];
              return (
                <TouchableOpacity
                  key={ex.name}
                  style={[styles.isoRow, sel && styles.isoRowSelected]}
                  onPress={() => toggleIsolation(ex.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.isoLeft}>
                    <View style={styles.isoTopRow}>
                      <View style={[styles.tierBadge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
                        <Text style={[styles.tierText, { color: tc.text }]}>{ex.tier} TIER</Text>
                      </View>
                      <Text style={styles.isoMuscle}>{ex.muscle}</Text>
                    </View>
                    <Text style={[styles.isoName, sel && styles.isoNameSelected]}>{ex.name}</Text>
                    <Text style={styles.isoDesc}>{ex.desc}</Text>
                  </View>
                  <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                    {sel && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── SUMMARY STEP (5) ────────────────────────────── */}
        {isSummary && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepLabel}>YOUR ROUTINE</Text>
            <Text style={styles.tagline}>Four lifts. Maximum intensity. Everything else is noise.</Text>

            {/* Core 4 */}
            <View style={styles.summarySection}>
              <Text style={styles.summarySectionLabel}>THE CORE 4</Text>
              {COMPOUND_GROUPS.map(g => (
                <View key={g.id} style={styles.summaryRow}>
                  <View style={styles.summaryLeft}>
                    <Text style={styles.summaryGroupLabel}>{g.label}</Text>
                    <Text style={styles.summaryExercise}>{compounds[g.id]}</Text>
                  </View>
                  <View style={styles.sTierBadge}>
                    <Text style={styles.sTierText}>S TIER</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Isolation */}
            {isolation.size > 0 && (
              <View style={[styles.summarySection, { marginTop: 16 }]}>
                <Text style={styles.summarySectionLabel}>ISOLATION</Text>
                {Array.from(isolation).map(name => {
                  const ex = ISOLATION_LIST.find(e => e.name === name);
                  const tc = TIER_COLOR[ex?.tier || 'B'];
                  return (
                    <View key={name} style={styles.summaryRow}>
                      <Text style={styles.summaryExercise}>{name}</Text>
                      <View style={[styles.tierBadge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
                        <Text style={[styles.tierText, { color: tc.text }]}>{ex?.tier} TIER</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{Object.keys(compounds).length + isolation.size}</Text>
                <Text style={styles.statLabel}>TOTAL{'\n'}EXERCISES</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statNum}>1</Text>
                <Text style={styles.statLabel}>SET PER{'\n'}EXERCISE</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statNum}>4–7</Text>
                <Text style={styles.statLabel}>DAYS REST{'\n'}BETWEEN</Text>
              </View>
            </View>

            <Text style={styles.quote}>
              "The purpose of training is to stimulate growth — everything else is wasted effort."
            </Text>
            <Text style={styles.quoteAuthor}>— Mike Mentzer</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {isSummary ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={saveRoutine} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? 'SAVING...' : 'START TRAINING →'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>
              {isIsolation
                ? isolation.size > 0 ? `ADD ${isolation.size} + CONTINUE →` : 'SKIP — KEEP IT PURE →'
                : 'CONTINUE →'}
            </Text>
          </TouchableOpacity>
        )}
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={back}>
            <Text style={styles.backBtnText}>← BACK</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loader:    { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },

  progressBar: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, paddingTop: 60, paddingBottom: 16,
  },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a2a2a' },
  dotActive: { backgroundColor: COLORS.gold },

  content:       { paddingHorizontal: SPACING.screen, paddingBottom: 40 },
  stepContainer: { flex: 1 },

  stepLabel: { color: COLORS.gold, fontSize: 10, fontWeight: FONT.black, letterSpacing: 3, marginBottom: 12 },
  tagline:   { fontSize: 28, fontWeight: FONT.black, color: COLORS.white, marginBottom: 10, lineHeight: 34 },
  note:      { fontSize: 14, color: COLORS.textMuted, lineHeight: 22, marginBottom: 24 },

  // Options
  optionsRow:       { flexDirection: 'row', gap: 10, marginBottom: 20 },
  optionsRowSingle: { flexDirection: 'column' },
  optionCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  optionCardSelected: { borderColor: COLORS.gold, backgroundColor: '#0f0e00' },
  optionCardLocked:   { borderColor: COLORS.gold, backgroundColor: '#0f0e00' },
  optionTopRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  optionName:         { color: COLORS.white, fontSize: 14, fontWeight: FONT.bold, flex: 1 },
  optionNameSelected: { color: COLORS.gold },
  selectedDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold, marginTop: 4, flexShrink: 0 },
  starIcon:           { color: COLORS.gold, fontSize: 13 },
  optionSub:          { color: COLORS.textFaint, fontSize: 11 },

  // Info card
  infoCard: {
    backgroundColor: '#0c0b00', borderRadius: RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1,
    borderColor: COLORS.goldBorder, borderLeftWidth: 3, borderLeftColor: COLORS.gold,
  },
  infoQuote:   { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', lineHeight: 21 },
  infoAttrib:  { color: COLORS.gold, fontSize: 11, marginTop: 8, letterSpacing: 1 },
  readMoreBtn: { marginTop: 12, alignSelf: 'flex-start' },
  readMoreText:{ color: COLORS.gold, fontSize: 10, fontWeight: FONT.bold, letterSpacing: 2 },
  infoDivider: { height: 1, backgroundColor: COLORS.goldBorder, marginVertical: 14 },
  infoWhy:     { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 12 },

  // Callout cards (systemic / colorado)
  calloutCard: {
    marginTop: 10, backgroundColor: '#060d0d',
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: '#0a2a2a',
  },
  calloutCardPurple: { backgroundColor: '#0a0814', borderColor: '#1a1040' },
  calloutBadge: {
    alignSelf: 'flex-start', backgroundColor: '#0a2020',
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#1a4040', marginBottom: 10,
  },
  calloutBadgePurple:     { backgroundColor: '#130a20', borderColor: '#2a1850' },
  calloutBadgeText:       { color: '#4acfcf', fontSize: 8, fontWeight: FONT.black, letterSpacing: 2 },
  calloutBadgeTextPurple: { color: '#8a6acf' },
  calloutText:            { color: '#4a8a8a', fontSize: 12, lineHeight: 18 },
  calloutTextPurple:      { color: '#6a5a8a' },

  // Isolation
  isoRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  isoRowSelected: { borderColor: COLORS.gold, backgroundColor: '#0f0e00' },
  isoLeft:        { flex: 1, marginRight: 12 },
  isoTopRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tierBadge:      { alignSelf: 'flex-start', borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 },
  tierText:       { fontSize: 8, fontWeight: FONT.black, letterSpacing: 1.5 },
  isoMuscle:      { color: COLORS.textFaint, fontSize: 9, letterSpacing: 1.5 },
  isoName:        { color: COLORS.white, fontSize: 14, fontWeight: FONT.bold, marginBottom: 3 },
  isoNameSelected:{ color: COLORS.gold },
  isoDesc:        { color: COLORS.textFaint, fontSize: 12, lineHeight: 17 },

  checkbox:   { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  checkmark:  { color: '#000', fontSize: 13, fontWeight: FONT.black },

  // Summary
  summarySection:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  summarySectionLabel: { color: COLORS.textDim, fontSize: 9, fontWeight: FONT.black, letterSpacing: 3, marginBottom: 14 },
  summaryRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLeft:         { flex: 1 },
  summaryGroupLabel:   { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  summaryExercise:     { color: COLORS.white, fontSize: 15, fontWeight: FONT.bold },
  sTierBadge:          { backgroundColor: '#1a1400', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.goldBorder },
  sTierText:           { color: COLORS.gold, fontSize: 8, fontWeight: FONT.black, letterSpacing: 2 },

  statsRow:    { flexDirection: 'row', marginTop: 16, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg },
  statBox:     { flex: 1, alignItems: 'center' },
  statNum:     { color: COLORS.gold, fontSize: 28, fontWeight: FONT.black },
  statLabel:   { color: COLORS.textDim, fontSize: 8, letterSpacing: 1.5, textAlign: 'center', marginTop: 4, lineHeight: 13 },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },

  quote:       { color: COLORS.textDim, fontSize: 13, fontStyle: 'italic', lineHeight: 20, marginTop: 24, textAlign: 'center' },
  quoteAuthor: { color: COLORS.gold, fontSize: 11, textAlign: 'center', marginTop: 6, letterSpacing: 1 },

  footer:         { padding: SPACING.xl, paddingBottom: 40, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  primaryBtn:     { backgroundColor: COLORS.gold, paddingVertical: 18, borderRadius: RADIUS.md, alignItems: 'center' },
  primaryBtnText: { color: '#000', fontSize: 14, fontWeight: FONT.black, letterSpacing: 2 },
  backBtn:        { alignItems: 'center', marginTop: 16 },
  backBtnText:    { color: COLORS.textDim, fontSize: 12, letterSpacing: 1 },
});
