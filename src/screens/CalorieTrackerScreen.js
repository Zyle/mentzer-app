import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import Button from '../components/Button';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, FONT, TYPE, RADIUS, SPACING, HIT } from '../theme';

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
  const [adding,   setAdding]   = useState(false);
  const [error,    setError]    = useState('');
  const calsRef = useRef(null);
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
        (b.created_at || '').localeCompare(a.created_at || '')
      );
      setEntries(sorted);
    } catch (e) { console.error('CalorieTracker:', e); }
  };

  const addEntry = async () => {
    const kcal = parseInt(cals);
    if (!name.trim()) { setError('Add a name for this food or meal.'); return; }
    if (!kcal || isNaN(kcal) || kcal <= 0) { setError('Enter the calories as a whole number.'); return; }
    setError('');
    setAdding(true);
    const { data, error: insertError } = await supabase
      .from('calorie_logs')
      .insert({ user_id: userId, date: today, entry_name: name.trim(), calories: kcal })
      .select().single();
    setAdding(false);
    if (!insertError && data) {
      setEntries(prev => [data, ...prev]);
      setName('');
      setCals('');
    } else {
      setError('Could not save that entry. Check your connection and try again.');
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

  const header = (
    <>
      {/* Summary */}
      <Card style={s.summaryCard}>
        <View
          accessible
          accessibilityLabel={`${Math.abs(remaining)} calories ${over ? 'over target' : 'remaining today'}. ${consumed} of ${target} eaten.`}
        >
          <Text style={s.remainLabel}>{over ? 'OVER TARGET BY' : 'REMAINING TODAY'}</Text>
          <Text style={[s.remainNum, over && { color: COLORS.red }]}>
            {Math.abs(remaining).toLocaleString()}
            <Text style={s.kcalUnit}> kcal</Text>
          </Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: over ? COLORS.red : COLORS.teal }]} />
          </View>
          <View style={s.statsRow}>
            <Text style={s.stat}>{consumed.toLocaleString()} eaten</Text>
            <Text style={s.stat}>{target.toLocaleString()} target</Text>
          </View>
        </View>
      </Card>

      {/* Add entry */}
      <Card style={s.addCard}>
        <Text style={s.addTitle} accessibilityRole="header">Add food</Text>
        <View style={s.addRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Food or meal"
            placeholderTextColor={COLORS.textFaint}
            value={name}
            onChangeText={t => { setName(t); setError(''); }}
            returnKeyType="next"
            onSubmitEditing={() => calsRef.current?.focus()}
            accessibilityLabel="Food or meal name"
          />
          <TextInput
            ref={calsRef}
            style={[s.input, s.calInput]}
            placeholder="kcal"
            placeholderTextColor={COLORS.textFaint}
            value={cals}
            onChangeText={t => { setCals(t); setError(''); }}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={addEntry}
            accessibilityLabel="Calories"
          />
        </View>
        {error ? (
          <Text style={s.error} accessibilityLiveRegion="polite" accessibilityRole="alert">{error}</Text>
        ) : null}
        <Button title="ADD" icon="plus" size="md" onPress={addEntry} loading={adding} style={{ marginTop: SPACING.md }} />
      </Card>

      {entries.length > 0 && <Text style={s.listTitle} accessibilityRole="header">TODAY</Text>}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Calories" subtitle="TODAY'S LOG" onBack={() => navigation.goBack()} />

      <FlatList
        data={entries}
        keyExtractor={i => String(i.id)}
        ListHeaderComponent={header}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Feather name="coffee" size={22} color={COLORS.textDim} />
            <Text style={s.empty}>Nothing logged yet today.{'\n'}Rough estimates are fine. Consistency matters more than precision.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.entry}>
            <Text style={s.entryName} numberOfLines={1}>{item.entry_name}</Text>
            <Text style={s.entryCal}>{item.calories.toLocaleString()} kcal</Text>
            <Pressable
              onPress={() => deleteEntry(item.id)}
              style={({ pressed }) => [s.delBtn, pressed && { backgroundColor: COLORS.redFaint }]}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.entry_name}, ${item.calories} calories`}
            >
              <Feather name="trash-2" size={16} color={COLORS.textMuted} />
            </Pressable>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  list:         { paddingHorizontal: SPACING.screen },

  summaryCard:  { marginBottom: 12 },
  remainLabel:  { ...TYPE.overline, color: COLORS.textDim, marginBottom: 6 },
  remainNum:    { color: COLORS.white, fontSize: 44, fontWeight: FONT.black, letterSpacing: -1, marginBottom: 12, fontVariant: ['tabular-nums'] },
  kcalUnit:     { fontSize: 16, fontWeight: FONT.medium, letterSpacing: 0, color: COLORS.textMuted },
  track:        { height: 8, backgroundColor: COLORS.border, borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
  fill:         { height: 8, borderRadius: 4 },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  stat:         { color: COLORS.textMuted, fontSize: 13 },

  addCard:      { marginBottom: 8 },
  addTitle:     { ...TYPE.heading, color: COLORS.white, marginBottom: 12 },
  addRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: COLORS.surfaceDark, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.white, fontSize: 16,
    paddingHorizontal: 14, minHeight: HIT,
  },
  calInput:     { width: 92, textAlign: 'center' },
  error:        { ...TYPE.callout, color: COLORS.red, marginTop: 10 },

  listTitle:    { ...TYPE.overline, color: COLORS.textDim, marginTop: SPACING.lg, marginBottom: 4 },
  entry: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  entryName:    { flex: 1, color: COLORS.white, fontSize: 15 },
  entryCal:     { color: COLORS.gold, fontSize: 14, fontWeight: FONT.semibold, marginRight: 4, fontVariant: ['tabular-nums'] },
  delBtn:       { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:    { alignItems: 'center', gap: 10, marginTop: 36, paddingHorizontal: SPACING.lg },
  empty:        { ...TYPE.callout, color: COLORS.textMuted, textAlign: 'center' },
});
