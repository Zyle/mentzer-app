import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { COLORS, FONT, RADIUS, SPACING } from '../theme';
import { Feather } from '@expo/vector-icons';

const PROGRAMMES = [
  {
    id: 'ideal',
    name: 'IDEAL ROUTINE',
    badge: "MENTZER'S FLAGSHIP",
    badgeColor: COLORS.gold,
    badgeBg: '#1a1200',
    borderColor: COLORS.gold,
    bg: '#0f0e00',
    tagline: 'Four dedicated workouts. Maximum precision.',
    description:
      'Four rotating sessions — Chest & Back, Legs, Delts & Arms, then Legs again with static holds. Each muscle group gets its own dedicated workout, every 4-7 days. This is the programme Mentzer put on tape and personally coached hundreds of people through.',
    forWho: 'Most people. If you have any training experience and are serious about results, start here.',
    benefits: [
      'Every muscle trained with full dedicated focus',
      'Zero overlap between sessions',
      'Rest extends naturally as you get stronger',
      'Leads directly into Consolidation when you plateau',
    ],
    frequency: 'Every 4–7 days',
    sessions: '4 rotating workouts',
  },
  {
    id: 'two_way',
    name: 'HD TWO-WAY SPLIT',
    badge: 'BEGINNER ENTRY POINT',
    badgeColor: '#60A5FA',
    badgeBg: '#0a0d1a',
    borderColor: '#60A5FA44',
    bg: '#0a0c12',
    tagline: 'Upper and lower. Simple and brutal.',
    description:
      'Two alternating workouts — Upper Body and Lower Body. 4-5 days rest between each session. Fewer exercises than the Ideal Routine, easier to learn, but every set still taken to absolute failure. The gateway into Heavy Duty training.',
    forWho: 'Complete beginners to resistance training, or anyone new to the HD method who wants to build the habit first.',
    benefits: [
      'Simpler structure to build consistency',
      'Still 100% faithful to HD intensity principles',
      'Natural progression path into the Ideal Routine',
      'Shorter sessions',
    ],
    frequency: 'Every 4–5 days',
    sessions: '2 alternating workouts',
  },
  {
    id: 'consolidation',
    name: 'CONSOLIDATION',
    badge: 'ADVANCED',
    badgeColor: '#A78BFA',
    badgeBg: '#0d0a1a',
    borderColor: '#A78BFA44',
    bg: '#0c0a14',
    tagline: 'Four movements. Absolute failure. Nothing else.',
    description:
      'Squat, Deadlift, Dips, Chin-ups. One set each to absolute failure. Once every 7-14 days. Every major muscle group covered in a single session with zero overlap. Mentzer developed this for lifters who had been training Heavy Duty for months and stopped progressing — stripping everything back to the absolute minimum stimulus required for growth.',
    forWho: 'Experienced lifters who have stalled on the Ideal Routine. Not recommended as a starting point.',
    benefits: [
      'Maximum recovery between sessions',
      'Eliminates every source of overtraining',
      'Mentzer\'s most powerful and famous programme',
      'The logical endpoint of the HD philosophy',
    ],
    frequency: 'Every 7–14 days',
    sessions: '4 exercises, 1 session',
  },
];

