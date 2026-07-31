import { describe, expect, it } from 'vitest'

import { computeBlotRect } from './useInkRipple'

describe('computeBlotRect', () => {
  it('sizes the circle to reach the furthest corner from a centered click', () => {
    const { size } = computeBlotRect(50, 50, 100, 100)
    expect(size).toBeCloseTo(Math.hypot(50, 50) * 2, 5)
  })

  it('grows when the click lands near a corner instead of the center', () => {
    const centered = computeBlotRect(50, 50, 100, 100)
    const cornered = computeBlotRect(5, 5, 100, 100)
    expect(cornered.size).toBeGreaterThan(centered.size)
  })

  it('centers the circle on the click point', () => {
    const { left, top, size } = computeBlotRect(20, 30, 100, 100)
    expect(left + size / 2).toBeCloseTo(20, 5)
    expect(top + size / 2).toBeCloseTo(30, 5)
  })
})
