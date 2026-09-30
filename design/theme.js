// SUVAT — design tokens.
//
// WHERE THIS CAME FROM
//   Structure   : novawashx.com's theme.js — the opacity ladder, the 4px spacing
//                 base, the radii, the fixed component heights, the pill CTAs and
//                 the one-accent-at-four-depths rule. Adopted wholesale.
//   Colour      : NOT from Nova. Nova is a single-accent system, which a physics
//                 diagram cannot be — displacement, velocity and acceleration are
//                 three different quantities and need three hues. The trio below
//                 was searched and validated, not picked by eye (see VALIDATION).
//   Contrast    : every pair below was computed, not assumed. The light-mode
//                 placeholder failed at Nova's opacity and was corrected — see
//                 the INK LADDER note.
//
// THE ONE RULE THAT MATTERS
//   Colour means physics. Never chrome.
//   If something on screen is orange, teal or violet, it is a measured quantity.
//   Buttons, tabs and controls are ink and surface only. This is stricter than
//   Nova (where cyan was both brand and UI) and it exists because this site puts
//   a chart and a control side by side on nearly every screen — an orange button
//   beside an orange velocity line stops reading as a button.

/* ═══════════════════════════════════════════════════════════════════════════
   PHYSICS HUES — the only three colours that carry meaning
   ═══════════════════════════════════════════════════════════════════════════

   VALIDATION (dark, all-pairs, Machado–Oliveira–Fernandes 2009 @ severity 1.0):
     worst CVD pair   teal ↔ orange   ΔE 13.8 (protan)   floor 8    PASS
     worst normal     violet ↔ teal   ΔE 27.0            floor 15   PASS
     lightness band   all three inside OKLCH L 0.48–0.67            PASS
     chroma floor     all three ≥ 0.10                              PASS
     contrast         all three ≥ 4.4:1 on surface                  PASS

   Re-run before changing ANY of these six values:
     node scripts/validate_palette.js "<hexes>" --mode dark --surface "#131210" --pairs all

   WHY ONLY THREE. Every four-hue set tested collapsed under colour-blind
   simulation — orange and rose merged, violet and sky merged. So horizontal vs
   vertical is encoded as DASHED vs SOLID within one hue, never as a fourth
   colour. That constraint is load-bearing, not a stylistic preference. */

