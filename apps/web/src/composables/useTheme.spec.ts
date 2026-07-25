import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useTheme } from './useTheme'

// The composable is a module singleton; each test drives it back to a known
// state through the public API rather than reaching into module internals.
describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    useTheme().setTheme('light')
    localStorage.clear()
  })

  it('reflects the active theme onto the document element', () => {
    const { setTheme } = useTheme()

    setTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')

    setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('toggle flips the theme and updates isDark', () => {
    const { toggle, isDark, setTheme } = useTheme()
    setTheme('light')
    expect(isDark.value).toBe(false)

    toggle()
    expect(isDark.value).toBe(true)

    toggle()
    expect(isDark.value).toBe(false)
  })

  it('persists an explicit choice to localStorage', () => {
    useTheme().setTheme('dark')
    expect(localStorage.getItem('inksana-theme')).toBe('dark')
  })

  it('shares one reactive state across callers', () => {
    const a = useTheme()
    const b = useTheme()
    a.setTheme('dark')
    expect(b.isDark.value).toBe(true)
  })
})
