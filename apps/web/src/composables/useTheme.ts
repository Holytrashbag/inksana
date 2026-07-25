import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

export type Theme = 'light' | 'dark'

export type UseThemeReturn = {
  /** Current theme. */
  theme: Ref<Theme>
  /** True while the dark theme is active. */
  isDark: ComputedRef<boolean>
  /** Flip between light and dark and remember the choice. */
  toggle: () => void
  /** Set an explicit theme and remember the choice. */
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'inksana-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function canMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

function systemPrefersDark(): boolean {
  return canMatchMedia() && window.matchMedia(DARK_QUERY).matches
}

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null // storage blocked (private mode / SSR) — fall back to the system
  }
}

function apply(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  // hint form controls & scrollbars so native UI matches the page
  document.documentElement.style.colorScheme = theme
}

// Module-level singleton: every caller shares one reactive theme, so the toggle,
// the page chrome, and the WebGL palettes all move together.
const stored = readStored()
const theme = ref<Theme>(stored ?? (systemPrefersDark() ? 'dark' : 'light'))
// once the user picks a theme we stop following the OS
const explicit = ref(stored !== null)
const isDark = computed(() => theme.value === 'dark')

apply(theme.value) // run at import time to minimise first-paint flash
// sync flush so the class lands before paint (and before assertions in tests)
watch(theme, apply, { flush: 'sync' })

// track the OS preference until the user makes an explicit choice
if (canMatchMedia()) {
  window.matchMedia(DARK_QUERY).addEventListener('change', (event) => {
    if (!explicit.value) theme.value = event.matches ? 'dark' : 'light'
  })
}

function setTheme(next: Theme): void {
  explicit.value = true
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore — the choice still applies for this session
  }
  theme.value = next
}

function toggle(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

/**
 * Shared light/dark theme state. Reads the persisted choice (or the OS
 * preference), reflects it onto `<html class="dark">`, and exposes a toggle.
 * The state is a module singleton, so components and GL renderers stay in sync.
 */
export function useTheme(): UseThemeReturn {
  return { theme, isDark, toggle, setTheme }
}
