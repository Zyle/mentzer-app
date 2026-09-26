import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import CalorieSlider from '../components/CalorieSlider';
import Button from '../components/Button';
import { COLORS, FONT, TYPE, RADIUS, SPACING, HIT } from '../theme';

// ─── Weight loss prediction card ─────────────────────────────────────────────
function WeightLossPrediction({ deficit, imperial }) {
  const monthlyKg  = (deficit * 30) / 7700;
  const weeklyKg   = (deficit * 7)  / 7700;
  const monthlyLbs = monthlyKg * 2.20462;
  const weeklyLbs  = weeklyKg  * 2.20462;

  const weeklyStr  = imperial ? `~${weeklyLbs.toFixed(2)}lbs`  : `~${weeklyKg.toFixed(2)}kg`;
  const monthlyStr = imperial ? `~${monthlyLbs.toFixed(1)}lbs` : `~${monthlyKg.toFixed(1)}kg`;

  return (
    <View style={predStyles.container}>
      <View style={predStyles.row}>
        <View style={predStyles.stat}>
          <Text style={predStyles.value}>{weeklyStr}</Text>
          <Text style={predStyles.label}>PER WEEK</Text>
        </View>
        <View style={predStyles.divider} />
        <View style={predStyles.stat}>
          <Text style={predStyles.value}>{monthlyStr}</Text>
          <Text style={predStyles.label}>PER MONTH</Text>
        </View>
      </View>
      {deficit >= 400 && (
        <View style={predStyles.warning}>
          <Text style={predStyles.warningText}>
            Deficits above 400 kcal/day risk muscle loss. Keep training intensity high and protein intake up.
          </Text>
        </View>
      )}
    </View>
  );
}

