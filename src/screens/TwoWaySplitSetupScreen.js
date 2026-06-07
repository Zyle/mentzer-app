import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Animated,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

// ─── Workout definitions ──────────────────────────────────────────────────────

const UPPER_EXERCISES = [
  {
    key: 'chest_prehaust',
    label: 'CHEST PRE-EXHAUST',
    note: 'Superset immediately into your push exercise — zero rest between',
    optional: true,
    optionalLabel: 'Skip — go straight to push exercise',
    default: 'Pec Deck',
    options: [
      {
        name: 'Pec Deck',
        recommended: true,
        desc: 'Isolates the pecs before Dips so the chest — not the triceps — fails first. The pre-exhaust principle at its most effective.',
      },
      {
        name: 'Dumbbell Flyes',
        recommended: false,
        desc: 'Alternative if no pec deck available. Full stretch at the bottom is the whole point — control the negative completely.',
      },
    ],
  },
  {
    key: 'push',
    label: 'PUSH',
    note: 'Primary chest, shoulder and tricep movement',
    optional: false,
    default: 'Dips',
    options: [
      {
        name: 'Dips',
        recommended: true,
        desc: '"Dips are the upper body squat. They work the chest, shoulders and triceps through a full natural range of motion more effectively than any pressing movement." — Mentzer. Lean forward to shift emphasis to the pecs.',
      },
      {
        name: 'Incline Press',
        recommended: true,
        desc: 'Mentzer prescribed this as the best pressing alternative to Dips. 30-45 degree incline removes impingement risk while maintaining strong pec involvement. Controlled negative, full stretch at the bottom.',
      },
      {
        name: 'Bench Press',
        recommended: false,
        desc: 'Narrow grip — hands slightly closer than shoulder width. This stretches the pecs through a greater range of motion than a wide grip, contrary to popular belief.',
      },
      {
        name: 'Dumbbell Press',
        recommended: false,
        desc: 'Greater range of motion than barbell pressing and easier on the shoulders. Good option for those with joint issues. Can be done flat or incline. Control the negative fully.',
      },
      {
        name: 'Machine Chest Press',
        recommended: false,
        desc: 'Best option for those with shoulder or wrist injuries. Fixed path reduces injury risk. Apply the same principle — one set to absolute failure, controlled negative.',
      },
      {
        name: 'Push-Ups (Weighted)',
        recommended: false,
        desc: 'Add a weight plate on the back or use a weighted vest. Full range of motion, chest to floor. Best option if no equipment is available. Excellent stretch at the bottom.',
      },
    ],
  },
  {
    key: 'pull',
    label: 'PULL',
    note: 'Primary lat and bicep movement',
    optional: false,
    default: 'Close Grip Underhand Pulldown',
    options: [
      {
        name: 'Close Grip Underhand Pulldown',
        recommended: true,
        desc: '"The supinated grip pulldown is the finest lat exercise available. The palms-facing-you grip allows full bicep assistance and the lats to achieve maximum stretch at the top." — Mentzer. Dead hang at the top is non-negotiable.',
      },
      {
        name: 'Weighted Chin-Ups',
        recommended: true,
        desc: 'Mentzer\'s preferred alternative when pulldown machines are unavailable. Full dead hang at the bottom, add weight via dipping belt immediately once bodyweight becomes easy.',
      },
      {
        name: 'Barbell Row',
        recommended: false,
        desc: 'Heavy horizontal pull that loads the entire back. Keep torso fixed and control the negative. Good option for those with shoulder issues preventing overhead pulling.',
      },
      {
        name: 'Dumbbell Row',
        recommended: false,
        desc: 'Unilateral pulling with excellent range of motion. Full stretch and contraction achievable. Good for those with lower back sensitivity who can brace on a bench.',
      },
      {
        name: 'Cable Row',
        recommended: false,
        desc: 'Constant tension through full range of motion. Good for feeling the lat contraction throughout. Easier on the lower back than barbell rows.',
      },
    ],
  },
  {
    key: 'lateral',
    label: 'LATERAL DELTS',
    note: 'Fixed — no alternative',
    optional: false,
    fixed: true,
    default: 'Lateral Raise',
    options: [
      {
        name: 'Lateral Raise',
        recommended: true,
        desc: 'Dumbbell lateral raises. Elbows slightly bent, raise to shoulder height, control the negative. 6-10 reps to failure.',
      },
    ],
  },
];

