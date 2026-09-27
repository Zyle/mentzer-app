// Central design tokens — import from here, never hardcode values in screens.
//
// Look: pure black, soft charcoal cards, one bold gym-gold accent.
// Contrast notes (on `background` #000):
//   white 21:1 · gold 12.5:1 · textSecondary 12:1 · textMuted 8.4:1 · textDim 6.3:1 (all pass WCAG AA)
//   textFaint 4.1:1 — decorative / large text only, never body copy.

export const COLORS = {
  // Surfaces
  background:    '#000000',
  surface:       '#161617',   // cards
  surfaceDark:   '#0d0d0e',   // inputs, inset wells inside cards
  surfaceRaised: '#232326',   // pressed / elevated / chips
  border:        '#232326',
  borderStrong:  '#34343a',
  overlay:       'rgba(0,0,0,0.8)',

  // Brand — gym gold
  gold:        '#ffc21a',
  goldBright:  '#ffd65c',
  goldDeep:    '#e09a00',
  goldFaint:   '#ffc21a1f',
  goldBorder:  '#ffc21a59',
  goldGlow:    '#ffc21a40',
  onGold:      '#000000',     // text/icons placed on a gold fill

  // Text
  white:         '#ffffff',
  textSecondary: '#d1d1d6',
  textMuted:     '#a1a1a6',
  textDim:       '#8e8e93',
  textFaint:     '#6e6e73',

  // Status
  green:      '#4ade80',
  greenFaint: '#4ade8024',
  red:        '#ff6b5e',
  redFaint:   '#ff6b5e1f',
  orange:     '#ff9f1a',
  blue:       '#6aa8ff',
  violet:     '#b79bff',
  teal:       '#34d399',
  amber:      '#ffc21a',
  cream:      '#ffe7a3',
};

// Warm ring / chart palette, all in the gold family
export const RING_COLORS = [COLORS.gold, COLORS.orange, COLORS.cream];

// Gold gradient stops (for expo-linear-gradient / svg)
export const GRADIENTS = {
  gold:     [COLORS.goldBright, COLORS.gold, COLORS.goldDeep],
  heroGlow: ['#2a2000', '#120e00', '#000000'],
  card:     ['#1c1c1e', '#141415'],
};

// Recovery phase colours — shared by Home, notifications copy and history
export const PHASE_COLORS = {
  recovering: COLORS.red,
  repairing:  COLORS.orange,
  rebuilding: COLORS.goldDeep,
  growing:    COLORS.goldBright,
  almost:     COLORS.gold,
  ready:      COLORS.gold,
  overdue:    COLORS.textMuted,
};

export const FONT = {
  black:    '900',
  bold:     '800',
  semibold: '700',
  medium:   '600',
  regular:  '400',
};

// Type scale — sizes never go below 11 for legibility
export const TYPE = {
  display:  { fontSize: 32, fontWeight: FONT.black, letterSpacing: -0.8, lineHeight: 38 },
  title:    { fontSize: 22, fontWeight: FONT.bold,  letterSpacing: -0.3, lineHeight: 28 },
  heading:  { fontSize: 17, fontWeight: FONT.bold,  letterSpacing: -0.2, lineHeight: 22 },
  section:  { fontSize: 18, fontWeight: FONT.bold,  letterSpacing: -0.2 },
  body:     { fontSize: 15, fontWeight: FONT.regular, lineHeight: 22 },
  callout:  { fontSize: 13, fontWeight: FONT.regular, lineHeight: 19 },
  caption:  { fontSize: 12, fontWeight: FONT.medium, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: FONT.semibold, letterSpacing: 1.4 },
  numeric:  { fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
};

export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
  pill: 999,
};

export const SPACING = {
  xs:     4,
  sm:     8,
  md:     14,
  lg:     20,
  xl:     24,
  xxl:    32,
  screen: 18,
};

// Minimum touch target (Apple HIG 44pt / Material 48dp)
export const HIT = 48;

// Motion — one easing language across the app
export const MOTION = {
  fast:   160,
  base:   320,
  slow:   700,
  spring: { damping: 14, stiffness: 180, mass: 0.8 },
  stagger: 70,
};