const predStyles = StyleSheet.create({
  container: {
    marginTop: 12, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  row:     { flexDirection: 'row', alignItems: 'center' },
  stat:    { flex: 1, alignItems: 'center' },
  value:   { color: COLORS.white, fontSize: 26, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  label:   { color: COLORS.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: FONT.semibold, marginTop: 4 },
  divider: { width: 1, height: 40, backgroundColor: COLORS.border, marginHorizontal: 16 },
  warning: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  warningText: { color: COLORS.orange, fontSize: 13, lineHeight: 19 },
});

// ─── Unit conversion helpers ──────────────────────────────────────────────────
const kgToLbs   = kg  => (kg  * 2.20462).toFixed(1);
const lbsToKg   = lbs => (lbs / 2.20462).toFixed(1);
const cmToFtIn  = cm  => {
  const totalIn = cm / 2.54;
  return { ft: Math.floor(totalIn / 12).toString(), inches: Math.round(totalIn % 12).toString() };
};
const ftInToCm  = (ft, inches) =>
  Math.round((parseFloat(ft) || 0) * 30.48 + (parseFloat(inches) || 0) * 2.54).toString();

// ─── Constants ────────────────────────────────────────────────────────────────
const STEPS = ['welcome', 'personal', 'body', 'goal', 'calories', 'experience', 'summary'];

const BULK_ZONES = [
  { label: 'CONSERVATIVE', color: COLORS.green },
  { label: 'MODERATE',     color: COLORS.gold  },
  { label: 'AGGRESSIVE',   color: COLORS.red   },
];
const CUT_ZONES = [
  { label: 'MILD',        color: COLORS.green },
  { label: 'RECOMMENDED', color: COLORS.gold  },
  { label: 'AGGRESSIVE',  color: COLORS.red   },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onComplete }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  // Personal
  const [name, setName]   = useState('');
  const [age, setAge]     = useState('');
  const [sex, setSex]     = useState('');

  // Body — always stored metric internally
  const [imperial, setImperial]     = useState(false);
  const [heightCm, setHeightCm]     = useState('');
  const [heightFt, setHeightFt]     = useState('');
  const [heightIn, setHeightIn]     = useState('');
  const [weightKg, setWeightKg]     = useState('');
  const [weightLbs, setWeightLbs]   = useState('');

  // Goal / calories / experience
  const [goal, setGoal]                       = useState('');
  const [calorieAdjustment, setCalorieAdjustment] = useState(150);
  const [experience, setExperience]           = useState('');
  const [saving, setSaving]                   = useState(false);
  const [scrollEnabled, setScrollEnabled]     = useState(true);

  // ── Unit toggle ──────────────────────────────────────────────────────────
  const toggleUnits = () => {
    if (!imperial) {
      // metric → imperial: convert any existing values
      if (heightCm) {
        const { ft, inches } = cmToFtIn(parseFloat(heightCm));
        setHeightFt(ft);
        setHeightIn(inches);
      }
      if (weightKg) setWeightLbs(kgToLbs(parseFloat(weightKg)));
    } else {
      // imperial → metric: convert any existing values
      if (heightFt || heightIn) setHeightCm(ftInToCm(heightFt, heightIn));
      if (weightLbs) setWeightKg(lbsToKg(parseFloat(weightLbs)));
    }
    setImperial(u => !u);
  };

  // ── Derived metric values (used in all calculations) ─────────────────────
  const getHeightCm = () => {
    if (!imperial) return parseFloat(heightCm) || 0;
    return parseFloat(ftInToCm(heightFt, heightIn)) || 0;
  };

  const getWeightKg = () => {
    if (!imperial) return parseFloat(weightKg) || 0;
    return parseFloat(lbsToKg(parseFloat(weightLbs))) || 0;
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const next = () => {
    if (step === 0 && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (step === 1 && (!age || !sex)) {
      setError('Please enter your age and select your sex.');
      return;
    }
    if (step === 2) {
      const hOk = imperial ? (heightFt !== '') : (heightCm !== '');
      const wOk = imperial ? (weightLbs !== '') : (weightKg !== '');
      if (!hOk || !wOk) {
        setError('Please enter your height and weight.');
        return;
      }
    }
    if (step === 3 && !goal) {
      setError('Please select your goal.');
      return;
    }
    if (step === 5 && !experience) {
      setError('Please select your experience level.');
      return;
    }
    // skip calorie step for maintain
    setError('');
    if (step === 3 && goal === 'maintain') { setStep(5); return; }
    setStep(s => s + 1);
  };

  const back = () => {
    setError('');
    if (step === 5 && goal === 'maintain') { setStep(3); return; }
    setStep(s => s - 1);
  };

  // ── Goal selection ────────────────────────────────────────────────────────
  const selectGoal = (g) => {
    setGoal(g);
    if (g === 'bulk') setCalorieAdjustment(150);
    else if (g === 'cut') setCalorieAdjustment(300);
    else setCalorieAdjustment(0);
  };

  // ── Calculations ──────────────────────────────────────────────────────────
  const calculateTDEE = () => {
    const w = getWeightKg();
    const h = getHeightCm();
    const a = parseInt(age);
    if (!w || !h || !a || !sex) return null;
    const bmr = sex === 'male'
      ? (10 * w) + (6.25 * h) - (5 * a) + 5
      : (10 * w) + (6.25 * h) - (5 * a) - 161;
    return Math.round(bmr * 1.375);
  };

  const getSignedAdjustment = () => {
    if (goal === 'bulk') return calorieAdjustment;
    if (goal === 'cut')  return -calorieAdjustment;
    return 0;
  };

  const getCalorieTarget = () => {
    const tdee = calculateTDEE();
    if (!tdee) return null;
    return tdee + getSignedAdjustment();
  };

  const getGoalLabel = () => {
    if (goal === 'bulk') return 'Build muscle';
    if (goal === 'cut')  return 'Lose fat';
    return 'Recomp / maintain';
  };

  const getExperienceDescription = () => {
    if (experience === 'beginner')     return '1 set to failure per exercise · 4+ days rest';
    if (experience === 'intermediate') return 'Full Heavy Duty protocol · 4–6 days rest';
    return 'Squats, dips, deadlifts · up to 7 days rest';
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          name: name.trim(),
          age: parseInt(age),
          sex,
          height_cm:           getHeightCm(),
          bodyweight_kg:       getWeightKg(),
          goal,
          experience_level:    experience,
          calorie_adjustment:  getSignedAdjustment(),
          last_weight_checkin: new Date().toISOString(),
        });
      }
      onComplete();
    } catch (e) {
      // In dev mode there's no real user — just proceed
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const tdee          = calculateTDEE();
  const calorieTarget = getCalorieTarget();
  const proteinTarget = getWeightKg() ? Math.round(getWeightKg() * 0.8) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  const visibleSteps = goal === 'maintain' ? STEPS.filter(s => s !== 'calories') : STEPS;
  const stepIndex    = visibleSteps.indexOf(STEPS[step]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar — back + progress */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          {step > 0 ? (
            <Pressable
              onPress={back}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Previous step"
              hitSlop={8}
            >
              <Feather name="chevron-left" size={24} color={COLORS.textSecondary} />
            </Pressable>
          ) : <View style={styles.backBtn} />}
          <Text style={styles.stepCount} accessibilityLabel={`Step ${stepIndex + 1} of ${visibleSteps.length}`}>
            {stepIndex + 1} / {visibleSteps.length}
          </Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.progressTrack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.progressFill, { width: `${((stepIndex + 1) / visibleSteps.length) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >

        {/* STEP 0 — Welcome */}
        {step === 0 && (
          <View>
            <Text style={styles.logo}>MENTZER</Text>
            <Text style={styles.logoSub}>HEAVY DUTY</Text>
            <Text style={styles.title} accessibilityRole="header">Welcome.</Text>
            <Text style={styles.subtitle}>
              Mike Mentzer's Heavy Duty system: brief, intense, infrequent training. One set to failure, then rest while your body grows. This app is your coach.
            </Text>
            <Field label="What should we call you?">
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={t => { setName(t); setError(''); }}
                placeholder="Your first name"
                placeholderTextColor={COLORS.textFaint}
                autoFocus
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
                onSubmitEditing={next}
                accessibilityLabel="Your name"
              />
            </Field>
          </View>
        )}

        {/* STEP 1 — Personal */}
        {step === 1 && (
          <View>
            <Text style={styles.title} accessibilityRole="header">About you</Text>
            <Text style={styles.subtitle}>Used to calculate your calorie and recovery targets.</Text>

            <Field label="Age">
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={t => { setAge(t); setError(''); }}
                keyboardType="number-pad"
                placeholder="25"
                placeholderTextColor={COLORS.textFaint}
                accessibilityLabel="Age in years"
              />
            </Field>

            <Field label="Sex">
              <View style={styles.optionRow} accessibilityRole="radiogroup">
                {['male', 'female'].map(sx => (
                  <Pressable
                    key={sx}
                    style={[styles.optionButton, sex === sx && styles.optionButtonActive]}
                    onPress={() => { setSex(sx); setError(''); }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sex === sx }}
                    accessibilityLabel={sx}
                  >
                    <Text style={[styles.optionText, sex === sx && styles.optionTextActive]}>
                      {sx === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          </View>
        )}

        {/* STEP 2 — Body */}
        {step === 2 && (
          <View>
            <Text style={styles.title} accessibilityRole="header">Your body</Text>
            <Text style={styles.subtitle}>Re-checked every two weeks to keep your targets accurate.</Text>

            <View style={styles.unitToggle} accessibilityRole="radiogroup">
              {[
                { key: false, label: 'kg · cm' },
                { key: true,  label: 'lbs · ft' },
              ].map(u => {
                const active = imperial === u.key;
                return (
                  <Pressable
                    key={u.label}
                    style={[styles.unitOption, active && styles.unitOptionActive]}
                    onPress={() => !active && toggleUnits()}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={u.key ? 'Imperial units' : 'Metric units'}
                  >
                    <Text style={[styles.unitOptionText, active && styles.unitOptionTextActive]}>{u.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Field label="Height">
              {imperial ? (
                <View style={styles.optionRow}>
                  <UnitInput value={heightFt} onChangeText={t => { setHeightFt(t); setError(''); }} placeholder="5" unit="ft" keyboardType="number-pad" label="Height, feet" />
                  <UnitInput value={heightIn} onChangeText={setHeightIn} placeholder="11" unit="in" keyboardType="number-pad" label="Height, inches" />
                </View>
              ) : (
                <UnitInput value={heightCm} onChangeText={t => { setHeightCm(t); setError(''); }} placeholder="180" unit="cm" label="Height in centimetres" />
              )}
            </Field>

            <Field label="Weight">
              {imperial ? (
                <UnitInput value={weightLbs} onChangeText={t => { setWeightLbs(t); setError(''); }} placeholder="176" unit="lbs" label="Weight in pounds" />
              ) : (
                <UnitInput value={weightKg} onChangeText={t => { setWeightKg(t); setError(''); }} placeholder="80" unit="kg" label="Weight in kilograms" />
              )}
            </Field>
          </View>
        )}

        {/* STEP 3 — Goal */}
        {step === 3 && (
          <View>
            <Text style={styles.title} accessibilityRole="header">Your goal</Text>
            <Text style={styles.subtitle}>Sets your calorie target. You can change it any time.</Text>

            <View accessibilityRole="radiogroup">
              {[
                { key: 'bulk',     icon: 'trending-up',   label: 'Build muscle',       desc: "A small calorie surplus. You'll set the exact amount next." },
                { key: 'maintain', icon: 'minus',         label: 'Recomp / maintain',  desc: 'Eat at maintenance to lose fat and build muscle together. Ideal for beginners and returners.' },
                { key: 'cut',      icon: 'trending-down', label: 'Lose fat',           desc: "A controlled deficit that preserves muscle. You'll set the amount next." },
              ].map(g => (
                <ChoiceCard
                  key={g.key}
                  icon={g.icon}
                  label={g.label}
                  desc={g.desc}
                  selected={goal === g.key}
                  onPress={() => { selectGoal(g.key); setError(''); }}
                />
              ))}
            </View>
          </View>
        )}

        {/* STEP 4 — Calorie adjustment (bulk) */}
        {step === 4 && goal === 'bulk' && (
          <View>
            <Text style={styles.title} accessibilityRole="header">Set your surplus</Text>
            <Text style={styles.subtitle}>
              Extra calories per day above your maintenance of {tdee} kcal. Mentzer's point: muscle is built slowly, so the surplus you need is small.
            </Text>
            <View style={styles.sliderCard}>
              <CalorieSlider
                onDragStart={() => setScrollEnabled(false)}
                onDragEnd={() => setScrollEnabled(true)}
                value={calorieAdjustment}
                min={50}
                max={300}
                step={50}
                onChange={setCalorieAdjustment}
                color={COLORS.gold}
                zones={BULK_ZONES}
                accessibilityLabel="Daily calorie surplus"
              />
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>YOUR DAILY TARGET</Text>
              <Text style={styles.previewValue}>{calorieTarget}<Text style={styles.previewUnit}> kcal</Text></Text>
              <Text style={styles.previewSub}>{tdee} maintenance + {calorieAdjustment} surplus</Text>
            </View>
          </View>
        )}

        {/* STEP 4 — Calorie adjustment (cut) */}
        {step === 4 && goal === 'cut' && (
          <View>
            <Text style={styles.title} accessibilityRole="header">Set your deficit</Text>
            <Text style={styles.subtitle}>
              Calories per day below your maintenance of {tdee} kcal. Smaller deficits protect the muscle you've built.
            </Text>
            <View style={styles.sliderCard}>
              <CalorieSlider
                onDragStart={() => setScrollEnabled(false)}
                onDragEnd={() => setScrollEnabled(true)}
                value={calorieAdjustment}
                min={100}
                max={500}
                step={50}
                onChange={setCalorieAdjustment}
                color={COLORS.red}
                zones={CUT_ZONES}
                accessibilityLabel="Daily calorie deficit"
              />
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>YOUR DAILY TARGET</Text>
              <Text style={styles.previewValue}>{calorieTarget}<Text style={styles.previewUnit}> kcal</Text></Text>
              <Text style={styles.previewSub}>{tdee} maintenance − {calorieAdjustment} deficit</Text>
            </View>
            <WeightLossPrediction deficit={calorieAdjustment} imperial={imperial} />
          </View>
        )}

        {/* STEP 5 — Experience */}
        {step === 5 && (
          <View>
            <Text style={styles.title} accessibilityRole="header">Training experience</Text>
            <Text style={styles.subtitle}>Be honest. This shapes how often you train and how long you rest.</Text>

            <View accessibilityRole="radiogroup">
              {[
                { key: 'beginner',     icon: 'circle',   label: 'Beginner',     desc: 'Under 1 year of training. One set to failure, at least 4 days rest.' },
                { key: 'intermediate', icon: 'disc',     label: 'Intermediate', desc: '1–3 years of serious training. Full Heavy Duty protocol, 4–6 days rest.' },
                { key: 'advanced',     icon: 'target',   label: 'Advanced',     desc: '3+ years. Consolidated routine built on squats, dips and deadlifts. Up to 7 days rest.' },
              ].map(e => (
                <ChoiceCard
                  key={e.key}
                  icon={e.icon}
                  label={e.label}
                  desc={e.desc}
                  selected={experience === e.key}
                  onPress={() => { setExperience(e.key); setError(''); }}
                />
              ))}
            </View>
          </View>
        )}

        {/* STEP 6 — Summary */}
        {step === 6 && (
          <View>
            <Text style={styles.title} accessibilityRole="header">Your plan, {name.trim()}.</Text>
            <Text style={styles.subtitle}>Here are your starting targets. Adjust them any time from your profile.</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.previewLabel}>DAILY CALORIES</Text>
              <Text style={styles.summaryValue}>{calorieTarget}</Text>
              <Text style={styles.summaryGoal}>{getGoalLabel()}</Text>
            </View>

            <View style={styles.macroRow}>
              <Macro value={calorieTarget ? Math.round(calorieTarget * 0.6 / 4) : '—'} label="Carbs" />
              <Macro value={proteinTarget ?? '—'} label="Protein" />
              <Macro value={calorieTarget ? Math.round(calorieTarget * 0.15 / 9) : '—'} label="Fat" />
            </View>

            <View style={styles.infoCard}>
              <InfoRow label="Training" value={getExperienceDescription()} />
              <InfoRow label="Maintenance" value={`${tdee} kcal / day`} />
              {goal !== 'maintain' && (
                <InfoRow label={goal === 'bulk' ? 'Daily surplus' : 'Daily deficit'} value={`${calorieAdjustment} kcal / day`} />
              )}
              <InfoRow
                label="Your stats"
                value={imperial
                  ? `${heightFt}ft ${heightIn || 0}in · ${weightLbs}lbs`
                  : `${getHeightCm()}cm · ${getWeightKg()}kg`}
                last
              />
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Feather name="alert-circle" size={15} color={COLORS.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {step === 6 ? (
          <Button title="START TRAINING" onPress={saveProfile} loading={saving} />
        ) : (
          <Button title="CONTINUE" onPress={next} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Small presentational helpers ────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function UnitInput({ value, onChangeText, placeholder, unit, keyboardType = 'decimal-pad', label }) {
  return (
    <View style={[styles.unitInputWrap, { flex: 1 }]}>
      <TextInput
        style={styles.unitInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textFaint}
        accessibilityLabel={label}
      />
      <Text style={styles.unitSuffix}>{unit}</Text>
    </View>
  );
}

function ChoiceCard({ icon, label, desc, selected, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.selectCard, selected && styles.selectCardActive, pressed && !selected && styles.selectCardPressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${desc}`}
    >
      <View style={[styles.selectIcon, selected && styles.selectIconActive]}>
        <Feather name={icon} size={18} color={selected ? COLORS.onGold : COLORS.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.selectLabel, selected && styles.selectLabelActive]}>{label}</Text>
        <Text style={styles.selectDesc}>{desc}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

function Macro({ value, label }) {
  return (
    <View style={styles.macroBox} accessible accessibilityLabel={`${label} ${value} grams`}>
      <Text style={styles.macroValue}>{value}<Text style={styles.macroUnit}>g</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  topBar:        { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.md },
  topRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: HIT },
  backBtn:       { width: HIT, height: HIT, justifyContent: 'center', marginLeft: -8 },
  stepCount:     { ...TYPE.caption, color: COLORS.textDim, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: 'hidden', marginTop: 4 },
  progressFill:  { height: 4, borderRadius: 2, backgroundColor: COLORS.gold },

  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },

  logo:    { fontSize: 32, fontWeight: FONT.black, color: COLORS.gold, letterSpacing: 8 },
  logoSub: { fontSize: 11, fontWeight: FONT.semibold, color: COLORS.textDim, letterSpacing: 5, marginTop: 4, marginBottom: 40 },
  title:   { ...TYPE.display, color: COLORS.white, marginBottom: 10 },
  subtitle:{ ...TYPE.body, color: COLORS.textMuted, marginBottom: SPACING.xl },

  field:      { marginBottom: SPACING.lg },
  fieldLabel: { ...TYPE.caption, color: COLORS.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surfaceDark, color: COLORS.white,
    borderRadius: RADIUS.md, paddingHorizontal: 16, minHeight: 54, fontSize: 17,
    borderWidth: 1, borderColor: COLORS.border,
  },
  unitInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, paddingRight: 16,
  },
  unitInput:  { flex: 1, color: COLORS.white, paddingHorizontal: 16, minHeight: 54, fontSize: 17 },
  unitSuffix: { color: COLORS.textMuted, fontSize: 15, fontWeight: FONT.medium },

  unitToggle: {
    flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
    padding: 3, marginBottom: SPACING.lg,
  },
  unitOption:           { paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', borderRadius: RADIUS.pill },
  unitOptionActive:     { backgroundColor: COLORS.gold },
  unitOptionText:       { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.semibold },
  unitOptionTextActive: { color: COLORS.onGold },

  optionRow:          { flexDirection: 'row', gap: 12 },
  optionButton:       { flex: 1, minHeight: 54, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: COLORS.surfaceDark, borderWidth: 1, borderColor: COLORS.border },
  optionButtonActive: { backgroundColor: COLORS.goldFaint, borderColor: COLORS.gold },
  optionText:         { color: COLORS.textSecondary, fontSize: 16, fontWeight: FONT.semibold },
  optionTextActive:   { color: COLORS.gold },

  selectCard:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.surface,
                       borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  selectCardActive:  { borderColor: COLORS.gold, backgroundColor: COLORS.goldFaint },
  selectCardPressed: { backgroundColor: COLORS.surfaceRaised },
  selectIcon:        { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceDark,
                       alignItems: 'center', justifyContent: 'center' },
  selectIconActive:  { backgroundColor: COLORS.gold },
  selectLabel:       { ...TYPE.heading, color: COLORS.white, marginBottom: 3 },
  selectLabelActive: { color: COLORS.goldBright },
  selectDesc:        { ...TYPE.callout, color: COLORS.textMuted },
  radio:             { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderStrong,
                       alignItems: 'center', justifyContent: 'center' },
  radioOn:           { borderColor: COLORS.gold },
  radioDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },

  sliderCard:   { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: 12,
                  borderWidth: 1, borderColor: COLORS.border },
  previewCard:  { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center',
                  borderWidth: 1, borderColor: COLORS.goldBorder },
  previewLabel: { ...TYPE.overline, color: COLORS.gold, marginBottom: 6 },
  previewValue: { color: COLORS.white, fontSize: 48, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  previewUnit:  { fontSize: 18, color: COLORS.textMuted, fontWeight: FONT.medium },
  previewSub:   { ...TYPE.caption, color: COLORS.textMuted, marginTop: 4 },

  summaryCard:  { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center',
                  marginBottom: 12, borderWidth: 1, borderColor: COLORS.goldBorder },
  summaryValue: { color: COLORS.white, fontSize: 56, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  summaryGoal:  { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 2 },

  macroRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  macroBox:   { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center',
                borderWidth: 1, borderColor: COLORS.border },
  macroValue: { color: COLORS.white, fontSize: 22, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  macroUnit:  { fontSize: 13, color: COLORS.textMuted, fontWeight: FONT.medium },
  macroLabel: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 2 },

  infoCard:      { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md,
                   borderWidth: 1, borderColor: COLORS.border },
  infoRow:       { paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel:     { ...TYPE.caption, color: COLORS.textDim, marginBottom: 3 },
  infoValue:     { ...TYPE.body, color: COLORS.white },

  error:     { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.redFaint,
               borderRadius: RADIUS.md, padding: 12, marginTop: SPACING.sm },
  errorText: { ...TYPE.callout, color: COLORS.red, flex: 1 },

  footer: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border,
            backgroundColor: COLORS.background },
});
