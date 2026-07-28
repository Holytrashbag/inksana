import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { hexOfAccent, hexToRgb01, neutralHex, resolveInkHex, useInkColor } from './useInkColor'

// Module singleton, same rationale as useTheme.spec.ts: drive it through the
// public API and reset it between tests rather than reaching into internals.
describe('useInkColor', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    useInkColor().reset()
    localStorage.clear()
  })

  it('starts with no override', () => {
    expect(useInkColor().accent.value).toBeNull()
  })

  it('setAccent applies and persists the choice', () => {
    useInkColor().setAccent('purple')
    expect(useInkColor().accent.value).toBe('purple')
    expect(localStorage.getItem('inksana-ink-accent')).toBe('purple')
  })

  it('reset clears the override', () => {
    useInkColor().setAccent('purple')
    useInkColor().reset()
    expect(useInkColor().accent.value).toBeNull()
    expect(localStorage.getItem('inksana-ink-accent')).toBeNull()
  })

  it('shares one reactive state across callers', () => {
    const a = useInkColor()
    const b = useInkColor()
    a.setAccent('blue')
    expect(b.accent.value).toBe('blue')
  })
})

describe('hexOfAccent', () => {
  it('looks up the hex for a known accent name', () => {
    expect(hexOfAccent('blood')).toBe('#5c1a15')
    expect(hexOfAccent('green')).toBe('#1ecd73')
  })
})

describe('neutralHex', () => {
  it('is grey on dark and ink on light', () => {
    expect(neutralHex(true)).toBe('#ded7c9')
    expect(neutralHex(false)).toBe('#0d0c0b')
  })
})

describe('resolveInkHex', () => {
  it('falls back to the theme-adaptive neutral when no accent is set', () => {
    expect(resolveInkHex(null, true)).toBe(neutralHex(true))
    expect(resolveInkHex(null, false)).toBe(neutralHex(false))
  })

  it('uses the explicit accent regardless of theme', () => {
    expect(resolveInkHex('blood', true)).toBe(hexOfAccent('blood'))
    expect(resolveInkHex('blood', false)).toBe(hexOfAccent('blood'))
  })
})

describe('hexToRgb01', () => {
  it('converts a hex string to normalized 0..1 RGB', () => {
    expect(hexToRgb01('#ffffff')).toEqual([1, 1, 1])
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0])
    expect(hexToRgb01('#1a1714')).toEqual([26 / 255, 23 / 255, 20 / 255])
  })
})
