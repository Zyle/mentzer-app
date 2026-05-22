import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import CalorieSlider from '../components/CalorieSlider';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [bodyweight, setBodyweight] = useState('');
  const [name, setName] = useState('');
  const [calorieAdjustment, setCalorieAdjustment] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      setBodyweight(data.bodyweight_kg?.toString() || '');
      setName(data.name || '');
      setCalorieAdjustment(Math.abs(data.calorie_adjustment || 0));
    }
  };

  const saveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const signedAdjustment = profile?.goal === 'bulk'
      ? calorieAdjustment
      : profile?.goal === 'cut'
        ? -calorieAdjustment
        : 0;

    await supabase.from('profiles').upsert({
      id: user.id,
      name,
      bodyweight_kg: parseFloat(bodyweight) || null,
      calorie_adjustment: signedAdjustment,
      last_weight_checkin: new Date().toISOString(),
    });
    setEditing(false);
    loadData();
  };

  const signOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
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
    if (profile?.goal === 'bulk') return 'MUSCLE GAIN';
    if (profile?.goal === 'cut') return 'FAT LOSS';
    return 'MAINTAIN';
  };

  const getExperienceLabel = () => {
    const map = { beginner: 'BEGINNER', intermediate: 'INTERMEDIATE', advanced: 'ADVANCED' };
    return map[profile?.experience_level] || '—';
  };

  return (
    <ScrollView style={styles.container}>
      <ScreenHeader title="PROFILE" subtitle="YOUR METRICS" bordered />

      {/* Profile Card */}
      <Card style={styles.cardSpacing}>
        {editing ? (
          <>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={COLORS.textFaint}
            />
            <Text style={styles.label}>BODYWEIGHT (KG)</Text>
            <TextInput
              style={styles.input}
              value={bodyweight}
              onChangeText={setBodyweight}
              keyboardType="decimal-pad"
              placeholder="80"
              placeholderTextColor={COLORS.textFaint}
            />
            {profile?.goal !== 'maintain' && profile?.goal && (
              <>
                <Text style={styles.label}>
                  {profile.goal === 'bulk' ? 'DAILY SURPLUS (CAL)' : 'DAILY DEFICIT (CAL)'}
                </Text>
                <CalorieSlider
                  value={calorieAdjustment}
                  min={profile.goal === 'bulk' ? 50 : 100}
                  max={profile.goal === 'bulk' ? 300 : 500}
                  step={50}
                  onChange={setCalorieAdjustment}
                  color={profile.goal === 'bulk' ? COLORS.gold : COLORS.red}
                />
                {profile.goal === 'cut' && (
                  <View style={styles.predictionCard}>
                    <View style={styles.predictionRow}>
                      <View style={styles.predictionStat}>
                        <Text style={styles.predictionValue}>
                          ~{((calorieAdjustment * 7) / 7700).toFixed(2)}kg
                        </Text>
                        <Text style={styles.predictionLabel}>PER WEEK</Text>
                      </View>
                      <View style={styles.predictionDivider} />
                      <View style={styles.predictionStat}>
                        <Text style={styles.predictionValue}>
                          ~{((calorieAdjustment * 30) / 7700).toFixed(1)}kg
                        </Text>
                        <Text style={styles.predictionLabel}>PER MONTH</Text>
                      </View>
                    </View>
                    {calorieAdjustment >= 400 && (
                      <Text style={styles.predictionWarning}>
                        ⚠️  Deficits above 400 cal/day risk muscle loss. Keep training intensity high.
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
              <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)}>
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.profileRow}>
              <View>
                <Text style={styles.profileName}>{profile?.name || 'Athlete'}</Text>
                <Text style={styles.profileEmail}>{profile?.email}</Text>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnText}>EDIT</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileStats}>
              {profile?.bodyweight_kg && (
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatValue}>{profile.bodyweight_kg}kg</Text>
                  <Text style={styles.profileStatLabel}>WEIGHT</Text>
                </View>
              )}
              {profile?.height_cm && (
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatValue}>{profile.height_cm}cm</Text>
                  <Text style={styles.profileStatLabel}>HEIGHT</Text>
                </View>
              )}
              {profile?.age && (
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatValue}>{profile.age}</Text>
                  <Text style={styles.profileStatLabel}>AGE</Text>
                </View>
              )}
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>{getExperienceLabel()}</Text>
                <Text style={styles.profileStatLabel}>LEVEL</Text>
              </View>
            </View>
          </>
        )}
      </Card>

      {/* Nutrition Targets */}
      {calorieTarget && (
        <Card style={styles.cardSpacing}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>NUTRITION TARGETS</Text>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>{getGoalLabel()}</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{calorieTarget}</Text>
              <Text style={styles.metricLabel}>DAILY CALORIES</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{tdee}</Text>
              <Text style={styles.metricLabel}>MAINTENANCE</Text>
            </View>
          </View>

          <View style={styles.macroRow}>
            <View style={styles.macroBox}>
              <Text style={styles.macroValue}>{Math.round(calorieTarget * 0.6 / 4)}g</Text>
              <Text style={styles.macroLabel}>CARBS</Text>
              <Text style={styles.macroPct}>60%</Text>
            </View>
            <View style={styles.macroBox}>
              <Text style={styles.macroValue}>{proteinTarget}g</Text>
              <Text style={styles.macroLabel}>PROTEIN</Text>
              <Text style={styles.macroPct}>25%</Text>
            </View>
            <View style={styles.macroBox}>
              <Text style={styles.macroValue}>{Math.round(calorieTarget * 0.15 / 9)}g</Text>
              <Text style={styles.macroLabel}>FAT</Text>
              <Text style={styles.macroPct}>15%</Text>
            </View>
          </View>

          {profile?.goal === 'bulk' && (
            <View style={styles.mentzerNote}>
              <Text style={styles.mentzerNoteText}>
                "You only need 16 extra calories per day above maintenance to build 10lbs of muscle in a year. Anything more is stored as fat." — Mentzer
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* HD2 Protocol */}
      <Card style={styles.cardSpacing}>
        <Text style={styles.cardTitle}>HD2 PROTOCOL</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>FREQUENCY</Text>
          <Text style={styles.infoValue}>
            {profile?.experience_level === 'advanced' ? 'Every 5-7 days' : 'Every 4-6 days'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>SETS PER EXERCISE</Text>
          <Text style={styles.infoValue}>1 set to absolute failure</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>CORE EXERCISES</Text>
          <Text style={styles.infoValue}>Squats · Dips · Deadlifts</Text>
        </View>
      </Card>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  cardSpacing: { marginHorizontal: SPACING.screen, marginTop: SPACING.lg, marginBottom: 0 },

  // Profile card
  profileRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  profileName:      { color: COLORS.white, fontSize: 22, fontWeight: FONT.bold },
  profileEmail:     { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  editBtn:          { backgroundColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8 },
  editBtnText:      { color: COLORS.gold, fontSize: 11, fontWeight: FONT.bold, letterSpacing: 1 },
  profileStats:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profileStat: {
    backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md,
    padding: 12, alignItems: 'center', minWidth: 70, borderWidth: 1, borderColor: COLORS.border,
  },
  profileStatValue: { color: COLORS.white, fontSize: 18, fontWeight: FONT.black },
  profileStatLabel: { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, fontWeight: FONT.semibold, marginTop: 4 },

  // Edit form
  label:  { color: COLORS.textDim, fontSize: 10, letterSpacing: 2, fontWeight: FONT.semibold, marginBottom: SPACING.sm, marginTop: SPACING.md },
  input:  { backgroundColor: COLORS.surfaceDark, color: COLORS.white, borderRadius: RADIUS.md, padding: 14, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
  saveButton:     { backgroundColor: COLORS.gold, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.lg },
  saveButtonText: { color: '#000', fontWeight: FONT.black, letterSpacing: 2, fontSize: 14 },
  cancelButton:     { paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm },
  cancelButtonText: { color: COLORS.textDim, fontSize: 13, letterSpacing: 1 },

  // Nutrition card
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  cardTitle:     { color: COLORS.white, fontSize: 13, fontWeight: FONT.bold, letterSpacing: 2 },
  goalBadge:     { backgroundColor: COLORS.goldFaint, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.goldBorder },
  goalBadgeText: { color: COLORS.gold, fontSize: 9, fontWeight: FONT.bold, letterSpacing: 1 },
  metricRow:  { flexDirection: 'row', gap: 10, marginBottom: SPACING.md },
  metricBox: {
    flex: 1, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  metricValue: { color: COLORS.gold, fontSize: 30, fontWeight: FONT.black },
  metricLabel: { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, fontWeight: FONT.semibold, marginTop: 4 },
  macroRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  macroBox: {
    flex: 1, backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  macroValue: { color: COLORS.white, fontSize: 18, fontWeight: FONT.black },
  macroLabel: { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, fontWeight: FONT.semibold, marginTop: 4 },
  macroPct:   { color: COLORS.textFaint, fontSize: 10, marginTop: 2 },
  mentzerNote: {
    backgroundColor: '#161410', borderRadius: RADIUS.md, padding: 14,
    borderWidth: 1, borderColor: COLORS.goldFaint, borderLeftWidth: 3, borderLeftColor: COLORS.gold,
  },
  mentzerNoteText: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic', lineHeight: 20 },

  // HD2 Protocol card
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 1, fontWeight: FONT.semibold },
  infoValue: { color: COLORS.white, fontSize: 13, fontWeight: FONT.medium },

  predictionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  predictionRow:    { flexDirection: 'row', alignItems: 'center' },
  predictionStat:   { flex: 1, alignItems: 'center' },
  predictionValue:  { color: COLORS.white, fontSize: 22, fontWeight: FONT.black },
  predictionLabel:  { color: COLORS.textDim, fontSize: 9, letterSpacing: 2, fontWeight: FONT.semibold, marginTop: 4 },
  predictionDivider:{ width: 1, height: 36, backgroundColor: COLORS.border, marginHorizontal: 16 },
  predictionWarning:{ color: COLORS.orange, fontSize: 12, lineHeight: 18, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },

  signOutButton: {
    marginHorizontal: SPACING.screen, marginTop: SPACING.lg,
    paddingVertical: 18, borderRadius: RADIUS.lg,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  signOutText: { color: COLORS.textDim, fontSize: 13, fontWeight: FONT.semibold, letterSpacing: 2 },
});
