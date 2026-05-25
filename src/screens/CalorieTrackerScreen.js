import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';

const toDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const calcTarget = p => {
  if (!p?.bodyweight_kg || !p?.height_cm || !p?.age) return 2400;
  const bmr = 10*p.bodyweight_kg + 6.25*p.height_cm - 5*p.age + (p.sex === 'male' ? 5 : -161);
  return Math.round(bmr * 1.375) + (p.calorie_adjustment || 0);
};

export default function CalorieTrackerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [entries,  setEntries]  = useState([]);
  const [target,   setTarget]   = useState(2400);
  const [name,     setName]     = useState('');
  const [cals,     setCals]     = useState('');
  const [userId,   setUserId]   = useState(null);
  const today = toDateStr();

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user.id);
      const [profRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('calorie_logs').select('*').eq('user_id', user.id).eq('date', today),
      ]);
      if (profRes.data) setTarget(calcTarget(profRes.data));
      const sorted = (logsRes.data || []).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      setEntries(sorted);
    } catch (e) { console.error('CalorieTracker:', e); }
  };

  const addEntry = async () => {
    const kcal = parseInt(cals);
    if (!name.trim() || !kcal || isNaN(kcal) || kcal <= 0) return;
    const { data, error } = await supabase
      .from('calorie_logs')
      .insert({ user_id: userId, date: today, entry_name: name.trim(), calories: kcal })
      .select().single();
    if (!error && data) {
      setEntries(prev => [data, ...prev]);
      setName('');
      setCals('');
    }
  };

  const deleteEntry = async (id) => {
    await supabase.from('calorie_logs').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const consumed  = entries.reduce((s, e) => s + e.calories, 0);
  const remaining = target - consumed;
  const over      = remaining < 0;
  const pct       = Math.min(consumed / target, 1);

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: 44 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>CALORIES</Text>
      </View>

      {/* Summary */}
      <Card style={s.summaryCard}>
        <Text style={s.remainLabel}>{over ? 'OVER TARGET BY' : 'REMAINING TODAY'}</Text>
        <Text style={[s.remainNum, over && { color: COLORS.red }]}>
          {Math.abs(remaining).toLocaleString()}
          <Text style={s.kcalUnit}> kcal</Text>
        </Text>
        <View style={s.track}>
          <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: over ? COLORS.red : COLORS.gold }]} />
        </View>
        <View style={s.statsRow}>
          <Text style={s.stat}>{consumed.toLocaleString()} consumed</Text>
          <Text style={s.stat}>{target.toLocaleString()} target</Text>
        </View>
      </Card>

      {/* Add entry */}
      <Card style={s.addCard}>
        <View style={s.addRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Food or meal..."
            placeholderTextColor={COLORS.textDim}
            value={name}
            onChangeText={setName}
            returnKeyType="next"
          />
          <TextInput
            style={[s.input, s.calInput]}
            placeholder="kcal"
            placeholderTextColor={COLORS.textDim}
            value={cals}
            onChangeText={setCals}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={addEntry}
          />
          <TouchableOpacity style={s.addBtn} onPress={addEntry}>
            <Text style={s.addBtnText}>ADD</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Entries list */}
      <FlatList
        data={entries}
        keyExtractor={i => i.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={s.empty}>No entries yet. Log your first meal above.</Text>
        }
        renderItem={({ item }) => (
          <View style={s.entry}>
            <Text style={s.entryName} numberOfLines={1}>{item.entry_name}</Text>
            <Text style={s.entryCal}>{item.calories.toLocaleString()} kcal</Text>
            <TouchableOpacity
              onPress={() => deleteEntry(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.del}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.lg },
  backBtn:      { marginBottom: 12 },
  backText:     { color: COLORS.textDim, fontSize: 11, letterSpacing: 2 },
  headerTitle:  { fontSize: 34, fontWeight: FONT.black, color: COLORS.white, letterSpacing: 6 },

  summaryCard:  { marginHorizontal: SPACING.screen, marginBottom: 8 },
  remainLabel:  { color: COLORS.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  remainNum:    { color: COLORS.white, fontSize: 42, fontWeight: FONT.black, letterSpacing: -1, marginBottom: 10 },
  kcalUnit:     { fontSize: 14, fontWeight: FONT.medium, letterSpacing: 0 },
  track:        { height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginBottom: 8 },
  fill:         { height: 4, borderRadius: 2 },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  stat:         { color: COLORS.textDim, fontSize: 10, letterSpacing: 1 },

  addCard:      { marginHorizontal: SPACING.screen, marginBottom: 8 },
  addRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.white, fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  calInput:     { width: 72, textAlign: 'center' },
  addBtn:       { backgroundColor: COLORS.gold, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText:   { color: '#000', fontSize: 11, fontWeight: FONT.black, letterSpacing: 1.5 },

  list:         { paddingHorizontal: SPACING.screen, paddingBottom: 40 },
  entry: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  entryName:    { flex: 1, color: COLORS.white, fontSize: 14 },
  entryCal:     { color: COLORS.gold, fontSize: 13, fontWeight: FONT.semibold, marginRight: 14 },
  del:          { color: COLORS.textDim, fontSize: 12 },
  empty:        { color: COLORS.textDim, fontSize: 13, textAlign: 'center', marginTop: 40 },
});
