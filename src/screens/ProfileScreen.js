import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [bodyweight, setBodyweight] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
      setBodyweight(data.bodyweight_kg?.toString() || '');
      setName(data.name || '');
    } else {
      // Create profile if doesn't exist
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
      });
    }
  };

  const saveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('profiles').upsert({
      id: user.id,
      name,
      bodyweight_kg: parseFloat(bodyweight) || null,
    });
    setEditing(false);
    loadProfile();
  };

  const signOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', onPress: () => supabase.auth.signOut() },
    ]);
  };

  // Calculate BMR using Mentzer's formula
  const calculateBMR = () => {
    if (!profile?.bodyweight_kg) return null;
    const bw = profile.bodyweight_kg * 2.205; // kg to lbs
    return Math.round(bw * 10 + bw * 2); // Mentzer's male formula
  };

  const bmr = calculateBMR();
  const maintenanceCalories = bmr;
  const muscleGainCalories = bmr ? bmr + 16 : null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <Text style={styles.headerSubtitle}>YOUR METRICS</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.card}>
        {editing ? (
          <>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#444"
            />
            <Text style={styles.label}>BODYWEIGHT (KG)</Text>
            <TextInput
              style={styles.input}
              value={bodyweight}
              onChangeText={setBodyweight}
              keyboardType="decimal-pad"
              placeholder="80"
              placeholderTextColor="#444"
            />
            <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
              <Text style={styles.saveButtonText}>SAVE</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.profileRow}>
              <Text style={styles.profileName}>{profile?.name || 'Athlete'}</Text>
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={styles.editButton}>EDIT</Text>
              </TouchableOpacity>
            </View>
            {profile?.bodyweight_kg && (
              <Text style={styles.profileWeight}>{profile.bodyweight_kg}kg</Text>
            )}
          </>
        )}
      </View>

      {/* Nutrition Targets */}
      {bmr && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MENTZER NUTRITION TARGETS</Text>
          <Text style={styles.cardSubtitle}>Based on his scientific formula</Text>

          <View style={styles.nutritionRow}>
            <View style={styles.nutritionBox}>
              <Text style={styles.nutritionValue}>{maintenanceCalories}</Text>
              <Text style={styles.nutritionLabel}>MAINTENANCE{'\n'}CALORIES</Text>
            </View>
            <View style={styles.nutritionBox}>
              <Text style={styles.nutritionValue}>{muscleGainCalories}</Text>
              <Text style={styles.nutritionLabel}>MUSCLE GAIN{'\n'}CALORIES</Text>
            </View>
          </View>

          <View style={styles.macroRow}>
            <View style={styles.macroBox}>
              <Text style={styles.macroValue}>60%</Text>
              <Text style={styles.macroLabel}>CARBS</Text>
            </View>
            <View style={styles.macroBox}>
              <Text style={styles.macroValue}>25%</Text>
              <Text style={styles.macroLabel}>PROTEIN</Text>
            </View>
            <View style={styles.macroBox}>
              <Text style={styles.macroValue}>15%</Text>
              <Text style={styles.macroLabel}>FAT</Text>
            </View>
          </View>

          <Text style={styles.nutritionNote}>
            Mentzer: "You only need 16 extra calories per day above maintenance to build 10lbs of muscle in a year. More is stored as fat."
          </Text>

          {profile?.bodyweight_kg && (
            <Text style={styles.proteinTarget}>
              Protein target: {Math.round(profile.bodyweight_kg * 0.8)}g/day ({profile.bodyweight_kg}kg × 0.8g/kg)
            </Text>
          )}
        </View>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 6 },
  headerSubtitle: { fontSize: 10, color: '#c9a84c', letterSpacing: 3, marginTop: 2 },
  card: {
    margin: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  cardSubtitle: { color: '#666', fontSize: 12, marginBottom: 20 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileName: { color: '#fff', fontSize: 24, fontWeight: '700' },
  profileWeight: { color: '#c9a84c', fontSize: 16, marginTop: 8 },
  editButton: { color: '#c9a84c', fontSize: 12, letterSpacing: 1 },
  label: { color: '#666', fontSize: 10, letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 4,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  saveButton: {
    backgroundColor: '#c9a84c',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#000', fontWeight: '800', letterSpacing: 2 },
  nutritionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  nutritionBox: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  nutritionValue: { color: '#c9a84c', fontSize: 28, fontWeight: '900' },
  nutritionLabel: { color: '#666', fontSize: 9, letterSpacing: 1, textAlign: 'center', marginTop: 4 },
  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  macroBox: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  macroValue: { color: '#fff', fontSize: 20, fontWeight: '900' },
  macroLabel: { color: '#666', fontSize: 9, letterSpacing: 2, marginTop: 2 },
  nutritionNote: { color: '#666', fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  proteinTarget: { color: '#c9a84c', fontSize: 13, marginTop: 12 },
  signOutButton: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  signOutText: { color: '#666', fontSize: 12, letterSpacing: 2 },
});
