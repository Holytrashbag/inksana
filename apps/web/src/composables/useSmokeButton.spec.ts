import { describe, expect, it } from 'vitest'

import { stepHover } from './useSmokeButton'

describe('stepHover', () => {
  it('eases toward the target rather than snapping', () => {
    const next = stepHover(0, 1, 1 / 60)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(1)
  })

  it('converges to the target over repeated steps', () => {
    let value = 0
    for (let i = 0; i < 240; i++) {
      value = stepHover(value, 1, 1 / 60)
    }
    expect(value).toBeCloseTo(1, 5)
  })

  it('eases back down when the target drops to 0', () => {
    let value = 1
    for (let i = 0; i < 240; i++) {
      value = stepHover(value, 0, 1 / 60)
    }
    expect(value).toBeCloseTo(0, 5)
  })

  it('clamps a stalled frame so it cannot jump-cut to the target', () => {
    const fromStall = stepHover(0, 1, 5)
    const fromClamped = stepHover(0, 1, 0.05)
    expect(fromStall).toBeCloseTo(fromClamped, 6)
  })

  it('is a no-op once at the target', () => {
    expect(stepHover(1, 1, 1 / 60)).toBe(1)
  })
})
