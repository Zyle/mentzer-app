import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import CalorieSlider from '../components/CalorieSlider';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

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
            ⚠️  Deficits above 400 cal/day risk muscle loss. Keep training intensity high and protein intake up.
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
  value:   { color: COLORS.white, fontSize: 26, fontWeight: FONT.black },
  label:   { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, fontWeight: FONT.semibold, marginTop: 4 },
  divider: { width: 1, height: 40, backgroundColor: COLORS.border, marginHorizontal: 16 },
  warning: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  warningText: { color: COLORS.orange, fontSize: 12, lineHeight: 18 },
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
  const [step, setStep] = useState(0);

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
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (step === 1 && (!age || !sex)) {
      Alert.alert('Required', 'Please enter your age and select your sex.');
      return;
    }
    if (step === 2) {
      const hOk = imperial ? (heightFt !== '') : (heightCm !== '');
      const wOk = imperial ? (weightLbs !== '') : (weightKg !== '');
      if (!hOk || !wOk) {
        Alert.alert('Required', 'Please enter your height and weight.');
        return;
      }
    }
    if (step === 3 && !goal) {
      Alert.alert('Required', 'Please select your goal.');
      return;
    }
    if (step === 5 && !experience) {
      Alert.alert('Required', 'Please select your experience level.');
      return;
    }
    // skip calorie step for maintain
    if (step === 3 && goal === 'maintain') { setStep(5); return; }
    setStep(s => s + 1);
  };

  const back = () => {
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
    if (goal === 'bulk') return 'Muscle Gain';
    if (goal === 'cut')  return 'Fat Loss';
    return 'Maintain';
  };

  const getExperienceDescription = () => {
    if (experience === 'beginner')     return 'HD2: 1 set to failure, 4+ days rest between sessions';
    if (experience === 'intermediate') return 'HD2: Consolidated routine, 4-6 days rest';
    return 'HD2: Squats, Dips, Deadlifts — up to 7 days rest';
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        name: name.trim(),
        age: parseInt(age),
        sex,
        height_cm:      getHeightCm(),
        bodyweight_kg:  getWeightKg(),
        goal,
        experience_level:   experience,
        calorie_adjustment: getSignedAdjustment(),
        last_weight_checkin: new Date().toISOString(),
      });
      onComplete();
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const tdee          = calculateTDEE();
  const calorieTarget = getCalorieTarget();
  const proteinTarget = getWeightKg() ? Math.round(getWeightKg() * 0.8) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Progress dots */}
      <View style={styles.progressBar}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* STEP 0 — Welcome */}
        {step === 0 && (
          <View style={styles.stepContainer}>
            <Text style={styles.logo}>MENTZER</Text>
            <Text style={styles.logoSub}>HEAVY DUTY METHOD</Text>
            <Text style={styles.title}>Welcome, Athlete.</Text>
            <Text style={styles.subtitle}>
              Mike Mentzer's Heavy Duty system is the most scientifically rigorous approach to building muscle ever devised. This app will be your coach.
            </Text>
            <Text style={styles.fieldLabel}>YOUR NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textFaint}
              autoFocus
            />
          </View>
        )}

        {/* STEP 1 — Personal */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>About You</Text>
            <Text style={styles.subtitle}>Used to calculate your exact calorie and recovery targets.</Text>

            <Text style={styles.fieldLabel}>AGE</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholder="25"
              placeholderTextColor={COLORS.textFaint}
            />

            <Text style={styles.fieldLabel}>SEX</Text>
            <View style={styles.optionRow}>
              {['male', 'female'].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.optionButton, sex === s && styles.optionButtonActive]}
                  onPress={() => setSex(s)}
                >
                  <Text style={[styles.optionText, sex === s && styles.optionTextActive]}>
                    {s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STEP 2 — Body */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.title}>Your Body</Text>
              {/* Unit toggle */}
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitOption, !imperial && styles.unitOptionActive]}
                  onPress={() => imperial && toggleUnits()}
                >
                  <Text style={[styles.unitOptionText, !imperial && styles.unitOptionTextActive]}>KG / CM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitOption, imperial && styles.unitOptionActive]}
                  onPress={() => !imperial && toggleUnits()}
                >
                  <Text style={[styles.unitOptionText, imperial && styles.unitOptionTextActive]}>LBS / FT</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.subtitle}>Your weight will be re-checked every 2 weeks to keep your targets accurate.</Text>

            {/* Height */}
            <Text style={styles.fieldLabel}>HEIGHT</Text>
            {imperial ? (
              <View style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={heightFt}
                    onChangeText={setHeightFt}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={COLORS.textFaint}
                  />
                  <Text style={styles.unitHint}>ft</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={heightIn}
                    onChangeText={setHeightIn}
                    keyboardType="number-pad"
                    placeholder="11"
                    placeholderTextColor={COLORS.textFaint}
                  />
                  <Text style={styles.unitHint}>in</Text>
                </View>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="decimal-pad"
                  placeholder="180"
                  placeholderTextColor={COLORS.textFaint}
                />
                <Text style={styles.unitHint}>cm</Text>
              </>
            )}

            {/* Weight */}
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>WEIGHT</Text>
            {imperial ? (
              <>
                <TextInput
                  style={styles.input}
                  value={weightLbs}
                  onChangeText={setWeightLbs}
                  keyboardType="decimal-pad"
                  placeholder="176"
                  placeholderTextColor={COLORS.textFaint}
                />
                <Text style={styles.unitHint}>lbs</Text>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="decimal-pad"
                  placeholder="80"
                  placeholderTextColor={COLORS.textFaint}
                />
                <Text style={styles.unitHint}>kg</Text>
              </>
            )}
          </View>
        )}

        {/* STEP 3 — Goal */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Your Goal</Text>
            <Text style={styles.subtitle}>This determines your calorie target. You can change this anytime.</Text>

            {[
              { key: 'bulk',     label: 'MUSCLE GAIN', desc: "Build maximum muscle with a calorie surplus. You'll set the exact amount on the next screen." },
              { key: 'maintain', label: 'MAINTAIN',    desc: 'Build strength and maintain your current weight. Eat at your maintenance calories.' },
              { key: 'cut',      label: 'FAT LOSS',    desc: "Lose fat while preserving muscle with a calorie deficit. You'll set the exact amount on the next screen." },
            ].map(g => (
              <TouchableOpacity
                key={g.key}
                style={[styles.selectCard, goal === g.key && styles.selectCardActive]}
                onPress={() => selectGoal(g.key)}
              >
                <Text style={[styles.selectLabel, goal === g.key && styles.selectLabelActive]}>{g.label}</Text>
                <Text style={styles.selectDesc}>{g.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 4 — Calorie adjustment (bulk) */}
        {step === 4 && goal === 'bulk' && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Set Your Surplus</Text>
            <Text style={styles.subtitle}>
              How many extra calories above your maintenance of {tdee} kcal would you like each day?
            </Text>
            <View style={styles.sliderCard}>
              <CalorieSlider
                value={calorieAdjustment}
                min={50}
                max={300}
                step={50}
                onChange={setCalorieAdjustment}
                color={COLORS.gold}
                zones={BULK_ZONES}
              />
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>YOUR DAILY CALORIE TARGET</Text>
              <Text style={styles.previewValue}>{calorieTarget}</Text>
              <Text style={styles.previewSub}>maintenance {tdee} + surplus {calorieAdjustment}</Text>
            </View>
          </View>
        )}

        {/* STEP 4 — Calorie adjustment (cut) */}
        {step === 4 && goal === 'cut' && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Set Your Deficit</Text>
            <Text style={styles.subtitle}>
              How many calories below your maintenance of {tdee} kcal would you like to cut each day?
            </Text>
            <View style={styles.sliderCard}>
              <CalorieSlider
                value={calorieAdjustment}
                min={100}
                max={500}
                step={50}
                onChange={setCalorieAdjustment}
                color={COLORS.red}
                zones={CUT_ZONES}
              />
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>YOUR DAILY CALORIE TARGET</Text>
              <Text style={styles.previewValue}>{calorieTarget}</Text>
              <Text style={styles.previewSub}>maintenance {tdee} − deficit {calorieAdjustment}</Text>
            </View>
            <WeightLossPrediction deficit={calorieAdjustment} imperial={imperial} />
          </View>
        )}

        {/* STEP 5 — Experience */}
        {step === 5 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Experience Level</Text>
            <Text style={styles.subtitle}>Be honest — this determines your training frequency and volume.</Text>

            {[
              { key: 'beginner',     label: 'BEGINNER',     desc: 'Under 1 year of training. HD2 still applies — one set to failure, minimum 4 days rest.' },
              { key: 'intermediate', label: 'INTERMEDIATE', desc: '1-3 years of serious training. Full HD2 protocol — consolidated routine, 4-6 days rest.' },
              { key: 'advanced',     label: 'ADVANCED',     desc: '3+ years of training. HD2 consolidated — Squats, Dips, Deadlifts only. Up to 7 days rest.' },
            ].map(e => (
              <TouchableOpacity
                key={e.key}
                style={[styles.selectCard, experience === e.key && styles.selectCardActive]}
                onPress={() => setExperience(e.key)}
              >
                <Text style={[styles.selectLabel, experience === e.key && styles.selectLabelActive]}>{e.label}</Text>
                <Text style={styles.selectDesc}>{e.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 6 — Summary */}
        {step === 6 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Your Plan, {name}.</Text>
            <Text style={styles.subtitle}>Based on your stats, here are your targets.</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>DAILY CALORIES</Text>
              <Text style={styles.summaryValue}>{calorieTarget}</Text>
              <Text style={styles.summaryGoal}>{getGoalLabel().toUpperCase()}</Text>
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroBox}>
                <Text style={styles.macroValue}>{calorieTarget ? Math.round(calorieTarget * 0.6 / 4) : '—'}g</Text>
                <Text style={styles.macroLabel}>CARBS</Text>
              </View>
              <View style={styles.macroBox}>
                <Text style={styles.macroValue}>{proteinTarget}g</Text>
                <Text style={styles.macroLabel}>PROTEIN</Text>
              </View>
              <View style={styles.macroBox}>
                <Text style={styles.macroValue}>{calorieTarget ? Math.round(calorieTarget * 0.15 / 9) : '—'}g</Text>
                <Text style={styles.macroLabel}>FAT</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>TRAINING FREQUENCY</Text>
              <Text style={styles.infoValue}>{getExperienceDescription()}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>MAINTENANCE CALORIES</Text>
              <Text style={styles.infoValue}>{tdee} kcal/day</Text>
            </View>

            {goal !== 'maintain' && (
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>{goal === 'bulk' ? 'DAILY SURPLUS' : 'DAILY DEFICIT'}</Text>
                <Text style={styles.infoValue}>{calorieAdjustment} cal/day</Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>YOUR STATS</Text>
              <Text style={styles.infoValue}>
                {imperial
                  ? `${heightFt}ft ${heightIn}in · ${weightLbs}lbs`
                  : `${getHeightCm()}cm · ${getWeightKg()}kg`}
              </Text>
            </View>

            <Text style={styles.quote}>
              "The purpose of training is to stimulate growth. Everything else is wasted effort."
            </Text>
            <Text style={styles.quoteAuthor}>— Mike Mentzer</Text>
          </View>
        )}

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {step === 6 ? (
          <TouchableOpacity style={styles.primaryButton} onPress={saveProfile} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? 'SAVING...' : 'START TRAINING'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={next}>
            <Text style={styles.primaryButtonText}>CONTINUE →</Text>
          </TouchableOpacity>
        )}
        {step > 0 && (
          <TouchableOpacity onPress={back} style={styles.backButton}>
            <Text style={styles.backButtonText}>← BACK</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  progressBar:  { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 60, paddingBottom: 20 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a2a2a' },
  dotActive:    { backgroundColor: COLORS.gold },
  content:      { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  stepContainer:{ flex: 1 },

  logo:    { fontSize: 36, fontWeight: FONT.black, color: COLORS.gold, letterSpacing: 8, marginBottom: 4 },
  logoSub: { fontSize: 10, color: COLORS.textDim, letterSpacing: 4, marginBottom: 40 },
  title:   { fontSize: 28, fontWeight: FONT.black, color: COLORS.white, marginBottom: 12 },
  subtitle:{ fontSize: 14, color: COLORS.textMuted, lineHeight: 22, marginBottom: 32 },

  stepTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  // Unit toggle
  unitToggle: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  unitOption: {
    paddingHorizontal: 12, paddingVertical: 8,
  },
  unitOptionActive: { backgroundColor: COLORS.gold },
  unitOptionText:   { color: COLORS.textDim, fontSize: 10, fontWeight: FONT.bold, letterSpacing: 1 },
  unitOptionTextActive: { color: '#000' },

  fieldLabel: { color: COLORS.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#1a1a1a', color: COLORS.white,
    borderRadius: RADIUS.md, padding: 16, fontSize: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  unitHint: { color: COLORS.textFaint, fontSize: 11, marginTop: 6, letterSpacing: 1 },

  optionRow:          { flexDirection: 'row', gap: 12 },
  optionButton:       { flex: 1, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: COLORS.border },
  optionButtonActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  optionText:         { color: COLORS.textDim, fontWeight: FONT.semibold, letterSpacing: 2 },
  optionTextActive:   { color: '#000' },

  selectCard:        { backgroundColor: '#1a1a1a', borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  selectCardActive:  { borderColor: COLORS.gold, backgroundColor: '#1a1500' },
  selectLabel:       { color: COLORS.textDim, fontSize: 13, fontWeight: FONT.bold, letterSpacing: 2, marginBottom: 6 },
  selectLabelActive: { color: COLORS.gold },
  selectDesc:        { color: COLORS.textMuted, fontSize: 13, lineHeight: 20 },

  sliderCard:   { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  previewCard:  { backgroundColor: '#1a1500', borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', borderWidth: 1, borderColor: COLORS.goldBorder },
  previewLabel: { color: COLORS.gold, fontSize: 10, letterSpacing: 3, marginBottom: 8 },
  previewValue: { color: COLORS.white, fontSize: 52, fontWeight: FONT.black },
  previewSub:   { color: COLORS.textDim, fontSize: 11, marginTop: 4, letterSpacing: 1 },

  summaryCard:  { backgroundColor: '#1a1500', borderRadius: RADIUS.md, padding: SPACING.xl, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: COLORS.goldBorder },
  summaryLabel: { color: COLORS.gold, fontSize: 10, letterSpacing: 3, marginBottom: 8 },
  summaryValue: { color: COLORS.white, fontSize: 56, fontWeight: FONT.black },
  summaryGoal:  { color: COLORS.textMuted, fontSize: 12, letterSpacing: 2, marginTop: 4 },

  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  macroBox: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  macroValue: { color: COLORS.white, fontSize: 20, fontWeight: FONT.black },
  macroLabel: { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, marginTop: 4 },

  infoCard:  { backgroundColor: '#1a1a1a', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  infoLabel: { color: COLORS.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  infoValue: { color: COLORS.white, fontSize: 15, fontWeight: FONT.medium },

  quote:       { color: COLORS.textDim, fontSize: 13, fontStyle: 'italic', lineHeight: 20, marginTop: 16, textAlign: 'center' },
  quoteAuthor: { color: COLORS.gold, fontSize: 11, textAlign: 'center', marginTop: 6, letterSpacing: 1 },

  footer:            { padding: SPACING.xl, paddingBottom: 40 },
  primaryButton:     { backgroundColor: COLORS.gold, paddingVertical: 18, borderRadius: RADIUS.md, alignItems: 'center' },
  primaryButtonText: { color: '#000', fontSize: 14, fontWeight: FONT.black, letterSpacing: 2 },
  backButton:        { alignItems: 'center', marginTop: 16 },
  backButtonText:    { color: COLORS.textDim, fontSize: 12, letterSpacing: 1 },
});
