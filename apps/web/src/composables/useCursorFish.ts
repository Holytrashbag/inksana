import { onMounted, onUnmounted, type Ref } from 'vue'

// A little ink koi that trails the cursor and stands in for the hidden OS
// pointer on the water page. The maths (easing toward the pointer, turning to
// face its heading, and a swim wag that quickens with speed) is a pure step
// function so it can be unit-tested; the composable only wires it to rAF and
// writes the element transform.

/** Position ease rate — higher snaps to the pointer faster (a touch of lag reads as swimming). */
const FOLLOW = 6
/** Heading ease rate — how quickly the fish turns to face where it's going. */
const TURN = 12
/** Below this per-step travel (px) the heading is held, so a resting fish keeps its facing. */
const MOVE_EPS = 0.08
/** Idle tail-wag rate (rad/s) and the extra wag added per pixel travelled. */
const SWIM_BASE = 6
const SWIM_SPEED_K = 0.14

export type FishState = {
  /** Screen-space position of the fish centre (px). */
  x: number
  y: number
  /** Heading in radians (0 = facing +x / right). */
  angle: number
  /** Accumulated swim phase driving the tail wag. */
  phase: number
}

/**
 * Advance the fish one frame toward the pointer at (tx, ty) over dt seconds.
 * Pure and side-effect free: returns the next {@link FishState}.
 */
export function stepFish(state: FishState, tx: number, ty: number, dt: number): FishState {
  const step = dt > 0.05 ? 0.05 : dt // clamp so a stalled tab can't teleport the fish
  const posEase = 1 - Math.exp(-step * FOLLOW)
  const nx = state.x + (tx - state.x) * posEase
  const ny = state.y + (ty - state.y) * posEase

  const dx = nx - state.x
  const dy = ny - state.y
  const dist = Math.hypot(dx, dy)

  let angle = state.angle
  if (dist > MOVE_EPS) {
    const target = Math.atan2(dy, dx)
    // shortest signed turn toward the heading, eased
    const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle))
    angle += delta * (1 - Math.exp(-step * TURN))
  }

  const phase = state.phase + step * SWIM_BASE + dist * SWIM_SPEED_K
  return { x: nx, y: ny, angle, phase }
}

export type UseCursorFishOptions = {
  /** Rendered width/height of the fish (px), used to centre it on the pointer. */
  width: number
  height: number
}

/** Peak sway added to the heading by the tail wag (deg), and idle vertical bob (px). */
const SWAY_DEG = 5
const BOB_PX = 1.5

/**
 * Drive a fish element so it swims after the cursor. Owns its pointer listeners
 * and rAF loop; hides until the first pointer move and on pointer-out, and
 * respects reduced-motion by snapping instead of animating.
 */
export function useCursorFish(el: Ref<SVGSVGElement | null>, options: UseCursorFishOptions): void {
  const halfW = options.width / 2
  const halfH = options.height / 2

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  let state: FishState = { x: target.x, y: target.y, angle: 0, phase: 0 }
  let last = performance.now()
  let rafId = 0
  let seen = false
  let reduced = false

  const show = () => {
    if (el.value) el.value.style.opacity = '1'
  }
  const hide = () => {
    if (el.value) el.value.style.opacity = '0'
  }

  const write = () => {
    const node = el.value
    if (!node) return
    const deg = (state.angle * 180) / Math.PI
    const flip = Math.cos(state.angle) < 0 ? -1 : 1 // keep the belly down when facing left
    const sway = Math.sin(state.phase) * SWAY_DEG
    const bob = Math.sin(state.phase * 0.6) * BOB_PX
    node.style.transform =
      `translate(${state.x - halfW}px, ${state.y - halfH + bob}px) ` +
      `rotate(${deg + sway}deg) scaleY(${flip})`
  }

  const onPointerMove = (event: PointerEvent) => {
    target = { x: event.clientX, y: event.clientY }
    if (!seen) {
      seen = true
      state = { ...state, x: target.x, y: target.y }
      show()
    }
    if (reduced) {
      state = { ...state, x: target.x, y: target.y }
      write()
    }
  }
  const onPointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget) hide() // left the window
  }

  const frame = (now: number) => {
    let dt = (now - last) / 1000
    if (dt > 0.25) dt = 0.25
    last = now
    state = stepFish(state, target.x, target.y, dt)
    write()
    rafId = requestAnimationFrame(frame)
  }

  const onVisibility = () => {
    if (reduced) return
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    } else if (!rafId) {
      last = performance.now()
      rafId = requestAnimationFrame(frame)
    }
  }

  onMounted(() => {
    reduced = prefersReducedMotion()
    write() // seed the transform so the fish is placed before its first reveal
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerout', onPointerOut)
    if (!reduced) {
      document.addEventListener('visibilitychange', onVisibility)
      rafId = requestAnimationFrame(frame)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerout', onPointerOut)
    document.removeEventListener('visibilitychange', onVisibility)
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  })
}
