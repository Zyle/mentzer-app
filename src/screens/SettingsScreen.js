import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Switch, Alert, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Button from '../components/Button';
import ScreenHeader from '../components/ScreenHeader';
import { useUnits, kgToDisplay } from '../lib/units';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import {
  setRecoveryNotificationsEnabled,
  areRecoveryNotificationsEnabled,
  scheduleWeightCheckinReminder,
  cancelWeightCheckinReminder,
} from '../lib/notifications';
import { COLORS, FONT, TYPE, RADIUS, SPACING } from '../theme';

const GOALS = [
  { key: 'bulk',     label: 'Build muscle', sub: 'Small calorie surplus' },
  { key: 'cut',      label: 'Lose fat',     sub: 'Controlled calorie deficit' },
  { key: 'maintain', label: 'Maintain',     sub: 'Eat at maintenance' },
  { key: 'recomp',   label: 'Recomp',       sub: 'Lose fat and build muscle together' },
];

const INCREMENTS = [
  { value: 1.25, label: '1.25 kg', sub: 'Micro-loading: small, steady progress' },
  { value: 2.5,  label: '2.5 kg',  sub: 'Standard: recommended for most' },
  { value: 5,    label: '5 kg',    sub: 'Large jumps: early beginner phase' },
];

export default function SettingsScreen({ navigation }) {
  const [userId, setUserId]               = useState(null);

  // Goal
  const [goal, setGoal]                   = useState(null);
  const [savingGoal, setSavingGoal]       = useState(false);

  // Units + increment
  const { units, setUnits }               = useUnits();
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

      const savedIncrement = await AsyncStorage.getItem('weightIncrement');
      setIncrement(savedIncrement ? parseFloat(savedIncrement) : 2.5);

      const { status }  = await Notifications.getPermissionsAsync();
      const scheduled   = await Notifications.getAllScheduledNotificationsAsync();
      const recoveryOn  = await areRecoveryNotificationsEnabled();
      const hasCheckin  = scheduled.some(n => n.identifier === 'weight-checkin');
      setNotifEnabled(status === 'granted' && recoveryOn);
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
    await setUnits(newUnits);
  };

  // ── Weight increment ─────────────────────────────────────────────────────────
  const saveIncrement = async (val) => {
    setIncrement(val);
    await AsyncStorage.setItem('weightIncrement', String(val));
  };

  // ── Notifications ────────────────────────────────────────────────────────────
  const toggleNotifications = async (value) => {
    if (!value) {
      await setRecoveryNotificationsEnabled(false);
      setNotifEnabled(false);
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await setRecoveryNotificationsEnabled(true);
      setNotifEnabled(true);
      Alert.alert('Recovery alerts on', "You'll be notified at day 4 and day 5.5 after each workout.");
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
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} bordered />

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* ── TRAINING GOAL ──────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel} accessibilityRole="header">TRAINING GOAL</Text>
        <View style={styles.card} accessibilityRole="radiogroup">
          {GOALS.map((g, i) => (
            <OptionRow
              key={g.key}
              label={g.label}
              sub={g.sub}
              selected={goal === g.key}
              onPress={() => saveGoal(g.key)}
              border={i < GOALS.length - 1}
            />
          ))}
          {savingGoal && <Text style={styles.savingText} accessibilityLiveRegion="polite">Saving…</Text>}
        </View>

        {/* ── UNITS ──────────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel} accessibilityRole="header">UNITS</Text>
        <View style={styles.card} accessibilityRole="radiogroup">
          {[
            { key: 'metric',   label: 'Metric',   sub: 'Kilograms · centimetres' },
            { key: 'imperial', label: 'Imperial', sub: 'Pounds · feet & inches' },
          ].map((u, i) => (
            <OptionRow
              key={u.key}
              label={u.label}
              sub={u.sub}
              selected={units === u.key}
              onPress={() => saveUnits(u.key)}
              border={i === 0}
            />
          ))}
        </View>

        {/* ── WEIGHT INCREMENT ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel} accessibilityRole="header">WEIGHT INCREMENT</Text>
        <View style={styles.card} accessibilityRole="radiogroup">
          {INCREMENTS.map((inc, i) => (
            <OptionRow
              key={inc.value}
              label={units === 'imperial' ? `${inc.label} (≈${kgToDisplay(inc.value, true)} lb)` : inc.label}
              sub={inc.sub}
              selected={increment === inc.value}
              onPress={() => saveIncrement(inc.value)}
              border={i < INCREMENTS.length - 1}
            />
          ))}
        </View>

        {/* ── NOTIFICATIONS ────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel} accessibilityRole="header">NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>Recovery alerts</Text>
              <Text style={styles.optionSub}>Day 4 (ready) and day 5.5 (peak) after each workout</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: COLORS.border, true: COLORS.gold }}
              thumbColor={COLORS.white}
              ios_backgroundColor={COLORS.border}
              accessibilityLabel="Recovery alerts"
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>Weight check-in</Text>
              <Text style={styles.optionSub}>Reminder every two weeks to log your bodyweight</Text>
            </View>
            <Switch
              value={checkinEnabled}
              onValueChange={toggleCheckin}
              trackColor={{ false: COLORS.border, true: COLORS.gold }}
              thumbColor={COLORS.white}
              ios_backgroundColor={COLORS.border}
              accessibilityLabel="Weight check-in reminder"
            />
          </View>
        </View>

        {/* ── ACCOUNT ──────────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel} accessibilityRole="header">ACCOUNT</Text>
        <View style={styles.card}>
          <LinkRow icon="mail" label="Change email" onPress={() => setEmailModal(true)} border />
          <LinkRow icon="lock" label="Change password" onPress={() => setPasswordModal(true)} border />
          <LinkRow icon="log-out" label="Sign out" onPress={signOut} border />
          <LinkRow icon="trash-2" label="Delete account" onPress={() => setDeleteModal(true)} danger />
        </View>

      </ScrollView>

      {/* ── Change Email Modal ────────────────────────────────────────────────── */}
      <Sheet visible={emailModal} title="Change email" onClose={() => { setEmailModal(false); setNewEmail(''); }}>
        <TextInput
          style={styles.modalInput}
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="New email address"
          placeholderTextColor={COLORS.textFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
          accessibilityLabel="New email address"
        />
        <Text style={styles.modalHint}>A confirmation link will be sent to your new address.</Text>
        <View style={styles.modalButtons}>
          <Button title="Cancel" variant="secondary" size="md" style={{ flex: 1 }}
            onPress={() => { setEmailModal(false); setNewEmail(''); }} />
          <Button title="CONFIRM" size="md" style={{ flex: 1.4 }}
            onPress={changeEmail} disabled={!newEmail.trim()} loading={accountLoading} />
        </View>
      </Sheet>

      {/* ── Change Password Modal ─────────────────────────────────────────────── */}
      <Sheet visible={passwordModal} title="Change password" onClose={() => { setPasswordModal(false); setNewPassword(''); setConfirmPassword(''); }}>
        <TextInput
          style={styles.modalInput}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password (6+ characters)"
          placeholderTextColor={COLORS.textFaint}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus
          accessibilityLabel="New password"
        />
        <TextInput
          style={[styles.modalInput, { marginTop: 10 }]}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          placeholderTextColor={COLORS.textFaint}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          accessibilityLabel="Confirm new password"
        />
        <View style={styles.modalButtons}>
          <Button title="Cancel" variant="secondary" size="md" style={{ flex: 1 }}
            onPress={() => { setPasswordModal(false); setNewPassword(''); setConfirmPassword(''); }} />
          <Button title="CONFIRM" size="md" style={{ flex: 1.4 }}
            onPress={changePassword} disabled={newPassword.length < 6} loading={accountLoading} />
        </View>
      </Sheet>

      {/* ── Delete Account Modal ──────────────────────────────────────────────── */}
      <Sheet visible={deleteModal} title="Delete account" danger onClose={() => { setDeleteModal(false); setDeleteConfirm(''); }}>
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
          accessibilityLabel="Type DELETE to confirm"
        />
        <View style={styles.modalButtons}>
          <Button title="Cancel" variant="secondary" size="md" style={{ flex: 1 }}
            onPress={() => { setDeleteModal(false); setDeleteConfirm(''); }} />
          <Button title="DELETE" variant="danger" size="md" style={{ flex: 1.4 }}
            onPress={deleteAccount} disabled={deleteConfirm !== 'DELETE'} loading={accountLoading} />
        </View>
      </Sheet>
    </View>
  );
}

