import { ref, type Ref } from 'vue'

/**
 * Named swatches, mirroring the `--color-accent-*` tokens in `main.css`.
 * Kept as literal hex here (rather than read from the CSS custom property)
 * because the value also feeds the WebGL uniform, which sits outside the CSS
 * cascade — if the tokens change, update both places.
 *
 * "grey" and "ink" are deliberately excluded: they aren't stored choices, they
 * are the two faces of the theme-adaptive neutral slot (see {@link resolveInkHex}).
 */
export type InkAccentName = 'blood' | 'purple' | 'blue' | 'green'

export type InkAccent = {
  name: InkAccentName
  label: string
  hex: string
}

export const INK_ACCENTS: readonly InkAccent[] = [
  { name: 'blood', label: 'Blood', hex: '#5c1a15' }, // --color-accent-blood (--color-blood)
  { name: 'purple', label: 'Purple', hex: '#9561cd' }, // --color-accent-purple
  { name: 'blue', label: 'Blue', hex: '#4255b3' }, // --color-accent-blue
  { name: 'green', label: 'Green', hex: '#1ecd73' }, // --color-accent-green
]

// The default (no explicit choice) slot: grey on dark, ink on light, chosen
// for contrast against the theme's own surface color. Never persisted — it's
// recomputed from the live theme so it can't go stale if the user switches
// theme while it's active.
const NEUTRAL_HEX = {
  grey: '#ded7c9', // --color-accent-grey (--color-ink-200) — dark-mode default
  ink: '#0d0c0b', // --color-accent-ink (--color-ink-950) — light-mode default
} as const

const ACCENT_NAMES = new Set(INK_ACCENTS.map((a) => a.name))
// Object.fromEntries can't type its result from a list of known keys — the keys
// are exactly INK_ACCENTS' names, so every InkAccentName is covered.
const ACCENT_HEX = Object.fromEntries(INK_ACCENTS.map((a) => [a.name, a.hex])) as Record<
  InkAccentName,
  string
>

export type UseInkColorReturn = {
  /** User-chosen accent swatch, or null to use the theme-adaptive neutral. */
  accent: Ref<InkAccentName | null>
  /** Select an accent swatch as the line color and remember the choice. */
  setAccent: (name: InkAccentName) => void
  /** Clear the override and fall back to the theme-adaptive neutral. */
  reset: () => void
}

const STORAGE_KEY = 'inksana-ink-accent'

function isAccentName(value: string): value is InkAccentName {
  return ACCENT_NAMES.has(value as InkAccentName)
}

function readStored(): InkAccentName | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value && isAccentName(value) ? value : null
  } catch {
    return null // storage blocked (private mode / SSR) — fall back to the neutral
  }
}

/** Normalize a `#rrggbb` string to 0..1 RGB, as consumed by the water shader uniforms. */
export function hexToRgb01(hex: string): readonly [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function rgbToHsl([r, g, b]: readonly [number, number, number]): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
}

/**
 * Boost a 0..1 RGB color's saturation multiplicatively (an HSL round-trip).
 * The accent swatches are tuned as a subtle background line color, so GL
 * effects that want it as a vivid, emitting hue (e.g. SmokeButton's plasma)
 * boost it here rather than changing the shared swatch values. Leaves fully
 * desaturated grays untouched; clamps fully-saturated colors at their
 * ceiling rather than distorting hue.
 */
export function saturateRgb(
  rgb: readonly [number, number, number],
  factor: number,
): [number, number, number] {
  const [h, s, l] = rgbToHsl(rgb)
  return hslToRgb(h, Math.min(1, s * factor), l)
}

/**
 * The complementary color (opposite hue, same saturation/lightness). Used
 * where an effect needs to stand out *against* the ink accent rather than
 * echo it — e.g. SmokeButton's plasma is deliberately the complement of the
 * water background's line color, so the two never collapse into the same
 * hue. A fully desaturated gray has no hue to flip, so it passes through
 * unchanged.
 */
export function complementRgb(rgb: readonly [number, number, number]): [number, number, number] {
  const [h, s, l] = rgbToHsl(rgb)
  return hslToRgb((h + 0.5) % 1, s, l)
}

/** Look up a stored accent's hex by name. */
export function hexOfAccent(name: InkAccentName): string {
  return ACCENT_HEX[name]
}

/** The theme-adaptive neutral's hex: grey on dark, ink on light. */
export function neutralHex(isDark: boolean): string {
  return isDark ? NEUTRAL_HEX.grey : NEUTRAL_HEX.ink
}

/** The line color hex for the current selection: the accent if set, else the theme's neutral. */
export function resolveInkHex(name: InkAccentName | null, isDark: boolean): string {
  return name ? hexOfAccent(name) : neutralHex(isDark)
}

// Module-level singleton, same pattern as useTheme: every caller (the picker and
// the water renderer) shares one reactive override.
const accent = ref<InkAccentName | null>(readStored())

function setAccent(name: InkAccentName): void {
  accent.value = name
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // ignore — the choice still applies for this session
  }
}

function reset(): void {
  accent.value = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Shared override for the water background's line color, picked from a fixed
 * set of accent swatches (plus the theme-adaptive neutral default). Persists
 * the choice the same way {@link useTheme} persists the theme.
 */
export function useInkColor(): UseInkColorReturn {
  return { accent, setAccent, reset }
}