export const physics = {
  dark: {
    velocity:     '#ea580c',   // orange-600 — the quantity that moves; the star of every screen
    displacement: '#0d9488',   // teal-600
    acceleration: '#8b5cf6',   // violet-500 — constant here, so it reads as the calm one
  },
  light: {
    velocity:     '#c2410c',   // orange-700 — deepened; the dark steps lose contrast on paper
    displacement: '#0f766e',   // teal-700
    acceleration: '#7c3aed',   // violet-600
  },
  // Horizontal and vertical components share their quantity's hue and are told
  // apart by stroke only. Same dash array everywhere, so it becomes a language.
  stroke: {
    resultant:  { width: 2.6, dash: null },      // the vector itself
    component:  { width: 1.6, dash: [4, 3] },    // resolved horizontal / vertical
    projected:  { width: 1.6, dash: [2, 3] },    // ghosted paths, ground tracks
    future:     { width: 1.5, dash: [3, 4] },    // the path not yet flown
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SURFACES & INK
   ═══════════════════════════════════════════════════════════════════════════

   INK LADDER — and why light ≠ dark.
   Dark text fading on a light surface loses contrast faster than light text
   fading on a dark one, so the two ladders are NOT mirror images. Measured:

     dark   white/60 on #131210  →  7.17:1     light  ink/60 on #faf9f7 → 4.60:1
     dark   white/40 on #1c1a17  →  3.83:1     light  ink/40 on #ffffff → 2.55:1  ✗

   Nova's 100/80/60/40 ladder is correct on dark and FAILS on light — its
   placeholder step lands at 2.4:1. The light ladder is therefore 100/75/62/50. */

export const colors = {
  dark: {
    surface:     '#131210',              // warm near-black. Warm, not neutral, so the orange sits in it rather than on it
    card:        '#1c1a17',              // one step up; the only elevation this system has
    inputFill:   'rgba(255,255,255,0.05)',
    border:      'rgba(255,255,255,0.20)',
    borderSoft:  'rgba(255,255,255,0.10)',

    ink:         '#ffffff',              // 18.72:1
    inkStrong:   'rgba(255,255,255,0.80)',
    inkMuted:    'rgba(255,255,255,0.60)', // 7.17:1
    inkFaint:    'rgba(255,255,255,0.40)', // 3.83:1 — placeholders and axis numbers only

    accent:      '#ea580c',              // UI accent = the velocity hue. See ACCENT COLLISION below
    accentHi:    '#f97316',
    accentSoftText: '#fdba74',           // 11.10:1
    onAccent:    '#131210',              // 5.26:1 — dark text on orange, never white
    accentFill:  'rgba(234,88,12,0.20)',
    accentFillWeak: 'rgba(234,88,12,0.12)',
    accentFillFaint:'rgba(234,88,12,0.06)',

    grid:        'rgba(255,255,255,0.07)', // chart gridlines; must recede completely
    axis:        'rgba(255,255,255,0.22)',
  },

  light: {
    surface:     '#faf9f7',              // warm paper, not white — white makes the three hues shout
    card:        '#ffffff',
    cardShadow:  '0 1px 2px rgba(26,23,20,0.045)',  // cards get a shadow INSTEAD of a border
    inputFill:   'rgba(26,23,20,0.035)',
    border:      'rgba(26,23,20,0.14)',
    borderSoft:  'rgba(26,23,20,0.07)',

    ink:         '#1a1714',              // 16.96:1 — warm black to match the paper
    inkStrong:   'rgba(26,23,20,0.75)',  // 7.72:1
    inkMuted:    'rgba(26,23,20,0.62)',  // 4.82:1 — raised from Nova's 0.60 to clear AA
    inkFaint:    'rgba(26,23,20,0.50)',  // 3.36:1 — raised from 0.40, which failed at 2.4:1

    accent:      '#c2410c',
    accentHi:    '#9a3412',
    accentSoftText: '#c2410c',
    onAccent:    '#ffffff',              // 5.18:1 — inverts vs dark mode
    accentFill:  'rgba(194,65,12,0.10)',
    accentFillWeak: 'rgba(194,65,12,0.07)',
    accentFillFaint:'rgba(194,65,12,0.04)',

    grid:        'rgba(26,23,20,0.06)',
    axis:        'rgba(26,23,20,0.28)',
  },
};

/* Status is a RESERVED role. Never reused for a series, never for chrome, and
   always shipped with a word beside it — never colour alone. Inherited from
   Nova unchanged, because status shouldn't move just because the brand did. */
export const status = {
  dark:  { good: '#34d399', goodFill: 'rgba(52,211,153,0.15)',
           warn: '#facc15', warnFill: 'rgba(250,204,21,0.12)',
           bad:  '#fb7185', badFill:  'rgba(251,113,133,0.15)' },
  light: { good: '#047857', goodFill: 'rgba(52,211,153,0.20)',
           warn: '#a16207', warnFill: 'rgba(250,204,21,0.20)',
           bad:  '#be123c', badFill:  'rgba(251,113,133,0.20)' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPE
   ═══════════════════════════════════════════════════════════════════════════
   ONE family, not three. The previous attempt set equations and readouts in a
   monospace at 10–11px and it was the single worst thing about it. Instrument
   Sans has tabular figures, so a number changing under a slider still does not
   shift the row — which is the only thing the monospace was buying.

   HARD FLOOR: 13px. Nothing on this site is smaller, INCLUDING labels drawn
   onto a canvas. Canvas text ignores CSS, so this has to be enforced by hand
   in the renderer — it is the rule most likely to be broken by accident. */

export const type = {
  family: "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  numeric: 'tabular-nums',

  size: {
    xs:   13,   // the floor — captions, axis numbers, canvas labels
    sm:   15,
    base: 17,   // body. One step up from Nova's 16: this is read on a desk, not held at arm's length
    lg:   20,   // card titles
    xl:   24,
    '2xl': 30,  // screen headings
    '3xl': 38,
    hero:  56,  // the live readouts — these are the point of the screen, so they are huge
  },
  lineHeight: { xs: 18, sm: 21, base: 26, lg: 28, xl: 32, '2xl': 38, '3xl': 44, hero: 58 },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  tracking: { tight: '-0.02em', normal: '0', wide: '0.09em' },  // wide = small-caps labels only
};

/* ═══════════════════════════════════════════════════════════════════════════
   SPACE, SHAPE, GEOMETRY — inherited from Nova unchanged
   ═══════════════════════════════════════════════════════════════════════════ */

export const spacing = { unit: 4, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 48, '5xl': 64 };

export const radii = { sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16, sheet: 24, full: 9999 };

export const geometry = {
  inputHeight: 44,
  inputRadius: 6,
  ctaHeight: 52,
  ctaRadius: 9999,      // pill
  tabBarHeight: 64,
  cardRadius: 16,
  screenPaddingX: 20,
  contentMax: 1080,

  // Sliders are the primary control on this site and must be thumb-sized.
  sliderTrack: 3,
  sliderThumb: 26,      // large enough to drag on a phone without a fingertip covering the value
  sliderHitArea: 44,
};

/* ═══════════════════════════════════════════════════════════════════════════
   RULES — the things that go wrong if nobody writes them down
   ═══════════════════════════════════════════════════════════════════════════

   1. COLOUR MEANS PHYSICS. Controls and chrome are ink and surface only.

   2. ACCENT COLLISION. The UI accent is currently the same orange as velocity.
      That is only safe because of rule 1 — no solid accent button is ever placed
      beside a chart. If that becomes inconvenient, change the UI accent to ink
      (a white/black filled button); do NOT introduce a fourth hue.

   3. NEVER COLOUR ALONE. Every coloured series carries a label or a legend.
      Every status chip carries a word.

   4. ONE IDEA PER SCREEN. The previous build put the animation, three graphs,
      eleven toggles and a readout row on one page. That is what "too much
      information" meant. Controls default to hidden.

   5. LINES RECEDE OR DISAPPEAR. Gridlines at 6–7% opacity. Cards on light get a
      shadow, not a border. No hairline boxes around things that are already
      separated by space.

   6. 13px FLOOR, canvas included.

   7. LIGHT IS NOT AN INVERSION. The accent deepens, the button text flips, the
      ink ladder changes. Re-measure; never auto-flip. */

export const theme = { physics, colors, status, type, spacing, radii, geometry };
export default theme;
