import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

// ─── Tier styles ──────────────────────────────────────────────────────────────
const TIER_STYLE = {
  'S*': { bg: '#1a1200', border: '#c9a84c', text: '#c9a84c' },   // Bright Gold
  'S':  { bg: '#131000', border: '#a87838', text: '#a87838' },   // Amber
  'A':  { bg: '#0e0b00', border: '#7a5828', text: '#7a5828' },   // Dark Amber
  'B':  { bg: '#0a0800', border: '#4a3418', text: '#4a3418' },   // Very Dark Gold
  'C':  { bg: '#080700', border: '#2a1e0e', text: '#2a1e0e' },   // Ember
};

// ─── Exercise data ────────────────────────────────────────────────────────────
const COMPOUND_GROUPS = [
  {
    id: 'legs',
    label: 'LEGS',
    subtitle: 'Pick 1 leg compound exercise',
    exercises: [
      {
        name: 'Barbell Squat', tier: 'S*', mentzersPick: true,
        quote: '"The squat is the most productive exercise in the bodybuilder\'s arsenal. It produces an unparalleled systemic stimulus that goes far beyond mere leg development — one set to absolute failure and your entire body grows."',
        desc: 'Mentzer prescribed this as the foundation of any serious programme. Heavy squats trigger a whole-body hormonal response that makes every other muscle grow faster.',
        systemic: true,
      },
      {
        name: 'Leg Press', tier: 'S', mentzersPick: true,
        quote: '"Leg Press can be substituted for Squats. The same systemic principles apply — one set, maximum intensity, absolute failure."',
        desc: 'Mentzer specifically prescribed this as his go-to alternative. Provides near-identical systemic stimulus in a mechanically safer position. Full range of motion is non-negotiable.',
        systemic: true,
      },
      {
        name: 'Hack Squat', tier: 'A', mentzersPick: false,
        quote: null,
        desc: 'Deep knee flexion with spinal unloading. Excellent quad stimulus with less lower back involvement than barbell squats. Apply the same principle — one set to absolute failure.',
      },
      {
        name: 'Romanian Deadlift', tier: 'A', mentzersPick: false,
        quote: null,
        desc: 'Hip hinge with a full hamstring stretch under load. The deep stretch at the bottom is where growth stimulus is maximised — lower slowly and feel every inch.',
      },
      {
        name: 'Bulgarian Split Squat', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Unilateral movement with good range of motion. Load is limited compared to bilateral options which reduces the systemic hormonal response Mentzer prioritised.',
      },
      {
        name: 'Front Squat', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Shifts emphasis to quads with a more upright torso. Good depth achievable but loading potential is lower than the back squat — less systemic stimulus.',
      },
      {
        name: 'Goblet Squat', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Accessible variation that enforces good mechanics. Limited loading potential makes it a corrective tool more than a primary mass builder.',
      },
      {
        name: 'Smith Machine Squat', tier: 'C', mentzersPick: false,
        quote: null,
        desc: 'Fixed bar path reduces stabiliser activation. Acceptable if free weights are unavailable but inferior to any free-weight squat variation.',
      },
      {
        name: 'Lunges', tier: 'C', mentzersPick: false,
        quote: null,
        desc: 'Unilateral with significant balance demand. Very limited loading potential — a poor choice as a primary mass builder under Heavy Duty principles.',
      },
    ],
  },
  {
    id: 'push',
    label: 'PUSH',
    subtitle: 'Pick 1 push compound exercise',
    exercises: [
      {
        name: 'Weighted Dips', tier: 'S*', mentzersPick: true,
        quote: '"Dips are the upper body equivalent of the squat. They work the chest, shoulders and triceps through a full, natural range of motion more effectively than any pressing movement. I rate them above the bench press in every respect."',
        desc: 'The forward lean shifts emphasis to the pectorals. The deep stretch at the bottom recruits far more muscle fibre than any bench press variation. Add weight via a dipping belt immediately.',
      },
      {
        name: 'Incline Press', tier: 'S', mentzersPick: true,
        quote: '"If Dips cause shoulder discomfort, the incline press at 30–45 degrees is the most effective pressing alternative. The incline removes impingement risk while maintaining strong pec involvement."',
        desc: 'Mentzer prescribed this specifically for those with shoulder issues preventing dips. Strong upper pec and anterior delt involvement. Control the negative — 4 seconds down.',
      },
      {
        name: 'Flat Bench Press', tier: 'A', mentzersPick: false,
        quote: null,
        desc: 'Classic horizontal press with high loading potential. Range of motion is limited compared to dips — the chest never achieves a full stretch. Solid mass builder nonetheless.',
      },
      {
        name: 'Overhead Press', tier: 'A', mentzersPick: false,
        quote: null,
        desc: 'Vertical push pattern that directly loads the deltoids with strong tricep involvement. Full overhead lockout is non-negotiable for complete range of motion.',
      },
      {
        name: 'Dumbbell Press', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Greater range of motion than barbell pressing. More stabilisation required which limits max loading — the increased ROM partially compensates.',
      },
      {
        name: 'Weighted Push Ups', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Full bodyweight press with added load via a plate on the back. Excellent range of motion but practical loading limits cap the systemic stimulus.',
      },
      {
        name: 'Machine Chest Press', tier: 'C', mentzersPick: false,
        quote: null,
        desc: 'Fixed path reduces stabiliser activation. Use only when free weights are unavailable. Apply the same principle — one set to absolute failure.',
      },
      {
        name: 'Smith Machine Press', tier: 'C', mentzersPick: false,
        quote: null,
        desc: 'Same limitations as machine pressing. Inferior to any free-weight pressing movement. Last resort only.',
      },
    ],
  },
  {
    id: 'pull',
    label: 'PULL',
    subtitle: 'Pick 1 pull compound exercise',
    exercises: [
      {
        name: 'Close-Grip Pulldowns', tier: 'S*', mentzersPick: true,
        quote: '"The supinated grip pulldown is the finest lat exercise available. The palms-facing-you grip allows full bicep assistance and the lats to achieve maximum stretch at the top — the stretch that drives growth."',
        desc: 'Pull to the upper chest, pause, then allow a complete dead-hang stretch at the top. Without the full stretch at the top you are leaving the most productive part of the movement on the table.',
      },
      {
        name: 'Weighted Chin-Ups', tier: 'S*', mentzersPick: true,
        quote: '"Weighted chin-ups are among the most demanding and productive upper body exercises. A full dead hang at the bottom is non-negotiable — anything less is a waste of effort."',
        desc: 'Mentzer recommended this when pulldown machines are unavailable. Bodyweight plus external load creates enormous tension through the entire lat. Add weight via a dipping belt immediately.',
      },
      {
        name: 'Wide-Grip Pull-Ups', tier: 'A', mentzersPick: false,
        quote: null,
        desc: 'Overhand wide grip. Good lat width stimulus but the pronated grip limits the stretch achievable at the top — less growth stimulus than supinated alternatives.',
      },
      {
        name: 'Barbell Row', tier: 'A', mentzersPick: false,
        quote: null,
        desc: 'Heavy horizontal pull that loads the entire back. Keep the torso angle fixed and control the negative. High loading potential makes this a serious mass builder.',
      },
      {
        name: 'Dumbbell Row', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Unilateral pulling with good range of motion. Full stretch and contraction achievable. Load is limited compared to bilateral barbell rowing.',
      },
      {
        name: 'Cable Row', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Constant tension through full range of motion. Good for feeling the lat contraction. Load ceiling lower than free weight alternatives.',
      },
      {
        name: 'Lat Pulldown', tier: 'C', mentzersPick: false,
        quote: null,
        desc: 'Standard overhand pulldown. Inferior grip position limits lat stretch compared to supinated alternatives. Use only if chin-ups or palms-up pulldowns are not possible.',
      },
      {
        name: 'Machine Row', tier: 'C', mentzersPick: false,
        quote: null,
        desc: 'Fixed path reduces proprioceptive demand. Acceptable for supplementary work but should not be a primary mass builder.',
      },
    ],
  },
  {
    id: 'posterior',
    label: 'POSTERIOR CHAIN',
    subtitle: 'Pick 1 posterior chain exercise',
    exercises: [
      {
        name: 'Deadlifts', tier: 'S*', mentzersPick: true,
        quote: '"The deadlift works more muscle than any other single exercise. It is so systemically demanding that one set taken to absolute failure is sufficient — and frequently all the body can recover from in 4 to 7 days."',
        desc: 'Deadlifts activate virtually every muscle simultaneously. The systemic hormonal surge that follows a maximum set creates an anabolic environment that benefits every muscle group — including those not directly trained.',
        systemic: true,
        experiment: true,
      },
      {
        name: 'Romanian Deadlift', tier: 'S', mentzersPick: true,
        quote: null,
        desc: 'Mentzer prescribed this as his primary alternative for those with lower back issues. The hip hinge pattern and deep hamstring stretch under load provide excellent posterior chain stimulus with reduced spinal compression.',
      },
      {
        name: 'Trap Bar Deadlift', tier: 'A', mentzersPick: false,
        quote: null,
        desc: 'The neutral grip and centred load reduce shear force on the lumbar spine significantly. Near-identical muscle activation to the conventional deadlift — a smart choice for those with back sensitivity.',
      },
      {
        name: 'Rack Pull', tier: 'A', mentzersPick: false,
        quote: null,
        desc: 'Partial range deadlift starting from knee height. Eliminates the most stressful portion of the lift for the lower back while still loading the posterior chain heavily. Allows greater loading than full deadlifts.',
      },
      {
        name: 'Cable Pull-Through', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Hip hinge with constant cable tension. Very low spinal loading — excellent for those with disc issues or who are new to hip hinge patterns. Loading potential is limited compared to free weight alternatives.',
      },
      {
        name: 'Good Mornings', tier: 'B', mentzersPick: false,
        quote: null,
        desc: 'Barbell on the back with a forward hip hinge. Strong hamstring and lower back stimulus. Requires solid technique — poor form significantly increases injury risk.',
      },
      {
        name: 'Hip Thrust', tier: 'C', mentzersPick: false,
        quote: null,
        desc: 'Glute-dominant movement with limited hamstring and back involvement. Far less systemic stimulus than any deadlift variation. Use only if all other posterior chain options are contraindicated.',
      },
    ],
  },
];

