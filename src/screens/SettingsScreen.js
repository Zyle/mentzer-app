import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, TextInput, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import {
  cancelRecoveryNotifications,
  scheduleWeightCheckinReminder,
  cancelWeightCheckinReminder,
} from '../lib/notifications';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

const GOALS = [
  { key: 'bulk',     label: 'BULKING',   sub: 'Calorie surplus — build muscle' },
  { key: 'cut',      label: 'CUTTING',   sub: 'Calorie deficit — lose fat' },
  { key: 'maintain', label: 'MAINTAIN',  sub: 'Eat at maintenance' },
  { key: 'recomp',   label: 'RECOMP',    sub: 'Lose fat and build muscle simultaneously' },
];

const INCREMENTS = [
  { value: 1.25, label: '1.25 kg', sub: 'Micro-loading — small, steady progress' },
  { value: 2.5,  label: '2.5 kg',  sub: 'Standard — recommended for most' },
  { value: 5,    label: '5 kg',    sub: 'Aggressive — for early beginner phase' },
];

export default function SettingsScreen({ navigation }) {
  const [userId, setUserId]               = useState(null);

  // Goal
  const [goal, setGoal]                   = useState(null);
  const [savingGoal, setSavingGoal]       = useState(false);

  // Units + increment
  const [units, setUnits]                 = useState('metric');
  const [increment, setIncrement]         = useState(2.5);

  // Notifications
  const [notifEnabled, setNotifEnabled]   = useState(false);
  const [checkinEnabled, setCheckinEnabled] = useState(false);

  // Account modals
  const [emailModal, setEmailModal]       = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [deleteModal, setDeleteModal]     = useState(false);
  const [newEmail, setNewEmail]           = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('goal')
        .eq('id', user.id).single();

      if (profile?.goal) setGoal(profile.goal);

      const savedUnits     = await AsyncStorage.getItem('units');
      const savedIncrement = await AsyncStorage.getItem('weightIncrement');
      setUnits(savedUnits || 'metric');
      setIncrement(savedIncrement ? parseFloat(savedIncrement) : 2.5);

      const { status }  = await Notifications.getPermissionsAsync();
      const scheduled   = await Notifications.getAllScheduledNotificationsAsync();
      const hasRecovery = scheduled.some(n => n.identifier === 'recovery-day4' || n.identifier === 'recovery-peak');
      const hasCheckin  = scheduled.some(n => n.identifier === 'weight-checkin');
      setNotifEnabled(status === 'granted' && hasRecovery);
      setCheckinEnabled(status === 'granted' && hasCheckin);
    } catch (e) {
      console.error('loadSettings error:', e);
    }
  };

  // ── Goal ─────────────────────────────────────────────────────────────────────
  const saveGoal = async (newGoal) => {
    setGoal(newGoal);
    setSavingGoal(true);
    await supabase.from('profiles').update({ goal: newGoal }).eq('id', userId);
    setSavingGoal(false);
  };

  // ── Units ────────────────────────────────────────────────────────────────────
  const saveUnits = async (newUnits) => {
    setUnits(newUnits);
    await AsyncStorage.setItem('units', newUnits);
  };

  // ── Weight increment ─────────────────────────────────────────────────────────
  const saveIncrement = async (val) => {
    setIncrement(val);
    await AsyncStorage.setItem('weightIncrement', String(val));
  };

  // ── Notifications ────────────────────────────────────────────────────────────
  const toggleNotifications = async (value) => {
    if (!value) {
      await cancelRecoveryNotifications();
      setNotifEnabled(false);
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      setNotifEnabled(true);
      Alert.alert('Recovery Alerts On', "You'll be notified at day 4 and day 5.5 after each workout.");
    } else {
      Alert.alert('Permission Denied', 'Enable notifications in your device Settings.');
    }
  };

  const toggleCheckin = async (value) => {
    if (!value) {
      await cancelWeightCheckinReminder();
      setCheckinEnabled(false);
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await scheduleWeightCheckinReminder();
      setCheckinEnabled(true);
      Alert.alert('Check-in Reminder On', "You'll be reminded to log your weight every 14 days.");
    } else {
      Alert.alert('Permission Denied', 'Enable notifications in your device Settings.');
    }
  };

  // ── Account ──────────────────────────────────────────────────────────────────
  const changeEmail = async () => {
    if (!newEmail.trim()) { Alert.alert('Error', 'Enter a new email address.'); return; }
    setAccountLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setAccountLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Check your inbox', 'A confirmation link has been sent to your new email.');
      setEmailModal(false);
      setNewEmail('');
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match.'); return; }
    setAccountLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAccountLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Done', 'Password updated successfully.');
      setPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') { Alert.alert('Error', 'Type DELETE to confirm.'); return; }
    setAccountLoading(true);
    try {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.signOut();
    } catch (e) {
      console.error('deleteAccount error:', e);
      setAccountLoading(false);
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

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* ── TRAINING GOAL ──────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>TRAINING GOAL</Text>
        <View style={styles.card}>
          {GOALS.map((g, i) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.optionRow, i < GOALS.length - 1 && styles.rowBorder, goal === g.key && styles.optionRowActive]}
              onPress={() => saveGoal(g.key)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, goal === g.key && styles.optionLabelActive]}>{g.label}</Text>
                <Text style={styles.optionSub}>{g.sub}</Text>
              </View>
              {goal === g.key && <View style={styles.checkDot} />}
            </TouchableOpacity>
          ))}
          {savingGoal && <Text style={styles.savingText}>Saving…</Text>}
        </View>

        {/* ── UNITS ──────────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>UNITS</Text>
        <View style={styles.card}>
          {[
            { key: 'metric',   label: 'METRIC',   sub: 'Kilograms · Centimetres' },
            { key: 'imperial', label: 'IMPERIAL',  sub: 'Pounds · Feet & Inches' },
          ].map((u, i) => (
            <TouchableOpacity
              key={u.key}
              style={[styles.optionRow, i === 0 && styles.rowBorder, units === u.key && styles.optionRowActive]}
              onPress={() => saveUnits(u.key)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, units === u.key && styles.optionLabelActive]}>{u.label}</Text>
                <Text style={styles.optionSub}>{u.sub}</Text>
              </View>
              {units === u.key && <View style={styles.checkDot} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── WEIGHT INCREMENT ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>WEIGHT INCREMENT</Text>
        <View style={styles.card}>
          {INCREMENTS.map((inc, i) => (
            <TouchableOpacity
              key={inc.value}
              style={[styles.optionRow, i < INCREMENTS.length - 1 && styles.rowBorder, increment === inc.value && styles.optionRowActive]}
              onPress={() => saveIncrement(inc.value)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, increment === inc.value && styles.optionLabelActive]}>{inc.label}</Text>
                <Text style={styles.optionSub}>{inc.sub}</Text>
              </View>
              {increment === inc.value && <View style={styles.checkDot} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── NOTIFICATIONS ────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={[styles.toggleRow, styles.rowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>Recovery Alerts</Text>
              <Text style={styles.optionSub}>Day 4 (ready) and day 5.5 (peak) after each workout</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: COLORS.border, true: COLORS.goldBorder }}
              thumbColor={notifEnabled ? COLORS.gold : '#555'}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>Weight Check-in</Text>
              <Text style={styles.optionSub}>Bi-weekly reminder to log your bodyweight</Text>
            </View>
            <Switch
              value={checkinEnabled}
              onValueChange={toggleCheckin}
              trackColor={{ false: COLORS.border, true: COLORS.goldBorder }}
              thumbColor={checkinEnabled ? COLORS.gold : '#555'}
            />
          </View>
        </View>

        {/* ── ACCOUNT ──────────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={[styles.optionRow, styles.rowBorder]} onPress={() => setEmailModal(true)} activeOpacity={0.7}>
            <Text style={styles.optionLabel}>Change Email</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.optionRow, styles.rowBorder]} onPress={() => setPasswordModal(true)} activeOpacity={0.7}>
            <Text style={styles.optionLabel}>Change Password</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.optionRow, styles.rowBorder]} onPress={signOut} activeOpacity={0.7}>
            <Text style={styles.signOutLabel}>SIGN OUT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow} onPress={() => setDeleteModal(true)} activeOpacity={0.7}>
            <Text style={styles.deleteLabel}>DELETE ACCOUNT</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Change Email Modal ────────────────────────────────────────────────── */}
      <Modal visible={emailModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>CHANGE EMAIL</Text>
            <TextInput
              style={styles.modalInput}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="New email address"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <Text style={styles.modalHint}>A confirmation link will be sent to your new address.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setEmailModal(false); setNewEmail(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (!newEmail.trim() || accountLoading) && { opacity: 0.4 }]}
                onPress={changeEmail}
                disabled={!newEmail.trim() || accountLoading}
              >
                <Text style={styles.modalConfirmText}>{accountLoading ? 'SAVING…' : 'CONFIRM'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Change Password Modal ─────────────────────────────────────────────── */}
      <Modal visible={passwordModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>CHANGE PASSWORD</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor={COLORS.textFaint}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { marginTop: 10 }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={COLORS.textFaint}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setPasswordModal(false); setNewPassword(''); setConfirmPassword(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (newPassword.length < 6 || accountLoading) && { opacity: 0.4 }]}
                onPress={changePassword}
                disabled={newPassword.length < 6 || accountLoading}
              >
                <Text style={styles.modalConfirmText}>{accountLoading ? 'SAVING…' : 'CONFIRM'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Account Modal ──────────────────────────────────────────────── */}
      <Modal visible={deleteModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>DELETE ACCOUNT</Text>
            <Text style={styles.deleteWarning}>
              This permanently deletes all your workouts, sets, personal bests, and progress. This cannot be undone.
            </Text>
            <Text style={styles.deletePrompt}>Type DELETE to confirm</Text>
            <TextInput
              style={[styles.modalInput, deleteConfirm === 'DELETE' && { borderColor: COLORS.red }]}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="DELETE"
              placeholderTextColor={COLORS.textFaint}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setDeleteModal(false); setDeleteConfirm(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, (deleteConfirm !== 'DELETE' || accountLoading) && { opacity: 0.4 }]}
                onPress={deleteAccount}
                disabled={deleteConfirm !== 'DELETE' || accountLoading}
              >
                <Text style={styles.deleteConfirmText}>{accountLoading ? 'DELETING…' : 'DELETE'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },

  // Option rows
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  optionRowActive:   { backgroundColor: '#0f0e00' },
  optionLabel:       { color: COLORS.white, fontSize: 13, fontWeight: FONT.semibold, marginBottom: 2 },
  optionLabelActive: { color: COLORS.gold },
  optionSub:         { color: '#666', fontSize: 11 },
  checkDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold, marginLeft: 12 },
  chevron:           { color: COLORS.textMuted, fontSize: 20 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },

  savingText:   { color: '#555', fontSize: 10, textAlign: 'center', paddingBottom: 8 },
  signOutLabel: { color: COLORS.red, fontSize: 13, fontWeight: FONT.semibold, letterSpacing: 1 },
  deleteLabel:  { color: COLORS.red, fontSize: 13, fontWeight: FONT.semibold, letterSpacing: 1, opacity: 0.7 },

  // Modals
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.screen,
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, width: '100%',
  },
  modalTitle:   { color: COLORS.white, fontSize: 15, fontWeight: FONT.black, letterSpacing: 2, marginBottom: 16 },
  modalInput: {
    backgroundColor: COLORS.surfaceDark, color: COLORS.white,
    fontSize: 15, padding: 14, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  modalHint:    { color: COLORS.textDim, fontSize: 11, marginBottom: 16, lineHeight: 16 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel:  { flex: 1, paddingVertical: 13, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  modalCancelText: { color: COLORS.textMuted, fontSize: 13, fontWeight: FONT.medium },
  modalConfirm: { flex: 1.5, backgroundColor: COLORS.gold, paddingVertical: 13, borderRadius: RADIUS.lg, alignItems: 'center' },
  modalConfirmText: { color: '#000', fontSize: 13, fontWeight: FONT.black, letterSpacing: 1 },

  deleteWarning: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  deletePrompt:  { color: COLORS.textDim, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  deleteConfirmBtn: { flex: 1.5, backgroundColor: COLORS.red, paddingVertical: 13, borderRadius: RADIUS.lg, alignItems: 'center' },
  deleteConfirmText: { color: COLORS.white, fontSize: 13, fontWeight: FONT.black, letterSpacing: 1 },
});
