import { describe, expect, it } from 'vitest'

import { stepFish, type FishState } from './useCursorFish'

const at = (x: number, y: number, angle = 0): FishState => ({ x, y, angle, phase: 0 })

describe('stepFish', () => {
  it('eases toward the target without overshooting', () => {
    const next = stepFish(at(0, 0), 100, 0, 0.1)
    expect(next.x).toBeGreaterThan(0)
    expect(next.x).toBeLessThan(100)
    expect(next.y).toBeCloseTo(0)
  })

  it('holds position when dt is zero', () => {
    const start = at(10, 20, 0.5)
    const next = stepFish(start, 500, 500, 0)
    expect(next.x).toBeCloseTo(10)
    expect(next.y).toBeCloseTo(20)
  })

  it('converges on the target over many frames', () => {
    let state = at(0, 0)
    for (let i = 0; i < 240; i++) state = stepFish(state, 100, 50, 1 / 60)
    expect(state.x).toBeCloseTo(100, 0)
    expect(state.y).toBeCloseTo(50, 0)
  })

  it('turns to face the direction of travel', () => {
    // moving straight down (screen y grows downward) → heading near +90°
    let state = at(0, 0)
    for (let i = 0; i < 5; i++) state = stepFish(state, 0, 200, 1 / 60)
    expect(state.angle).toBeGreaterThan(0)
    expect(state.angle).toBeLessThanOrEqual(Math.PI / 2 + 1e-6)
  })

  it('advances the swim phase, faster when travelling further', () => {
    const resting = stepFish(at(0, 0), 0, 0, 1 / 60)
    const swimming = stepFish(at(0, 0), 400, 0, 1 / 60)
    expect(resting.phase).toBeGreaterThan(0)
    expect(swimming.phase).toBeGreaterThan(resting.phase)
  })
})