const SYSTEMIC_TEXT = 'In a study cited by Mentzer, subjects who trained only one arm for 12 weeks gained 13% strength in the trained arm — but also 8% in the completely untrained opposite arm. No direct training. Pure systemic response.\n\nGrowth hormone spiked 300–500% above baseline after heavy squat and deadlift sets, versus just 50–100% after isolation work. One set of squats to failure does more for your biceps than a set of curls.';

const COLORADO_TEXT = 'In 1973 at Colorado State University, Casey Viator trained under Arthur Jones for 28 days using high-intensity compound movements with maximum rest between sessions.\n\n· 63.21 lbs of muscle gained\n· 17.93 lbs of fat lost\n· Training no more than 3x per week\n\nThe programme was built on squats, deadlifts and dips — not isolation, not high volume. This became the single most cited evidence for HIT and directly shaped everything Mentzer built Heavy Duty on.';

// ─── Isolation exercises ──────────────────────────────────────────────────────
const ISOLATION_LIST = [
  { name: 'Leg Curls',               tier: 'A', muscle: 'LEGS',      desc: 'Pre-exhaust hamstrings before Deadlifts. Zero rest between.' },
  { name: 'Leg Extensions',          tier: 'B', muscle: 'LEGS',      desc: 'Pre-exhaust quads before Squats or Leg Press.' },
  { name: 'Pec Deck',                tier: 'A', muscle: 'CHEST',     desc: 'Pre-exhaust pecs so they — not triceps — fail first in Dips.' },
  { name: 'Dumbbell Flyes',          tier: 'B', muscle: 'CHEST',     desc: 'Alternative chest pre-exhaust. Full stretch is the entire point.' },
  { name: 'Dumbbell Pullover',       tier: 'A', muscle: 'BACK',      desc: 'Pre-exhaust lats before Pulldowns. Move immediately — no rest.' },
  { name: 'Dumbbell Lateral Raises', tier: 'B', muscle: 'SHOULDERS', desc: 'Shoulders already hit by Dips. Only add if lagging.' },
  { name: 'Barbell Curls',           tier: 'B', muscle: 'ARMS',      desc: 'Supplementary. Biceps already worked heavily in all pulls.' },
  { name: 'Triceps Pressdowns',      tier: 'B', muscle: 'ARMS',      desc: 'Supplementary. Triceps already worked heavily in Dips.' },
  { name: 'Standing Calf Raises',    tier: 'B', muscle: 'CALVES',    desc: 'Full stretch at bottom, full contraction at top. Higher reps.' },
  { name: 'Shrugs',                  tier: 'B', muscle: 'TRAPS',     desc: 'Traps are hammered by Deadlifts. Only add if noticeably lagging.' },
];

