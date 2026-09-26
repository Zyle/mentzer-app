// Central design tokens — import from here, never hardcode values in screens.
//
// Contrast notes (on `background` #0a0a0a):
//   white 19.8:1 · textSecondary 11:1 · textMuted 8:1 · textDim 6:1 (all pass WCAG AA)
//   textFaint 3.9:1 — decorative / large text only, never body copy.

export const COLORS = {
  // Surfaces
  background:    '#0a0a0a',
  surface:       '#161618',
  surfaceDark:   '#111113',   // inputs, inset wells
  surfaceRaised: '#1f1f23',   // pressed / elevated
  border:        '#2a2a2e',
  borderStrong:  '#3a3a40',
  overlay:       'rgba(0,0,0,0.78)',

  // Brand
  gold:        '#c9a84c',
  goldBright:  '#e2c26a',
  goldFaint:   '#c9a84c1f',
  goldBorder:  '#c9a84c55',
  onGold:      '#0a0a0a',     // text/icons placed on a gold fill

  // Text
  white:         '#ffffff',
  textSecondary: '#c7c7cc',
  textMuted:     '#a1a1a6',
  textDim:       '#8e8e93',
  textFaint:     '#6e6e73',

  // Status
  green:      '#4cc47a',
  greenFaint: '#4cc47a26',
  red:        '#ef6b6b',
  redFaint:   '#ef6b6b1f',
  orange:     '#e89a45',
  blue:       '#6aa8ff',
  violet:     '#a78bfa',
  teal:       '#34d399',
  amber:      '#c9a84c',
};

// Recovery phase colours — shared by Home, notifications copy and history
export const PHASE_COLORS = {
  recovering: COLORS.red,
  repairing:  COLORS.orange,
  rebuilding: COLORS.gold,
  growing:    '#9cc46a',
  almost:     COLORS.green,
  ready:      COLORS.green,
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
  display:  { fontSize: 32, fontWeight: FONT.black, letterSpacing: -0.5, lineHeight: 38 },
  title:    { fontSize: 22, fontWeight: FONT.bold,  letterSpacing: -0.2, lineHeight: 28 },
  heading:  { fontSize: 17, fontWeight: FONT.bold,  lineHeight: 22 },
  body:     { fontSize: 15, fontWeight: FONT.regular, lineHeight: 22 },
  callout:  { fontSize: 13, fontWeight: FONT.regular, lineHeight: 19 },
  caption:  { fontSize: 12, fontWeight: FONT.medium, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: FONT.semibold, letterSpacing: 1.6 },
  numeric:  { fontWeight: FONT.black, fontVariant: ['tabular-nums'] },
};

export const RADIUS = {
  sm:   6,
  md:   10,
  lg:   12,
  xl:   16,
  pill: 999,
};

export const SPACING = {
  xs:     4,
  sm:     8,
  md:     14,
  lg:     20,
  xl:     24,
  xxl:    32,
  screen: 20,
};

// Minimum touch target (Apple HIG 44pt / Material 48dp)
export const HIT = 48;
