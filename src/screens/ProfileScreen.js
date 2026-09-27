import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import { LinearGradient } from 'expo-linear-gradient';
import { IconBadge } from '../components/Badges';
import Button from '../components/Button';
import ScreenHeader from '../components/ScreenHeader';
import SectionTitle from '../components/SectionTitle';
import CalorieSlider from '../components/CalorieSlider';
import { SURPLUS_RANGE, DEFICIT_RANGE } from '../data/calorieRanges';
import { useUnits, kgToDisplay, displayToKg, cmToFtIn, ftInToCm } from '../lib/units';
import { COLORS, GRADIENTS, FONT, TYPE, RADIUS, SPACING, HIT } from '../theme';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bodyweight, setBodyweight] = useState('');
  const [height, setHeight] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const { imperial, weightUnit, fmtHeight } = useUnits();
  const [age, setAge] = useState('');
  const [name, setName] = useState('');
  const [calorieAdjustment, setCalorieAdjustment] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Reload on focus so changes made in Settings (e.g. goal) show immediately
  useFocusEffect(useCallback(() => { if (!editing) loadData(); }, [editing]));

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setAge(data.age?.toString() || '');
        setName(data.name || '');
        setCalorieAdjustment(Math.abs(data.calorie_adjustment || 0));
      }
    } catch (e) {
      console.error('ProfileScreen loadData error:', e);
    }
  };

  // Fill the edit form in the user's chosen units
  const startEditing = () => {
    const w = kgToDisplay(profile?.bodyweight_kg, imperial);
    setBodyweight(w != null ? String(w) : '');
    if (profile?.height_cm) {
      const { ft, inches } = cmToFtIn(profile.height_cm);
      setHeightFt(String(ft));
      setHeightIn(String(inches));
      setHeight(String(profile.height_cm));
    } else {
      setHeightFt(''); setHeightIn(''); setHeight('');
    }
    // Keep a saved adjustment inside the slider's range (older accounts may exceed it)
    const range = profile?.goal === 'bulk' ? SURPLUS_RANGE : DEFICIT_RANGE;
    setCalorieAdjustment(v => Math.min(Math.max(v, range.min), range.max));
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const signedAdjustment = profile?.goal === 'bulk'
        ? calorieAdjustment
        : profile?.goal === 'cut'
          ? -calorieAdjustment
          : 0;

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        name,
        bodyweight_kg: displayToKg(bodyweight, imperial) || null,
        height_cm: (imperial ? (heightFt || heightIn ? ftInToCm(heightFt, heightIn) : null) : parseFloat(height)) || null,
        age: parseInt(age) || null,
        calorie_adjustment: signedAdjustment,
        last_weight_checkin: new Date().toISOString(),
      });
      if (error) throw error;
      setEditing(false);
      loadData();
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  // Mifflin-St Jeor TDEE
  const calculateTDEE = () => {
    if (!profile?.bodyweight_kg || !profile?.height_cm || !profile?.age || !profile?.sex) return null;
    const { bodyweight_kg: w, height_cm: h, age: a, sex } = profile;
    const bmr = sex === 'male'
      ? (10 * w) + (6.25 * h) - (5 * a) + 5
      : (10 * w) + (6.25 * h) - (5 * a) - 161;
    return Math.round(bmr * 1.375);
  };

  const tdee = calculateTDEE();

  const getCalorieTarget = () => {
    if (!tdee) return null;
    return tdee + (profile?.calorie_adjustment || 0);
  };

  const calorieTarget = getCalorieTarget();
  const proteinTarget = profile?.bodyweight_kg ? Math.round(profile.bodyweight_kg * 0.8) : null;

  const getGoalLabel = () => {
    if (profile?.goal === 'bulk') return 'BUILDING';
    if (profile?.goal === 'cut') return 'CUTTING';
    if (profile?.goal === 'recomp') return 'RECOMP';
    return 'MAINTAIN';
  };

  const getExperienceLabel = () => {
    const map = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
    return map[profile?.experience_level] || '—';
  };

  const initial = (profile?.name || 'A').trim().charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        <ScreenHeader
          title="Profile"
          subtitle="You & your targets"
          right={
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: COLORS.surfaceRaised }]}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Feather name="settings" size={20} color={COLORS.textSecondary} />
            </Pressable>
          }
        />

        {/* Profile card */}
        <Card style={styles.cardSpacing}>
          {editing ? (
            <>
              <Text style={styles.editTitle} accessibilityRole="header">Edit profile</Text>
              <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" />
              <View style={styles.inputRow}>
                <LabeledInput label="Weight" unit={weightUnit} value={bodyweight} onChangeText={setBodyweight} keyboardType="decimal-pad" placeholder={imperial ? '176' : '80'} style={{ flex: 1 }} />
                <LabeledInput label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="30" style={{ flex: 0.8 }} />
              </View>
              {imperial ? (
                <View style={styles.inputRow}>
                  <LabeledInput label="Height" unit="ft" value={heightFt} onChangeText={setHeightFt} keyboardType="number-pad" placeholder="5" style={{ flex: 1 }} />
                  <LabeledInput label="Height" unit="in" value={heightIn} onChangeText={setHeightIn} keyboardType="number-pad" placeholder="11" style={{ flex: 1 }} />
                </View>
              ) : (
                <LabeledInput label="Height" unit="cm" value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="175" />
              )}

              {profile?.goal !== 'maintain' && profile?.goal !== 'recomp' && profile?.goal && (
                <>
                  <Text style={styles.label}>
                    {profile.goal === 'bulk' ? 'Daily surplus' : 'Daily deficit'}
                  </Text>
                  <CalorieSlider
                    value={calorieAdjustment}
                    min={(profile.goal === 'bulk' ? SURPLUS_RANGE : DEFICIT_RANGE).min}
                    max={(profile.goal === 'bulk' ? SURPLUS_RANGE : DEFICIT_RANGE).max}
                    step={(profile.goal === 'bulk' ? SURPLUS_RANGE : DEFICIT_RANGE).step}
                    onChange={setCalorieAdjustment}
                    onDragStart={() => setScrollEnabled(false)}
                    onDragEnd={() => setScrollEnabled(true)}
                    color={profile.goal === 'bulk' ? COLORS.gold : COLORS.red}
                    accessibilityLabel={profile.goal === 'bulk' ? 'Daily calorie surplus' : 'Daily calorie deficit'}
                  />
                  {profile.goal === 'cut' && (
                    <View style={styles.predictionCard}>
                      <View style={styles.predictionRow}>
                        <View style={styles.predictionStat}>
                          <Text style={styles.predictionValue}>
                            ~{(((calorieAdjustment * 7) / 7700) * (imperial ? 2.20462 : 1)).toFixed(2)}{weightUnit}
                          </Text>
                          <Text style={styles.predictionLabel}>PER WEEK</Text>
                        </View>
                        <View style={styles.predictionDivider} />
                        <View style={styles.predictionStat}>
                          <Text style={styles.predictionValue}>
                            ~{kgToDisplay((calorieAdjustment * 30) / 7700, imperial)}{weightUnit}
                          </Text>
                          <Text style={styles.predictionLabel}>PER MONTH</Text>
                        </View>
                      </View>
                      {calorieAdjustment >= 400 && (
                        <Text style={styles.predictionWarning}>
                          Deficits above 400 kcal/day risk muscle loss. Keep training intensity high.
                        </Text>
                      )}
                    </View>
                  )}
                </>
              )}

              <Button title="Save changes" onPress={saveProfile} loading={saving} style={{ marginTop: SPACING.lg }} />
              <Button title="Cancel" variant="ghost" size="md" onPress={() => { setEditing(false); loadData(); }} style={{ marginTop: SPACING.sm }} />
            </>
          ) : (
            <>
              <View style={styles.profileRow}>
                <LinearGradient colors={GRADIENTS.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
                  <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName} numberOfLines={1}>{profile?.name || 'Athlete'}</Text>
                  {profile?.email ? <Text style={styles.profileEmail} numberOfLines={1}>{profile.email}</Text> : null}
                </View>
                <Button title="Edit" variant="secondary" size="md" icon="edit-2" onPress={startEditing} hint="Edit your name, body stats and calorie adjustment" />
              </View>

              <View style={styles.profileStats}>
                <Stat value={profile?.bodyweight_kg ? `${kgToDisplay(profile.bodyweight_kg, imperial)}` : '—'} unit={weightUnit} label="Weight" />
                <Stat
                  value={profile?.height_cm ? (imperial ? fmtHeight(profile.height_cm) : `${profile.height_cm}`) : '—'}
                  unit={imperial ? undefined : 'cm'}
                  label="Height"
                />
                <Stat value={profile?.age ? `${profile.age}` : '—'} label="Age" />
                <Stat value={getExperienceLabel()} label="Level" small />
              </View>
            </>
          )}
        </Card>

        {/* Nutrition targets */}
        {calorieTarget && (
          <>
            <SectionTitle
              title="Nutrition targets"
              right={<View style={styles.goalBadge}><Text style={styles.goalBadgeText}>{getGoalLabel()}</Text></View>}
            />
            <Card style={styles.cardSpacingTight}>
              <View style={styles.metricRow}>
                <View style={styles.metricBox} accessible accessibilityLabel={`Daily target ${calorieTarget} calories`}>
                  <Text style={styles.metricValue}>{calorieTarget.toLocaleString()}</Text>
                  <Text style={styles.metricLabel}>Daily target (kcal)</Text>
                </View>
                <View style={styles.metricBox} accessible accessibilityLabel={`Maintenance ${tdee} calories`}>
                  <Text style={[styles.metricValue, { color: COLORS.white }]}>{tdee.toLocaleString()}</Text>
                  <Text style={styles.metricLabel}>Maintenance (kcal)</Text>
                </View>
              </View>

              <View style={styles.macroRow}>
                <Macro value={Math.round(calorieTarget * 0.6 / 4)} label="Carbs" sub="60% kcal" />
                <Macro value={proteinTarget} label="Protein" sub="0.8 g/kg" />
                <Macro value={Math.round(calorieTarget * 0.15 / 9)} label="Fat" sub="15% kcal" />
              </View>

              {profile?.goal === 'bulk' && (
                <View style={styles.mentzerNote}>
                  <Text style={styles.mentzerNoteLabel}>MENTZER'S MATH</Text>
                  <Text style={styles.mentzerNoteText}>
                    A pound of muscle holds about 600 calories. Gaining 10 lb of muscle in a year takes roughly 6,000 extra calories: about 16 a day above maintenance.
                  </Text>
                </View>
              )}
            </Card>
          </>
        )}

        {/* Heavy Duty protocol */}
        <SectionTitle title="Heavy Duty protocol" />
        <Card style={[styles.cardSpacingTight, { paddingVertical: 4 }]}>
          <InfoRow
            icon="calendar"
            label="Frequency"
            value={profile?.experience_level === 'advanced' ? 'Every 5–7 days' : 'Every 4–6 days'}
          />
          <InfoRow icon="zap" label="Sets per exercise" value="1, to absolute failure" />
          <InfoRow icon="repeat" label="Rep range" value="About 6–10" />
          <InfoRow icon="clock" label="Between exercises" value="Only as long as needed" last />
        </Card>

        <Button title="Sign out" variant="secondary" icon="log-out" onPress={signOut} style={styles.signOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Presentational helpers ──────────────────────────────────────────────────
function LabeledInput({ label, unit, style, ...props }) {
  return (
    <View style={style}>
      <Text style={styles.label}>{label}{unit ? ` (${unit})` : ''}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={COLORS.textFaint}
        accessibilityLabel={unit ? `${label} in ${unit}` : label}
        {...props}
      />
    </View>
  );
}

function Stat({ value, unit, label, small }) {
  return (
    <View style={styles.profileStat} accessible accessibilityLabel={`${label} ${value}${unit ? ` ${unit}` : ''}`}>
      <Text style={[styles.profileStatValue, small && { fontSize: 14 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}{unit && value !== '—' ? <Text style={styles.profileStatUnit}>{unit}</Text> : null}
      </Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );
}

function Macro({ value, label, sub }) {
  return (
    <View style={styles.macroBox} accessible accessibilityLabel={`${label} ${value} grams, ${sub}`}>
      <Text style={styles.macroValue}>{value}<Text style={styles.macroUnit}>g</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroPct}>{sub}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]} accessible accessibilityLabel={`${label}: ${value}`}>
      <IconBadge icon={icon} size={34} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  cardSpacing:      { marginHorizontal: SPACING.screen },
  cardSpacingTight: { marginHorizontal: SPACING.screen },
  iconBtn:          { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },

  // Profile card
  profileRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: SPACING.lg },
  avatarRing:       { width: 56, height: 56, borderRadius: 28, padding: 2 },
  avatar:           { flex: 1, borderRadius: 26, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { color: COLORS.gold, fontSize: 22, fontWeight: FONT.black },
  profileName:      { ...TYPE.title, color: COLORS.white },
  profileEmail:     { ...TYPE.caption, color: COLORS.textDim, marginTop: 2 },
  profileStats:     { flexDirection: 'row', gap: 8 },
  profileStat: {
    flex: 1, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md,
    paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center',
  },
  profileStatValue: { color: COLORS.white, fontSize: 18, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  profileStatUnit:  { color: COLORS.textMuted, fontSize: 12, fontWeight: FONT.medium },
  profileStatLabel: { ...TYPE.caption, color: COLORS.textDim, marginTop: 3 },

  // Edit form
  editTitle: { ...TYPE.heading, color: COLORS.white, marginBottom: 4 },
  inputRow:  { flexDirection: 'row', gap: 8 },
  label:     { ...TYPE.caption, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.md },
  input:     { backgroundColor: COLORS.surfaceDark, color: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: 14,
               minHeight: 50, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },

  // Nutrition card
  goalBadge:     { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3,
                   borderWidth: 1, borderColor: COLORS.goldBorder },
  goalBadgeText: { color: COLORS.gold, fontSize: 11, fontWeight: FONT.semibold, letterSpacing: 1.2 },
  metricRow:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  metricBox:  { flex: 1, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  metricValue:{ color: COLORS.gold, fontSize: 28, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  metricLabel:{ ...TYPE.caption, color: COLORS.textDim, marginTop: 3 },
  macroRow:   { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  macroBox:   { flex: 1, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  macroValue: { color: COLORS.white, fontSize: 20, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  macroUnit:  { color: COLORS.textMuted, fontSize: 12, fontWeight: FONT.medium },
  macroLabel: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: 3 },
  macroPct:   { color: COLORS.textDim, fontSize: 11, marginTop: 1 },
  mentzerNote:      { backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md, padding: 14,
                      borderLeftWidth: 3, borderLeftColor: COLORS.gold },
  mentzerNoteLabel: { ...TYPE.overline, color: COLORS.gold, marginBottom: 6 },
  mentzerNoteText:  { ...TYPE.callout, color: COLORS.textSecondary },

  // Protocol card
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel:     { ...TYPE.callout, color: COLORS.textMuted, flex: 1 },
  infoValue:     { ...TYPE.callout, color: COLORS.white, fontWeight: FONT.medium, textAlign: 'right', flexShrink: 1 },

  predictionCard:   { backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: 12 },
  predictionRow:    { flexDirection: 'row', alignItems: 'center' },
  predictionStat:   { flex: 1, alignItems: 'center' },
  predictionValue:  { color: COLORS.white, fontSize: 22, fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
  predictionLabel:  { ...TYPE.overline, color: COLORS.textDim, marginTop: 4 },
  predictionDivider:{ width: 1, height: 36, backgroundColor: COLORS.border, marginHorizontal: 16 },
  predictionWarning:{ ...TYPE.callout, color: COLORS.orange, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },

  signOut: { marginHorizontal: SPACING.screen, marginTop: SPACING.xl },
});
