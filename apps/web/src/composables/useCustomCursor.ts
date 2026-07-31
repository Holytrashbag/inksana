import { onMounted, onUnmounted, type Ref } from 'vue'

// Replaces the OS pointer with a stylized arrow outline (see CustomCursor.vue).
// The easing step is a pure function so it can be unit-tested; the composable
// only wires it to rAF and writes the element transform.

// A cursor reads as broken if it visibly lags the pointer, unlike a decorative
// trail — so FOLLOW is high enough to converge within a couple of frames; it's
// still not 1:1 so raw pointer jitter gets a little smoothing.
const FOLLOW = 40

export type CursorState = {
  /** Screen-space position of the cursor centre (px). */
  x: number
  y: number
}

/**
 * Advance the cursor one frame toward the pointer at (tx, ty) over dt seconds.
 * Pure and side-effect free: returns the next {@link CursorState}.
 */
export function stepCursor(state: CursorState, tx: number, ty: number, dt: number): CursorState {
  const step = dt > 0.05 ? 0.05 : dt // clamp so a stalled tab can't teleport the cursor
  const ease = 1 - Math.exp(-step * FOLLOW)
  return {
    x: state.x + (tx - state.x) * ease,
    y: state.y + (ty - state.y) * ease,
  }
}

export type UseCustomCursorOptions = {
  /** Rendered width/height of the cursor mark (px). */
  size: number
  /**
   * The mark's "hot point" — the spot that should sit exactly under the
   * pointer — as a 0..1 fraction of `size`. Defaults to the centre; a pointy
   * cursor should pass its tip (e.g. `{ x: 0.2, y: 0.13 }`).
   */
  hotspot?: { x: number; y: number }
}

/**
 * Drive a cursor element so it trails the pointer. Owns its pointer listeners
 * and rAF loop; hidden until the first pointer move, then stays visible for
 * the rest of the session (including while the pointer is outside the
 * viewport). Respects reduced-motion by snapping instead of animating.
 */
export function useCustomCursor(
  el: Ref<SVGSVGElement | null>,
  options: UseCustomCursorOptions,
): void {
  const hotspot = options.hotspot ?? { x: 0.5, y: 0.5 }
  const offsetX = hotspot.x * options.size
  const offsetY = hotspot.y * options.size

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Touchscreens have no real pointer to replace — mounting the listeners
  // there would just make the mark pop in on the first swipe and never
  // track anything meaningfully. `hover: hover` + `pointer: fine` is the
  // standard signal for "primary input is a mouse/trackpad".
  const hasFinePointer = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches

  let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  let state: CursorState = { x: target.x, y: target.y }
  let last = performance.now()
  let rafId = 0
  let seen = false
  let reduced = false

  const show = () => {
    if (el.value) el.value.style.opacity = '1'
  }

  const write = () => {
    const node = el.value
    if (!node) return
    node.style.transform = `translate(${state.x - offsetX}px, ${state.y - offsetY}px)`
  }

  const onPointerMove = (event: PointerEvent) => {
    // Ignore touch drags on hybrid devices (e.g. a touchscreen laptop) —
    // only a mouse/pen should drive the mark.
    if (event.pointerType === 'touch') return
    target = { x: event.clientX, y: event.clientY }
    if (!seen) {
      seen = true
      state = { ...target }
      show()
    }
    if (reduced) {
      state = { ...target }
      write()
    }
  }

  const frame = (now: number) => {
    let dt = (now - last) / 1000
    if (dt > 0.25) dt = 0.25
    last = now
    state = stepCursor(state, target.x, target.y, dt)
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
    if (!hasFinePointer()) return

    reduced = prefersReducedMotion()
    write() // seed the transform so the cursor is placed before its first reveal
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    if (!reduced) {
      document.addEventListener('visibilitychange', onVisibility)
      rafId = requestAnimationFrame(frame)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('visibilitychange', onVisibility)
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  })
}
