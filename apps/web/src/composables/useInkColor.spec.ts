import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  complementRgb,
  hexOfAccent,
  hexToRgb01,
  neutralHex,
  resolveInkHex,
  saturateRgb,
  useInkColor,
} from './useInkColor'

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

describe('saturateRgb', () => {
  it('leaves a fully desaturated gray unchanged', () => {
    expect(saturateRgb([0.5, 0.5, 0.5], 1.7)).toEqual([0.5, 0.5, 0.5])
  })

  it('widens the spread between channels of a color', () => {
    const rgb = hexToRgb01(hexOfAccent('purple'))
    const [r, g, b] = saturateRgb(rgb, 1.7)
    const before = Math.max(...rgb) - Math.min(...rgb)
    const after = Math.max(r, g, b) - Math.min(r, g, b)
    expect(after).toBeGreaterThan(before)
  })

  it('clamps saturation at full rather than distorting the hue', () => {
    const [r, g, b] = saturateRgb([0.1, 0.9, 0.1], 100)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(g).toBeLessThanOrEqual(1)
    expect(b).toBeGreaterThanOrEqual(0)
    // still reads as green: green channel stays the clear maximum
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
  })
})

describe('complementRgb', () => {
  it('flips a primary hue to its opposite', () => {
    // pure red (h=0) complements to cyan (h=0.5)
    const [r, g, b] = complementRgb([1, 0, 0])
    expect(r).toBeCloseTo(0, 5)
    expect(g).toBeCloseTo(1, 5)
    expect(b).toBeCloseTo(1, 5)
  })

  it('leaves a fully desaturated gray unchanged', () => {
    expect(complementRgb([0.5, 0.5, 0.5])).toEqual([0.5, 0.5, 0.5])
  })

  it('is its own inverse', () => {
    const rgb = hexToRgb01(hexOfAccent('purple'))
    const [r, g, b] = complementRgb(complementRgb(rgb))
    expect(r).toBeCloseTo(rgb[0], 5)
    expect(g).toBeCloseTo(rgb[1], 5)
    expect(b).toBeCloseTo(rgb[2], 5)
  })

  it('preserves saturation and lightness, only rotating hue', () => {
    const rgb = hexToRgb01(hexOfAccent('blue'))
    const [r, g, b] = complementRgb(rgb)
    const lBefore = (Math.max(...rgb) + Math.min(...rgb)) / 2
    const lAfter = (Math.max(r, g, b) + Math.min(r, g, b)) / 2
    expect(lAfter).toBeCloseTo(lBefore, 5)
  })
})