const ISO_TIER_STYLE = {
  A: { bg: '#0e0b00', border: '#7a5828', text: '#7a5828' },   // Dark Amber
  B: { bg: '#0a0800', border: '#4a3418', text: '#4a3418' },   // Very Dark Gold
};

const STEPS = ['intro', 'legs', 'push', 'pull', 'posterior', 'isolation', 'summary'];

const DEFAULT_COMPOUNDS = {
  legs:      null,
  push:      null,
  pull:      null,
  posterior: null,
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ExerciseSelectionScreen({ onComplete }) {
  const [step, setStep]           = useState(0);
  const [compounds, setCompounds] = useState({ ...DEFAULT_COMPOUNDS });
  const [isolation, setIsolation] = useState(new Set());
  const [infoOpen, setInfoOpen]   = useState(null); // which card has dropdown open
  const [fullOpen, setFullOpen]   = useState(null); // which card is fully expanded
  const [saving, setSaving]       = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => { setInfoOpen(null); setFullOpen(null); setShowScrollHint(true); }, [step]);

  const handleScroll = ({ nativeEvent }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 32;
    setShowScrollHint(!atBottom);
  };

  const next = () => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    setStep(s => Math.max(s - 1, 0));
  };

  const selectExercise = (groupId, name) => {
    setCompounds(p => ({ ...p, [groupId]: name }));
  };

  const toggleInfo = (name) => {
    setInfoOpen(p => p === name ? null : name);
    setFullOpen(null);
  };

  const toggleIsolation = (name) => setIsolation(p => {
    const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n;
  });

  const saveRoutine = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const routine = [...Object.values(compounds).filter(Boolean), ...Array.from(isolation)];
      if (user) {
        await supabase.from('profiles').update({ routine }).eq('id', user.id);
      }
      onComplete();
    } catch (_) {
      // In dev mode there's no real user — just proceed
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const isIntro        = step === 0;
  const currentGroup   = COMPOUND_GROUPS[step - 1];
  const isCompoundStep = step >= 1 && step <= 4;
  const isIsolation    = step === 5;
  const isSummary      = step === 6;

  return (
    <View style={styles.container}>

      {/* Top nav */}
      <View style={styles.topNav}>
        {step > 0 ? (
          <TouchableOpacity style={styles.topBackBtn} onPress={back}>
            <Text style={styles.topBackText}>← BACK</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.topBackBtn} />
        )}

        {/* Progress dots */}
        <View style={styles.progressBar}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.topBackBtn} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >

        {/* ── INTRO STEP (0) ───────────────────────────────── */}
        {isIntro && (
          <View>
            <Text style={styles.sectionLabel}>BUILD YOUR{'\n'}ROUTINE.</Text>
            <Text style={styles.sectionSubtitle}>Heavy Duty II — Four movements. Maximum intensity.</Text>
            <Text style={styles.introBody}>
              Four exercises. One set each. Taken to absolute failure. This is everything your body needs to grow.
            </Text>

            {[
              { label: 'LEGS',             sub: 'Pick 1 compound',    desc: 'The foundation. Squats and heavy leg work trigger a whole-body hormonal response no other lift can match.',           num: '01' },
              { label: 'PUSH',             sub: 'Pick 1 compound',    desc: 'Chest, shoulders and triceps through a full range of motion. Dips are the upper body equivalent of the squat.',      num: '02' },
              { label: 'PULL',             sub: 'Pick 1 compound',    desc: 'Lats, biceps and upper back. The supinated pulldown achieves the full stretch that drives lat growth.',               num: '03' },
              { label: 'POSTERIOR CHAIN',  sub: 'Pick 1 compound',    desc: 'Deadlifts and heavy hip hinge work. The single most systemically demanding movement pattern — nothing else comes close.',  num: '04' },
            ].map(item => (
              <View key={item.label} style={styles.introCard}>
                <View style={styles.introCardTop}>
                  <Text style={styles.introCardNum}>{item.num}</Text>
                  <View style={styles.introCardMeta}>
                    <Text style={styles.introCardLabel}>{item.label}</Text>
                    <Text style={styles.introCardSub}>{item.sub}</Text>
                  </View>
                </View>
                <Text style={styles.introCardDesc}>{item.desc}</Text>
              </View>
            ))}

            <View style={styles.introCardAddOn}>
              <View style={styles.introCardTop}>
                <Text style={[styles.introCardNum, styles.introCardNumAddOn]}>05</Text>
                <View style={styles.introCardMeta}>
                  <Text style={[styles.introCardLabel, styles.introCardLabelAddOn]}>ISOLATION</Text>
                  <Text style={[styles.introCardSub, { color: '#4a7a9a' }]}>Optional add-on</Text>
                </View>
              </View>
              <Text style={styles.introCardDesc}>
                If a specific muscle is lagging — add one isolation exercise for it. That's it.
              </Text>
            </View>
          </View>
        )}

        {/* ── COMPOUND STEPS (1–4) ──────────────────────────── */}
        {isCompoundStep && (
          <View>
            {/* Big section label */}
            <Text style={styles.sectionLabel}>{currentGroup.label}</Text>
            <Text style={styles.sectionSubtitle}>{currentGroup.subtitle}</Text>

            {/* Exercise list */}
            {currentGroup.exercises.map(ex => {
              const selected    = compounds[currentGroup.id] === ex.name;
              const isInfoOpen  = infoOpen === ex.name || ex.locked;
              const isFullOpen  = fullOpen === ex.name;
              const ts          = TIER_STYLE[ex.tier];
              const hasMore     = !!(ex.quote || ex.systemic || ex.experiment);

              return (
                <View key={ex.name} style={[styles.exCard, selected && styles.exCardSelected]}>

                  {/* ── Selectable area (badges + name) ── */}
                  <TouchableOpacity
                    onPress={() => !ex.locked && selectExercise(currentGroup.id, ex.name)}
                    activeOpacity={ex.locked ? 1 : 0.7}
                  >
                    <View style={styles.exTopRow}>
                      <View style={styles.exBadges}>
                        <View style={[styles.tierBadge, { backgroundColor: ts.bg, borderColor: ts.border }]}>
                          <Text style={[styles.tierText, { color: ts.text }]}>{ex.tier}</Text>
                        </View>
                        {ex.mentzersPick && (
                          <View style={styles.pickBadge}>
                            <Text style={styles.pickText}>
                              {ex.tier === 'S*' ? '🏆 MENTZER\'S PICK' : '⚡ MENTZER\'S ALT'}
                            </Text>
                          </View>
                        )}
                      </View>
                      {selected && !ex.locked && (
                        <View style={styles.checkCircle}>
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                      {ex.locked && <Text style={styles.lockIcon}>★</Text>}
                    </View>

                    <Text style={[styles.exName, selected && styles.exNameSelected]}>
                      {ex.name}
                    </Text>
                  </TouchableOpacity>

                  {/* ── Info dropdown toggle ── */}
                  {!ex.locked && (
                    <TouchableOpacity style={styles.infoToggle} onPress={() => toggleInfo(ex.name)}>
                      <Text style={styles.infoToggleText}>
                        {isInfoOpen ? 'CLOSE ▲' : 'LEARN MORE ▼'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* ── Info panel ── */}
                  {isInfoOpen && (
                    <View style={styles.exInfo}>
                      <View style={styles.exDivider} />
                      <Text style={styles.exDesc}>{ex.desc}</Text>

                      {/* Read more / full content */}
                      {hasMore && !isFullOpen && (
                        <TouchableOpacity
                          style={styles.readMoreBtn}
                          onPress={() => setFullOpen(ex.name)}
                        >
                          <Text style={styles.readMoreText}>READ MORE →</Text>
                        </TouchableOpacity>
                      )}

                      {isFullOpen && (
                        <View>
                          {ex.quote && (
                            <>
                              <View style={styles.exDivider} />
                              <Text style={styles.exQuote}>{ex.quote}</Text>
                              <Text style={styles.exAttrib}>— Mike Mentzer</Text>
                            </>
                          )}
                          {ex.systemic && (
                            <View style={styles.calloutCard}>
                              <View style={styles.calloutBadge}>
                                <Text style={styles.calloutBadgeText}>SYSTEMIC EFFECT</Text>
                              </View>
                              <Text style={styles.calloutText}>{SYSTEMIC_TEXT}</Text>
                            </View>
                          )}
                          {ex.experiment && (
                            <View style={[styles.calloutCard, styles.calloutPurple]}>
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
                          <TouchableOpacity
                            style={styles.readMoreBtn}
                            onPress={() => setFullOpen(null)}
                          >
                            <Text style={styles.readMoreText}>SHOW LESS ▲</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── ISOLATION STEP (5) ────────────────────────────── */}
        {isIsolation && (
          <View>
            <Text style={styles.sectionLabel}>ISOLATION</Text>
            <Text style={styles.sectionSubtitle}>Optional finishing work</Text>

            {/* Keep it pure card */}
            <TouchableOpacity
              style={[styles.pureCard, isolation.size === 0 && styles.pureCardSelected]}
              onPress={() => setIsolation(new Set())}
              activeOpacity={0.7}
            >
              <View style={styles.pureCardTop}>
                <View style={styles.pickBadge}>
                  <Text style={styles.pickText}>🏆 MENTZER'S RECOMMENDATION</Text>
                </View>
                {isolation.size === 0 && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.pureCardTitle}>Keep It Pure</Text>
              <Text style={styles.pureCardDesc}>
                Skip all isolation work. The Core 4 already stimulates every major muscle group. Mentzer believed additional isolation adds fatigue without meaningful growth stimulus.
              </Text>
            </TouchableOpacity>

            <Text style={styles.isoNote}>
              Or select specific muscles you feel are lagging:
            </Text>

            {ISOLATION_LIST.map(ex => {
              const sel = isolation.has(ex.name);
              const ts  = ISO_TIER_STYLE[ex.tier];
              return (
                <TouchableOpacity
                  key={ex.name}
                  style={[styles.isoRow, sel && styles.isoRowSelected]}
                  onPress={() => toggleIsolation(ex.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.isoLeft}>
                    <View style={styles.isoTopRow}>
                      <View style={[styles.tierBadge, { backgroundColor: ts.bg, borderColor: ts.border }]}>
                        <Text style={[styles.tierText, { color: ts.text }]}>{ex.tier} TIER</Text>
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

        {/* ── SUMMARY STEP (5) ──────────────────────────────── */}
        {isSummary && (
          <View>
            <Text style={styles.sectionLabel}>YOUR{'\n'}ROUTINE</Text>
            <Text style={styles.sectionSubtitle}>Four lifts. Maximum intensity. Everything else is noise.</Text>

            <View style={styles.summarySection}>
              <Text style={styles.summarySectionLabel}>THE CORE 4</Text>
              {COMPOUND_GROUPS.map(g => {
                const ex = g.exercises.find(e => e.name === compounds[g.id]);
                return (
                  <View key={g.id} style={styles.summaryRow}>
                    <View style={styles.summaryLeft}>
                      <Text style={styles.summaryGroupLabel}>{g.label}</Text>
                      <Text style={styles.summaryExercise}>{compounds[g.id]}</Text>
                    </View>
                    <View style={[styles.tierBadge, {
                      backgroundColor: TIER_STYLE[ex?.tier || 'S*'].bg,
                      borderColor: TIER_STYLE[ex?.tier || 'S*'].border,
                    }]}>
                      <Text style={[styles.tierText, { color: TIER_STYLE[ex?.tier || 'S*'].text }]}>
                        {ex?.tier || 'S*'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {isolation.size > 0 && (
              <View style={[styles.summarySection, { marginTop: 14 }]}>
                <Text style={styles.summarySectionLabel}>ISOLATION</Text>
                {Array.from(isolation).map(name => {
                  const ex = ISOLATION_LIST.find(e => e.name === name);
                  const ts = ISO_TIER_STYLE[ex?.tier || 'B'];
                  return (
                    <View key={name} style={styles.summaryRow}>
                      <Text style={styles.summaryExercise}>{name}</Text>
                      <View style={[styles.tierBadge, { backgroundColor: ts.bg, borderColor: ts.border }]}>
                        <Text style={[styles.tierText, { color: ts.text }]}>{ex?.tier} TIER</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

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

            <Text style={styles.finalQuote}>
              "The purpose of training is to stimulate growth — everything else is wasted effort."
            </Text>
            <Text style={styles.finalAttrib}>— Mike Mentzer</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Scroll hint */}
      {showScrollHint && !isIntro && !isSummary && (
        <View style={styles.scrollHint}>
          <TouchableOpacity
            style={styles.scrollHintPill}
            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            activeOpacity={0.7}
          >
            <Text style={styles.scrollHintArrow}>▼</Text>
            <Text style={styles.scrollHintLabel}>SCROLL</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {isSummary ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={saveRoutine} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? 'SAVING...' : 'START TRAINING →'}</Text>
          </TouchableOpacity>
        ) : (
          (() => {
            const canContinue = !isCompoundStep || !!compounds[STEPS[step]];
            return (
              <TouchableOpacity
                style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
                onPress={canContinue ? next : null}
                activeOpacity={canContinue ? 0.8 : 1}
              >
                <Text style={[styles.primaryBtnText, !canContinue && styles.primaryBtnTextDisabled]}>
                  {isIsolation
                    ? isolation.size > 0 ? `ADD ${isolation.size} + CONTINUE →` : 'SKIP — KEEP IT PURE →'
                    : canContinue ? 'CONTINUE →' : 'SELECT AN EXERCISE'}
                </Text>
              </TouchableOpacity>
            );
          })()
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  topNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 16, paddingHorizontal: SPACING.screen },
  topBackBtn:   { width: 80 },
  topBackText:  { color: '#d4c9a8', fontSize: 11, fontWeight: FONT.black, letterSpacing: 1.5 },
  progressBar:  { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a2a2a' },
  dotActive:    { backgroundColor: COLORS.gold },
  content:     { paddingHorizontal: SPACING.screen, paddingBottom: 40 },

  // Section header — BIG
  sectionLabel:    { fontSize: 52, fontWeight: FONT.black, color: COLORS.white, letterSpacing: -1, lineHeight: 56, marginBottom: 6 },
  sectionSubtitle: { fontSize: 12, color: COLORS.gold, fontWeight: FONT.bold, letterSpacing: 2, marginBottom: 24, textTransform: 'uppercase' },

  // Intro step
  introBody: { fontSize: 16, color: COLORS.white, lineHeight: 24, marginBottom: 28, fontWeight: FONT.medium },
  introCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  introCardTop:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  introCardNum:   { fontSize: 36, fontWeight: FONT.black, color: COLORS.gold, marginRight: 16, lineHeight: 40, opacity: 0.4 },
  introCardMeta:  { flex: 1 },
  introCardLabel: { fontSize: 20, fontWeight: FONT.black, color: COLORS.white, letterSpacing: 0.5 },
  introCardSub:   { fontSize: 10, color: COLORS.gold, fontWeight: FONT.bold, letterSpacing: 2, marginTop: 3 },
  introCardDesc:  { fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },
  introCardAddOn:      { backgroundColor: '#0a0d12', borderRadius: RADIUS.lg, padding: SPACING.sm, marginBottom: 12, borderWidth: 1, borderColor: '#1e2a38' },
  introCardNumAddOn:   { opacity: 0.25, fontSize: 28, color: '#6a9ab8' },
  introCardLabelAddOn: { fontSize: 15, color: '#6a9ab8' },

  // Exercise cards
  exCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  exCardSelected: { borderColor: COLORS.gold, backgroundColor: '#0f0e00' },
  exTopRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exBadges:       { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  exName:         { fontSize: 18, fontWeight: FONT.bold, color: COLORS.white, marginBottom: 2 },
  exNameSelected: { color: COLORS.gold },

  // Tier badge
  tierBadge: { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  tierText:  { fontSize: 9, fontWeight: FONT.black, letterSpacing: 1.5 },

  // Mentzer's Pick badge
  pickBadge: {
    backgroundColor: '#1a1200', borderRadius: RADIUS.sm,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.goldBorder,
  },
  pickText: { fontSize: 8, fontWeight: FONT.black, color: COLORS.gold, letterSpacing: 1 },

  // Selected checkmark
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#000', fontSize: 12, fontWeight: FONT.black },
  lockIcon:  { color: COLORS.gold, fontSize: 14 },

  // Info toggle
  infoToggle:     { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1e1e1e', alignSelf: 'flex-end' },
  infoToggleText: { color: '#d4c9a8', fontSize: 9, fontWeight: FONT.black, letterSpacing: 2 },

  // Read more
  readMoreBtn:  { marginTop: 12, alignSelf: 'flex-start' },
  readMoreText: { color: COLORS.gold, fontSize: 11, fontWeight: FONT.black, letterSpacing: 1.5 },

  // Exercise info (expanded)
  exInfo:    { marginTop: 4 },
  exDivider: { height: 1, backgroundColor: COLORS.goldBorder, marginVertical: 12 },
  exQuote:   { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', lineHeight: 21 },
  exAttrib:  { color: COLORS.gold, fontSize: 11, marginTop: 6, letterSpacing: 1 },
  exDesc:    { color: COLORS.textMuted, fontSize: 13, lineHeight: 20 },

  // Callout cards
  calloutCard: {
    marginTop: 12, backgroundColor: '#060d0d',
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: '#0a2a2a',
  },
  calloutPurple:          { backgroundColor: '#0a0814', borderColor: '#1a1040' },
  calloutBadge:           { alignSelf: 'flex-start', backgroundColor: '#0a2020', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#1a4040', marginBottom: 10 },
  calloutBadgePurple:     { backgroundColor: '#130a20', borderColor: '#2a1850' },
  calloutBadgeText:       { color: '#4acfcf', fontSize: 8, fontWeight: FONT.black, letterSpacing: 2 },
  calloutBadgeTextPurple: { color: '#8a6acf' },
  calloutText:            { color: '#4a8a8a', fontSize: 12, lineHeight: 18 },
  calloutTextPurple:      { color: '#6a5a8a' },

  // Keep it pure card
  pureCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  pureCardSelected:  { borderColor: COLORS.gold, backgroundColor: '#0f0e00' },
  pureCardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pureCardTitle:     { fontSize: 20, fontWeight: FONT.black, color: COLORS.white, marginBottom: 6 },
  pureCardDesc:      { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },

  // Isolation
  isoNote:        { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginBottom: 16, marginTop: 4 },
  isoRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  isoRowSelected: { borderColor: COLORS.gold, backgroundColor: '#0f0e00' },
  isoLeft:        { flex: 1, marginRight: 12 },
  isoTopRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  isoMuscle:      { color: COLORS.textFaint, fontSize: 9, letterSpacing: 1.5 },
  isoName:        { color: COLORS.white, fontSize: 14, fontWeight: FONT.bold, marginBottom: 3 },
  isoNameSelected:{ color: COLORS.gold },
  isoDesc:        { color: COLORS.textFaint, fontSize: 12, lineHeight: 17 },
  checkbox:       { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxOn:     { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  checkmark:      { color: '#000', fontSize: 13, fontWeight: FONT.black },

  // Summary
  summarySection:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  summarySectionLabel: { color: COLORS.textDim, fontSize: 9, fontWeight: FONT.black, letterSpacing: 3, marginBottom: 14 },
  summaryRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLeft:         { flex: 1 },
  summaryGroupLabel:   { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  summaryExercise:     { color: COLORS.white, fontSize: 15, fontWeight: FONT.bold },
  statsRow:            { flexDirection: 'row', marginTop: 16, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg },
  statBox:             { flex: 1, alignItems: 'center' },
  statNum:             { color: COLORS.gold, fontSize: 28, fontWeight: FONT.black },
  statLabel:           { color: COLORS.textDim, fontSize: 8, letterSpacing: 1.5, textAlign: 'center', marginTop: 4, lineHeight: 13 },
  statDivider:         { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },
  finalQuote:          { color: COLORS.textDim, fontSize: 13, fontStyle: 'italic', lineHeight: 20, marginTop: 24, textAlign: 'center' },
  finalAttrib:         { color: COLORS.gold, fontSize: 11, textAlign: 'center', marginTop: 6, letterSpacing: 1 },

  // Scroll hint
  scrollHint:      { position: 'absolute', bottom: 130, left: 0, right: 0, alignItems: 'center' },
  scrollHintPill:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1c1a14', borderWidth: 1, borderColor: '#3a3020', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  scrollHintArrow: { color: '#d4c9a8', fontSize: 11, fontWeight: FONT.black },
  scrollHintLabel: { color: '#d4c9a8', fontSize: 10, fontWeight: FONT.black, letterSpacing: 2 },

  // Footer
  footer:         { padding: SPACING.xl, paddingBottom: 40, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  primaryBtn:             { backgroundColor: COLORS.gold, paddingVertical: 18, borderRadius: RADIUS.md, alignItems: 'center' },
  primaryBtnDisabled:     { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a' },
  primaryBtnText:         { color: '#000', fontSize: 14, fontWeight: FONT.black, letterSpacing: 2 },
  primaryBtnTextDisabled: { color: '#444' },
});