// ─── Presentational helpers ──────────────────────────────────────────────────
function OptionRow({ label, sub, selected, onPress, border }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, border && styles.rowBorder, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${sub}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>{label}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

function LinkRow({ icon, label, onPress, border, danger }) {
  const color = danger ? COLORS.red : COLORS.white;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, border && styles.rowBorder, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={18} color={danger ? COLORS.red : COLORS.textMuted} />
      <Text style={[styles.optionLabel, { color, flex: 1, marginBottom: 0, marginLeft: 12 }]}>{label}</Text>
      {!danger && <Feather name="chevron-right" size={18} color={COLORS.textDim} />}
    </Pressable>
  );
}

function Sheet({ visible, title, onClose, danger, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalCard, danger && { borderColor: COLORS.red + '55' }]} accessibilityViewIsModal>
          <Text style={styles.modalTitle} accessibilityRole="header">{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  content:      { flex: 1, paddingHorizontal: SPACING.screen, paddingTop: SPACING.sm },
  sectionLabel: { ...TYPE.overline, color: COLORS.textDim, marginBottom: 8, marginTop: SPACING.lg },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },

  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, minHeight: 56 },
  rowBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowPressed: { backgroundColor: COLORS.surfaceRaised },

  optionLabel:       { color: COLORS.white, fontSize: 15, fontWeight: FONT.semibold, marginBottom: 2 },
  optionLabelActive: { color: COLORS.goldBright },
  optionSub:         { ...TYPE.caption, color: COLORS.textMuted },

  radio:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderStrong,
              alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  radioOn:  { borderColor: COLORS.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },

  savingText: { ...TYPE.caption, color: COLORS.textDim, textAlign: 'center', paddingBottom: 10 },

  // Modals
  overlay: {
    flex: 1, backgroundColor: COLORS.overlay,
    justifyContent: 'center', alignItems: 'center', padding: SPACING.screen,
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, width: '100%', maxWidth: 440,
  },
  modalTitle: { ...TYPE.title, color: COLORS.white, marginBottom: 16 },
  modalInput: {
    backgroundColor: COLORS.surfaceDark, color: COLORS.white,
    fontSize: 16, paddingHorizontal: 14, minHeight: 50, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalHint:    { ...TYPE.caption, color: COLORS.textMuted, marginTop: 8 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: SPACING.lg },

  deleteWarning: { ...TYPE.body, color: COLORS.textSecondary, marginBottom: 16 },
  deletePrompt:  { ...TYPE.caption, color: COLORS.textMuted, marginBottom: 8 },
});