export default function ProgrammeSelectionScreen({ onSelect }) {
  const [selected, setSelected]   = useState(null);
  const [expanded, setExpanded]   = useState(null);

  const chosen = PROGRAMMES.find(p => p.id === selected);

  const toggleExpand = (id) => setExpanded(p => p === id ? null : id);

  return (
    <View style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.eyebrow}>MIKE MENTZER</Text>
        <Text style={s.title}>CHOOSE YOUR{'\n'}PROGRAMME.</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {PROGRAMMES.map(prog => {
          const isSelected = selected === prog.id;
          const isExpanded = expanded === prog.id;

          return (
            <View key={prog.id} style={[
              s.card,
              { backgroundColor: isSelected ? prog.bg : COLORS.surface },
              { borderColor: isSelected ? prog.borderColor : COLORS.border },
            ]}>

              {/* Selectable top area */}
              <TouchableOpacity onPress={() => setSelected(p => p === prog.id ? null : prog.id)} activeOpacity={0.8}>
                <View style={s.cardTop}>
                  <View style={[s.badge, { backgroundColor: prog.badgeBg, borderColor: prog.badgeColor + '44' }]}>
                    <Text style={[s.badgeText, { color: prog.badgeColor }]}>{prog.badge}</Text>
                  </View>
                  {isSelected && (
                    <View style={[s.checkCircle, { backgroundColor: prog.badgeColor }]}>
                      <Text style={s.checkMark}>✓</Text>
                    </View>
                  )}
                </View>

                <Text style={[s.progName, isSelected && { color: prog.badgeColor }]}>
                  {prog.name}
                </Text>
                <Text style={s.tagline}>{prog.tagline}</Text>

                {/* Meta pills */}
                <View style={s.metaRow}>
                  <View style={s.metaPill}>
                    <Text style={s.metaLabel}>FREQUENCY</Text>
                    <Text style={[s.metaValue, { color: prog.badgeColor }]}>{prog.frequency}</Text>
                  </View>
                  <View style={s.metaDivider} />
                  <View style={s.metaPill}>
                    <Text style={s.metaLabel}>STRUCTURE</Text>
                    <Text style={[s.metaValue, { color: prog.badgeColor }]}>{prog.sessions}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Learn more toggle */}
              <TouchableOpacity style={s.learnMore} onPress={() => toggleExpand(prog.id)} activeOpacity={0.7}>
                <Text style={s.learnMoreText}>{isExpanded ? 'SHOW LESS' : 'LEARN MORE'}</Text>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color="#555" />
              </TouchableOpacity>

              {/* Expanded content */}
              {isExpanded && (
                <View style={s.expandedContent}>
                  <View style={s.divider} />

                  <Text style={s.desc}>{prog.description}</Text>

                  <View style={s.forWhoRow}>
                    <Text style={s.forWhoLabel}>WHO IT'S FOR</Text>
                    <Text style={s.forWhoText}>{prog.forWho}</Text>
                  </View>

                  <View style={s.benefits}>
                    {prog.benefits.map((b, i) => (
                      <View key={i} style={s.benefitRow}>
                        <View style={[s.benefitDot, { backgroundColor: prog.badgeColor }]} />
                        <Text style={s.benefitText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btn, !selected && s.btnDisabled]}
          onPress={() => selected && onSelect(selected)}
          activeOpacity={selected ? 0.85 : 1}
        >
          <Text style={[s.btnText, !selected && s.btnTextDisabled]}>
            {chosen ? `START ${chosen.name} →` : 'SELECT A PROGRAMME'}
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.screen,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  eyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: FONT.black, letterSpacing: 4, marginBottom: 8 },
  title:   { fontSize: 36, fontWeight: FONT.black, color: COLORS.white, letterSpacing: -1, lineHeight: 40 },

  content: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.md },

  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge:       { borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeText:   { fontSize: 8, fontWeight: FONT.black, letterSpacing: 1.5 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  checkMark:   { color: '#000', fontSize: 11, fontWeight: FONT.black },

  progName: { fontSize: 20, fontWeight: FONT.black, color: COLORS.white, letterSpacing: 0.5, marginBottom: 3 },
  tagline:  { color: COLORS.textDim, fontSize: 10, fontWeight: FONT.bold, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' },

  metaRow:     { flexDirection: 'row', backgroundColor: '#00000033', borderRadius: RADIUS.md, padding: 10 },
  metaPill:    { flex: 1, alignItems: 'center' },
  metaLabel:   { color: COLORS.textFaint, fontSize: 8, fontWeight: FONT.black, letterSpacing: 2, marginBottom: 3 },
  metaValue:   { fontSize: 10, fontWeight: FONT.black, letterSpacing: 1 },
  metaDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },

  learnMore:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1e1e1e', alignSelf: 'flex-start' },
  learnMoreText: { color: '#555', fontSize: 9, fontWeight: FONT.black, letterSpacing: 2 },

  expandedContent: { marginTop: 10 },
  divider:         { height: 1, backgroundColor: '#1e1e1e', marginBottom: 12 },

  desc: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 12 },

  forWhoRow:   { flexDirection: 'column', marginBottom: 12, backgroundColor: '#00000033', borderRadius: RADIUS.md, padding: 10, gap: 4 },
  forWhoLabel: { color: COLORS.textDim, fontSize: 8, fontWeight: FONT.black, letterSpacing: 2 },
  forWhoText:  { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },

  benefits:    { gap: 7 },
  benefitRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  benefitDot:  { width: 4, height: 4, borderRadius: 2, marginTop: 7, flexShrink: 0 },
  benefitText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },

  footer: {
    padding: SPACING.xl,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  btn:             { backgroundColor: COLORS.gold, paddingVertical: 18, borderRadius: RADIUS.md, alignItems: 'center' },
  btnDisabled:     { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a' },
  btnText:         { color: '#000', fontSize: 14, fontWeight: FONT.black, letterSpacing: 2 },
  btnTextDisabled: { color: '#444' },
});
