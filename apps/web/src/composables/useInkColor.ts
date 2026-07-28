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
