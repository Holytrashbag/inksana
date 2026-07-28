import { describe, expect, it } from 'vitest'

import { stepCursor } from './useCustomCursor'

describe('stepCursor', () => {
  it('eases toward the target rather than snapping', () => {
    const next = stepCursor({ x: 0, y: 0 }, 100, 0, 1 / 60)
    expect(next.x).toBeGreaterThan(0)
    expect(next.x).toBeLessThan(100)
  })

  it('converges to the target over repeated steps', () => {
    let state = { x: 0, y: 0 }
    for (let i = 0; i < 240; i++) {
      state = stepCursor(state, 100, 50, 1 / 60)
    }
    expect(state.x).toBeCloseTo(100, 1)
    expect(state.y).toBeCloseTo(50, 1)
  })

  it('clamps a stalled frame so it cannot teleport to the target', () => {
    const fromStall = stepCursor({ x: 0, y: 0 }, 1000, 0, 5)
    const fromClamped = stepCursor({ x: 0, y: 0 }, 1000, 0, 0.05)
    expect(fromStall.x).toBeCloseTo(fromClamped.x, 6)
  })

  it('is a no-op once at the target', () => {
    const next = stepCursor({ x: 50, y: 50 }, 50, 50, 1 / 60)
    expect(next).toEqual({ x: 50, y: 50 })
  })
})