const LOWER_EXERCISES = [
  {
    key: 'quad_preexhaust',
    label: 'QUAD PRE-EXHAUST',
    note: 'Superset immediately into leg press — zero rest between',
    optional: false,
    fixed: true,
    default: 'Leg Extension',
    options: [
      {
        name: 'Leg Extension',
        recommended: true,
        desc: 'Pre-exhausts the quads so they — not the lower back or hips — fail first in the leg press. The pre-exhaust principle applied to legs.',
      },
    ],
  },
  {
    key: 'legs',
    label: 'LEGS',
    note: 'Primary quad and glute movement',
    optional: false,
    default: 'Leg Press',
    options: [
      {
        name: 'Leg Press',
        recommended: true,
        desc: 'Mentzer\'s preferred leg movement. Full range of motion is non-negotiable — knees to chest at the bottom. One set to absolute failure. 8-15 reps.',
      },
      {
        name: 'Barbell Squat',
        recommended: true,
        desc: '"The squat is the most productive exercise in the bodybuilder\'s arsenal. It produces an unparalleled systemic stimulus." — Mentzer. Back straight, head up, full depth.',
      },
      {
        name: 'Smith Machine Squat',
        recommended: false,
        desc: 'Fixed bar path reduces injury risk. Good option for beginners learning the movement or those with balance issues. Full depth, controlled negative.',
      },
      {
        name: 'Hack Squat',
        recommended: false,
        desc: 'Deep knee flexion with spinal unloading. Excellent quad stimulus with less lower back involvement than barbell squats. Good for those with back sensitivity.',
      },
      {
        name: 'Goblet Squat',
        recommended: false,
        desc: 'Dumbbell or kettlebell held at chest. Enforces good mechanics and upright torso. Best option if no barbell or machine is available. Can be loaded progressively.',
      },
    ],
  },
  {
    key: 'posterior',
    label: 'POSTERIOR CHAIN',
    note: 'Hamstrings, glutes and entire back — the most systemically demanding movement',
    optional: false,
    default: 'Deadlift',
    options: [
      {
        name: 'Deadlift',
        recommended: true,
        desc: '"The deadlift works more muscle than any other single exercise. One set to absolute failure is sufficient — and frequently all the body can recover from." — Mentzer. Bar at shin level, back straight, head up. 5-8 reps.',
      },
      {
        name: 'Romanian Deadlift',
        recommended: false,
        desc: 'Mentzer\'s preferred alternative for those with lower back issues. Hip hinge with a deep hamstring stretch under load. Less spinal compression than conventional deadlifts.',
      },
      {
        name: 'Trap Bar Deadlift',
        recommended: false,
        desc: 'Neutral grip and centred load dramatically reduce shear force on the lower back. Near-identical muscle activation to conventional deadlifts. Best option for those with disc or back sensitivity.',
      },
      {
        name: 'Rack Pull',
        recommended: false,
        desc: 'Deadlift starting from knee height. Eliminates the most stressful portion for the lower back while still loading the posterior chain heavily. Good for those working around injury.',
      },
      {
        name: 'Good Mornings',
        recommended: false,
        desc: 'Barbell on the back with a forward hip hinge. Strong hamstring and lower back stimulus. Requires solid technique — if form breaks down stop immediately.',
      },
    ],
  },
  {
    key: 'calves',
    label: 'CALVES',
    note: 'Fixed — finish every lower session with this',
    optional: false,
    fixed: true,
    default: 'Standing Calf Raise',
    options: [
      {
        name: 'Standing Calf Raise',
        recommended: true,
        desc: 'Full stretch at the bottom, full contraction at the top. 12-20 reps to failure. The higher rep range is needed to fully fatigue calf muscle fibres.',
      },
    ],
  },
];

