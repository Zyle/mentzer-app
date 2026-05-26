import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { cancelRecoveryNotifications } from '../lib/notifications';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

const GOALS = [
  { key: 'bulk',     label: 'BULKING',    sub: 'Calorie surplus — build muscle' },
  { key: 'cut',      label: 'CUTTING',    sub: 'Calorie deficit — lose fat' },
  { key: 'maintain', label: 'MAINTAIN',   sub: 'Eat at maintenance' },
  { key: 'recomp',   label: 'RECOMP',     sub: 'Lose fat and build muscle simultaneously' },
];

export default function SettingsScreen({ navigation }) {
  const [goal,          setGoal]          = useState(null);
  const [units,         setUnits]         = useState('metric');
  const [notifEnabled,  setNotifEnabled]  = useState(false);
  const [userId,        setUserId]        = useState(null);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles').select('goal').eq('id', user.id).single();
      if (profile?.goal) setGoal(profile.goal);

      const savedUnits = await AsyncStorage.getItem('units');
      setUnits(savedUnits || 'metric');

      const { status } = await Notifications.getPermissionsAsync();
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      setNotifEnabled(status === 'granted' && scheduled.length > 0);
    } catch (e) {
      console.error('SettingsScreen loadSettings error:', e);
    }
  };

  const saveGoal = async (newGoal) => {
    setGoal(newGoal);
    setSaving(true);
    await supabase.from('profiles').update({ goal: newGoal }).eq('id', userId);
    setSaving(false);
  };

  const saveUnits = async (newUnits) => {
    setUnits(newUnits);
    await AsyncStorage.setItem('units', newUnits);
  };

  const toggleNotifications = async (value) => {
    if (!value) {
      await cancelRecoveryNotifications();
      setNotifEnabled(false);
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      setNotifEnabled(true);
      Alert.alert(
        'Notifications On',
        'You\'ll be notified at day 4 and day 5.5 after your next workout.'
      );
    } else {
      Alert.alert(
        'Permission Denied',
        'Enable notifications in your device Settings to receive recovery alerts.'
      );
    }
  };

  const signOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Training Goal ───────────────────────────────────── */}
        <Text style={styles.sectionLabel}>TRAINING GOAL</Text>
        <View style={styles.card}>
          {GOALS.map((g, i) => (
            <TouchableOpacity
              key={g.key}
              style={[
                styles.optionRow,
                i < GOALS.length - 1 && styles.optionBorder,
                goal === g.key && styles.optionRowActive,
              ]}
              onPress={() => saveGoal(g.key)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, goal === g.key && styles.optionLabelActive]}>
                  {g.label}
                </Text>
                <Text style={styles.optionSub}>{g.sub}</Text>
              </View>
              {goal === g.key && (
                <View style={styles.checkDot} />
              )}
            </TouchableOpacity>
          ))}
          {saving && <Text style={styles.savingText}>Saving…</Text>}
        </View>

        {/* ── Units ───────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>UNITS</Text>
        <View style={styles.card}>
          {[
            { key: 'metric',   label: 'METRIC',   sub: 'Kilograms · Centimetres' },
            { key: 'imperial', label: 'IMPERIAL',  sub: 'Pounds · Feet & Inches' },
          ].map((u, i) => (
            <TouchableOpacity
              key={u.key}
              style={[
                styles.optionRow,
                i === 0 && styles.optionBorder,
                units === u.key && styles.optionRowActive,
              ]}
              onPress={() => saveUnits(u.key)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, units === u.key && styles.optionLabelActive]}>
                  {u.label}
                </Text>
                <Text style={styles.optionSub}>{u.sub}</Text>
              </View>
              {units === u.key && <View style={styles.checkDot} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Notifications ───────────────────────────────────── */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>Recovery Alerts</Text>
              <Text style={styles.optionSub}>
                Notified at day 4 (minimum ready) and day 5.5 (peak supercompensation)
              </Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: COLORS.border, true: COLORS.goldBorder }}
              thumbColor={notifEnabled ? COLORS.gold : '#555'}
            />
          </View>
        </View>

        {/* ── Account ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.optionRow} onPress={signOut} activeOpacity={0.7}>
            <Text style={styles.signOutLabel}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: SPACING.screen, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.surface,
  },
  back:  { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.medium, letterSpacing: 1, width: 60 },
  title: { color: COLORS.white, fontSize: 14, fontWeight: FONT.black, letterSpacing: 3 },

  content:      { flex: 1, paddingHorizontal: SPACING.screen, paddingTop: SPACING.lg },
  sectionLabel: { color: '#666', fontSize: 10, fontWeight: FONT.black, letterSpacing: 2, marginBottom: 8, marginTop: 4 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg, overflow: 'hidden',
  },

  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  optionBorder:    { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionRowActive: { backgroundColor: '#0f0e00' },
  optionLabel:     { color: COLORS.white, fontSize: 13, fontWeight: FONT.semibold, marginBottom: 2 },
  optionLabelActive: { color: COLORS.gold },
  optionSub:       { color: '#666', fontSize: 11 },

  checkDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.gold, marginLeft: 12,
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },

  savingText:   { color: '#555', fontSize: 10, textAlign: 'center', paddingBottom: 8 },
  signOutLabel: { color: COLORS.red, fontSize: 13, fontWeight: FONT.semibold, letterSpacing: 1 },
});