const STEPS = ['intro', 'upper', 'lower', 'summary'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TwoWaySplitSetupScreen({ onComplete, onBack }) {
  const [step, setStep]       = useState(0);
  const [upperChoices, setUpperChoices] = useState(() => {
    const defaults = {};
    UPPER_EXERCISES.forEach(ex => { defaults[ex.key] = null; });
    return defaults;
  });
  const [lowerChoices, setLowerChoices] = useState(() => {
    const defaults = {};
    LOWER_EXERCISES.forEach(ex => { defaults[ex.key] = null; });
    return defaults;
  });
  const [openInfo, setOpenInfo]   = useState(null);
  const [showMore, setShowMore]   = useState({});
  const [saving, setSaving]       = useState(false);
  const shimmerAnim = useRef(new Animated.Value(-200)).current;
  const scrollRef = useRef(null);

  const next = () => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    setStep(s => Math.min(s + 1, STEPS.length - 1));
    setOpenInfo(null);
  };
  const back = () => {
    if (step === 0) { onBack?.(); return; }
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    setStep(s => Math.max(s - 1, 0));
    setOpenInfo(null);
  };

  const pick = (key, name) => {
    if (isUpper) setUpperChoices(p => ({ ...p, [key]: name }));
    else setLowerChoices(p => ({ ...p, [key]: name }));
  };
  const toggleInfo = (id) => setOpenInfo(p => p === id ? null : id);

  const saveRoutine = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Fixed exercises always use their default value
      const upperList = UPPER_EXERCISES
        .map(ex => ex.fixed ? ex.default : upperChoices[ex.key])
        .filter(v => v && v !== 'skip');
      const lowerList = LOWER_EXERCISES
        .map(ex => ex.fixed ? ex.default : lowerChoices[ex.key])
        .filter(Boolean);

      if (user) {
        await supabase.from('profiles').update({
          routine:      [...upperList, ...lowerList],
          routine_type: 'two_way_split',
        }).eq('id', user.id);
      }
      onComplete();
    } catch (_) {
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const isIntro   = step === 0;
  const isUpper   = step === 1;
  const isLower   = step === 2;
  const isSummary = step === 3;

  const exercises = isUpper ? UPPER_EXERCISES : isLower ? LOWER_EXERCISES : [];
  const choices   = isUpper ? upperChoices : lowerChoices;

  // Can only continue if all required (non-optional, non-fixed) exercises have a choice
  const requiredUpper = UPPER_EXERCISES.filter(ex => !ex.fixed);
  const requiredLower = LOWER_EXERCISES.filter(ex => !ex.fixed);
  const upperSelected = requiredUpper.filter(ex => upperChoices[ex.key]).length;
  const lowerSelected = requiredLower.filter(ex => lowerChoices[ex.key]).length;
  const upperComplete = upperSelected === requiredUpper.length;
  const lowerComplete = lowerSelected === requiredLower.length;
  const canContinue   = isIntro || (isUpper && upperComplete) || (isLower && lowerComplete) || isSummary;
  const selectedCount = isUpper ? upperSelected : lowerSelected;
  const totalCount    = isUpper ? requiredUpper.length : requiredLower.length;

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      shimmerAnim.setValue(-200);
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 400, duration: 700, useNativeDriver: true }),
        Animated.delay(1800),
      ]).start(({ finished }) => { if (finished && !cancelled) run(); });
    };
    if (canContinue && (isUpper || isLower)) run();
    else shimmerAnim.setValue(-200);
    return () => { cancelled = true; };
  }, [canContinue, isUpper, isLower]);

  return (
    <View style={s.container}>

      {/* Top nav */}
      <View style={s.topNav}>
        <TouchableOpacity style={s.topBackBtn} onPress={back}>
          <Text style={s.topBackText}>← BACK</Text>
        </TouchableOpacity>
        <View style={s.progressBar}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.dot, i <= step && s.dotActive]} />
          ))}
        </View>
        <View style={s.topBackBtn} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── INTRO ── */}
        {isIntro && (
          <View>
            <Text style={s.sectionLabel}>HD TWO-WAY{'\n'}SPLIT.</Text>
            <Text style={s.sectionSubtitle}>Upper body. Lower body. Maximum intensity.</Text>
            <Text style={s.introBody}>
              Two alternating workouts. One set per exercise to absolute failure. 4-5 days rest between each session.
            </Text>

            {[
              {
                label: 'WORKOUT A',
                sub: 'UPPER BODY',
                desc: 'Chest, back and shoulders. Pre-exhaust supersets paired with compound movements — arms get hit hard through pressing and pulling without any redundant isolation work.',
                num: 'A',
                color: COLORS.gold,
                exercises: 'Pec Deck → Dips · Pulldowns · Laterals',
              },
              {
                label: 'WORKOUT B',
                sub: 'LOWER BODY',
                desc: 'Quads, hamstrings, glutes and calves. The most systemically demanding session — one set of deadlifts to failure affects your entire body.',
                num: 'B',
                color: '#60A5FA',
                exercises: 'Leg Extension → Leg Press · Deadlift · Calf Raise',
              },
            ].map(item => (
              <View key={item.label} style={[s.introCard, { borderColor: item.color + '33' }]}>
                <View style={s.introCardTop}>
                  <View style={[s.workoutBadge, { backgroundColor: item.color + '22', borderColor: item.color + '44' }]}>
                    <Text style={[s.workoutBadgeText, { color: item.color }]}>{item.label}</Text>
                  </View>
                  <Text style={[s.introCardSub, { color: item.color }]}>{item.sub}</Text>
                </View>
                <Text style={s.introCardDesc}>{item.desc}</Text>
                <Text style={s.introCardExercises}>{item.exercises}</Text>
              </View>
            ))}

            <View style={s.ruleCard}>
              <Text style={s.ruleTitle}>THE RULES</Text>
              {[
                'Every working set taken to absolute muscular failure',
                'Supersets performed back to back — zero rest between paired exercises',
                'Rest 3-5 minutes between all other exercises',
                'Never train if still sore from last session',
                'If not stronger than last session — add more rest days',
                'Keep a log. Strength progression is the only metric that matters',
              ].map((rule, i) => (
                <View key={i} style={s.ruleRow}>
                  <View style={s.ruleDot} />
                  <Text style={s.ruleText}>{rule}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── UPPER / LOWER EXERCISE SELECTION ── */}
        {(isUpper || isLower) && (
          <View>
            <Text style={s.sectionLabel}>
              {isUpper ? 'WORKOUT A\nUPPER BODY' : 'WORKOUT B\nLOWER BODY'}
            </Text>
            <Text style={s.sectionSubtitle}>
              {isUpper
                ? 'Some are fixed by Mentzer — pick your preferred option for the rest'
                : 'Pick your preferred leg and posterior chain movements'}
            </Text>

            {exercises.map(ex => {
              const selected = choices[ex.key];
              const isOpen   = openInfo === ex.key;
              const isSingle = ex.fixed || ex.options.length === 1;

              return (
                <View key={ex.key} style={s.exGroup}>
                  {/* Group header */}
                  <View style={s.groupHeader}>
                    <Text style={s.groupLabel}>{ex.label}</Text>
                    <View style={s.groupHeaderRight}>
                      {ex.optional && (
                        <View style={s.optionalBadge}>
                          <Text style={s.optionalText}>OPTIONAL</Text>
                        </View>
                      )}
                      {ex.fixed ? (
                        <View style={s.fixedBadge}>
                          <Text style={s.fixedText}>FIXED</Text>
                        </View>
                      ) : (
                        <View style={s.chooseOneBadge}>
                          <Text style={s.chooseOneText}>CHOOSE 1</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={s.groupNote}>{ex.note}</Text>

                  {/* Skip option for optional exercises */}
                  {ex.optional && (
                    <TouchableOpacity
                      style={[s.optionRow, selected === 'skip' && s.optionRowSelected]}
                      onPress={() => pick(ex.key, 'skip')}
                      activeOpacity={0.7}
                    >
                      <View style={s.optionLeft}>
                        <Text style={[s.optionName, selected === 'skip' && { color: COLORS.textMuted }]}>
                          Skip pre-exhaust
                        </Text>
                        <Text style={s.optionDesc}>Go straight to the push movement</Text>
                      </View>
                      <View style={[s.radio, selected === 'skip' && s.radioOn]} />
                    </TouchableOpacity>
                  )}

                  {/* Exercise options */}
                  {ex.options
                    .slice(0, showMore[ex.key] ? ex.options.length : 2)
                    .map(opt => {
                    const isSelected = selected === opt.name;
                    const infoKey    = ex.key + '_' + opt.name;
                    const infoOpen   = openInfo === infoKey;

                    return (
                      <View key={opt.name} style={[s.optionCard, isSelected && s.optionCardSelected, isSingle && s.optionCardFixed]}>
                        <TouchableOpacity
                          onPress={() => !isSingle && pick(ex.key, opt.name)}
                          activeOpacity={isSingle ? 1 : 0.7}
                        >
                          <View style={s.optionTop}>
                            <View style={s.optionTopLeft}>
                              {opt.recommended && (
                                <View style={s.recommendedBadge}>
                                  <Text style={s.recommendedText}>MENTZER'S PICK</Text>
                                </View>
                              )}
                            </View>
                            {!isSingle && (
                              <View style={[s.radio, isSelected && s.radioOn]} />
                            )}
                            {isSingle && (
                              <View style={s.fixedCheck}>
                                <Text style={s.fixedCheckText}>✓</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[s.optionName, isSelected && { color: COLORS.gold }, isSingle && { color: COLORS.white }]}>
                            {opt.name}
                          </Text>
                        </TouchableOpacity>

                        {/* Info toggle */}
                        <TouchableOpacity
                          style={s.infoToggle}
                          onPress={() => toggleInfo(infoKey)}
                        >
                          <Text style={s.infoToggleText}>
                            {infoOpen ? 'CLOSE ▲' : 'LEARN MORE ▼'}
                          </Text>
                        </TouchableOpacity>

                        {infoOpen && (
                          <View style={s.infoPanel}>
                            <View style={s.infoDivider} />
                            <Text style={s.infoText}>{opt.desc}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {/* Show more / less */}
                  {!ex.fixed && ex.options.length > 2 && (
                    <TouchableOpacity
                      style={s.showMoreBtn}
                      onPress={() => setShowMore(p => ({ ...p, [ex.key]: !p[ex.key] }))}
                      activeOpacity={0.7}
                    >
                      <Text style={s.showMoreText}>
                        {showMore[ex.key]
                          ? 'SHOW LESS ▲'
                          : 'MORE OPTIONS ▼'}
                      </Text>
                    </TouchableOpacity>
                  )}

                </View>
              );
            })}
          </View>
        )}

        {/* ── SUMMARY ── */}
        {isSummary && (
          <View>
            <Text style={s.sectionLabel}>YOUR{'\n'}SPLIT.</Text>
            <Text style={s.sectionSubtitle}>Two workouts. Everything Mentzer prescribed.</Text>

            {[
              { label: 'WORKOUT A — UPPER BODY', exercises: UPPER_EXERCISES, choices: upperChoices, color: COLORS.gold },
              { label: 'WORKOUT B — LOWER BODY', exercises: LOWER_EXERCISES, choices: lowerChoices, color: '#60A5FA' },
            ].map(workout => (
              <View key={workout.label} style={[s.summarySection, { borderColor: workout.color + '33' }]}>
                <Text style={[s.summarySectionLabel, { color: workout.color }]}>{workout.label}</Text>
                {workout.exercises.map(ex => {
                  const chosen = workout.choices[ex.key];
                  if (!chosen) return null;
                  return (
                    <View key={ex.key} style={s.summaryRow}>
                      <Text style={s.summaryGroupLabel}>{ex.label}</Text>
                      <Text style={s.summaryExercise}>{chosen}</Text>
                    </View>
                  );
                })}
              </View>
            ))}

            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statNum}>2</Text>
                <Text style={s.statLabel}>ALTERNATING{'\n'}WORKOUTS</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={s.statNum}>1</Text>
                <Text style={s.statLabel}>SET PER{'\n'}EXERCISE</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={s.statNum}>4–5</Text>
                <Text style={s.statLabel}>DAYS REST{'\n'}BETWEEN</Text>
              </View>
            </View>

            <Text style={s.finalQuote}>
              "The resting phases between training units are just as important as the training itself — 50/50."
            </Text>
            <Text style={s.finalAttrib}>— Mike Mentzer</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        {isSummary ? (
          <TouchableOpacity style={s.primaryBtn} onPress={saveRoutine} disabled={saving}>
            <Text style={s.primaryBtnText}>{saving ? 'SAVING...' : 'START TRAINING →'}</Text>
          </TouchableOpacity>
        ) : (isUpper || isLower) ? (
          <TouchableOpacity
            style={[s.primaryBtn, !canContinue && s.primaryBtnDisabled]}
            onPress={canContinue ? next : null}
            activeOpacity={canContinue ? 0.8 : 1}
          >
            {canContinue && (
              <Animated.View
                pointerEvents="none"
                style={[s.shimmerBar, { transform: [{ translateX: shimmerAnim }] }]}
              />
            )}
            <Text style={[s.primaryBtnText, !canContinue && s.primaryBtnTextDisabled]}>
              {canContinue ? 'CONTINUE →' : `${selectedCount} OF ${totalCount} EXERCISES SELECTED`}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.primaryBtn} onPress={next}>
            <Text style={s.primaryBtnText}>BUILD MY SPLIT →</Text>
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  topNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 16, paddingHorizontal: SPACING.screen },
  topBackBtn: { width: 80 },
  topBackText:{ color: '#d4c9a8', fontSize: 11, fontWeight: FONT.black, letterSpacing: 1.5 },
  progressBar:{ flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a2a2a' },
  dotActive:  { backgroundColor: COLORS.gold },
  content:    { paddingHorizontal: SPACING.screen, paddingBottom: 40 },

  sectionLabel:    { fontSize: 44, fontWeight: FONT.black, color: COLORS.white, letterSpacing: -1, lineHeight: 50, marginBottom: 6 },
  sectionSubtitle: { fontSize: 12, color: COLORS.gold, fontWeight: FONT.bold, letterSpacing: 2, marginBottom: 24, textTransform: 'uppercase' },

  introBody: { fontSize: 15, color: COLORS.white, lineHeight: 24, marginBottom: 24, fontWeight: FONT.medium },

  introCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: 12,
    borderWidth: 1,
  },
  introCardTop:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  workoutBadge:      { borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  workoutBadgeText:  { fontSize: 10, fontWeight: FONT.black, letterSpacing: 2 },
  introCardSub:      { fontSize: 11, fontWeight: FONT.black, letterSpacing: 2 },
  introCardDesc:     { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginBottom: 10 },
  introCardExercises:{ fontSize: 11, color: COLORS.textFaint, fontWeight: FONT.bold, letterSpacing: 1 },

  ruleCard:  { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: 4, borderWidth: 1, borderColor: COLORS.border },
  ruleTitle: { color: COLORS.textDim, fontSize: 9, fontWeight: FONT.black, letterSpacing: 3, marginBottom: 14 },
  ruleRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  ruleDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.gold, marginTop: 7, flexShrink: 0 },
  ruleText:  { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, flex: 1 },

  exGroup:     { marginBottom: 22 },
  groupHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupLabel:       { color: COLORS.white, fontSize: 11, fontWeight: FONT.black, letterSpacing: 3 },
  groupNote:        { color: COLORS.textDim, fontSize: 11, letterSpacing: 1, marginBottom: 10 },

  chooseOneBadge: { },
  chooseOneText:  { color: '#888', fontSize: 9, fontWeight: FONT.semibold, letterSpacing: 1 },
  optionalBadge:  { backgroundColor: '#0a0d1a', borderRadius: RADIUS.sm, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#60A5FA44' },
  optionalText:   { color: '#60A5FA', fontSize: 8, fontWeight: FONT.black, letterSpacing: 1.5 },
  fixedBadge:     { backgroundColor: '#111', borderRadius: RADIUS.sm, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#2a2a2a' },
  fixedText:      { color: '#555', fontSize: 8, fontWeight: FONT.black, letterSpacing: 1.5 },

  optionRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  optionRowSelected: { borderColor: COLORS.gold, backgroundColor: '#0f0e00' },

  optionCard:        { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 8, borderWidth: 1.5, borderColor: COLORS.border },
  optionCardSelected:{ borderColor: COLORS.gold, backgroundColor: '#0f0e00' },
  optionCardFixed:   { borderColor: '#2a2a2a', opacity: 0.9 },

  optionTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  optionTopLeft: { flex: 1 },

  recommendedBadge: { alignSelf: 'flex-start', backgroundColor: '#1a1200', borderRadius: RADIUS.sm, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.goldBorder },
  recommendedText:  { color: COLORS.gold, fontSize: 8, fontWeight: FONT.black, letterSpacing: 1 },

  radio:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#444' },
  radioOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },

  fixedCheck:     { width: 18, height: 18, borderRadius: 9, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  fixedCheckText: { color: '#555', fontSize: 10, fontWeight: FONT.black },

  optionLeft: { flex: 1, marginRight: 12 },
  optionName: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.white, marginBottom: 2 },
  optionDesc: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },

  showMoreBtn:    { alignSelf: 'center', marginTop: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#161616' },
  showMoreText:   { color: '#aaa', fontSize: 10, fontWeight: FONT.black, letterSpacing: 2 },

  infoToggle:     { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1e1e1e', alignSelf: 'flex-end' },
  infoToggleText: { color: '#d4c9a8', fontSize: 9, fontWeight: FONT.black, letterSpacing: 2 },
  infoPanel:      { marginTop: 4 },
  infoDivider:    { height: 1, backgroundColor: COLORS.goldBorder, marginVertical: 10 },
  infoText:       { color: COLORS.textMuted, fontSize: 13, lineHeight: 20 },

  summarySection:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, marginBottom: 14 },
  summarySectionLabel: { fontSize: 9, fontWeight: FONT.black, letterSpacing: 3, marginBottom: 14 },
  summaryRow:          { marginBottom: 12 },
  summaryGroupLabel:   { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, marginBottom: 3 },
  summaryExercise:     { color: COLORS.white, fontSize: 15, fontWeight: FONT.bold },

  statsRow:    { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: 24 },
  statBox:     { flex: 1, alignItems: 'center' },
  statNum:     { color: COLORS.gold, fontSize: 28, fontWeight: FONT.black },
  statLabel:   { color: COLORS.textDim, fontSize: 8, letterSpacing: 1.5, textAlign: 'center', marginTop: 4, lineHeight: 13 },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },

  finalQuote:  { color: COLORS.textDim, fontSize: 13, fontStyle: 'italic', lineHeight: 20, textAlign: 'center' },
  finalAttrib: { color: COLORS.gold, fontSize: 11, textAlign: 'center', marginTop: 6, letterSpacing: 1 },

  footer:           { padding: SPACING.xl, paddingBottom: 40, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  shimmerBar: { position: 'absolute', top: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,255,255,0.15)', transform: [{ rotate: '15deg' }] },
  primaryBtn:    { backgroundColor: COLORS.gold, paddingVertical: 18, borderRadius: RADIUS.md, alignItems: 'center', overflow: 'hidden' },
  primaryBtnText:{ color: '#000', fontSize: 14, fontWeight: FONT.black, letterSpacing: 2 },
});
