import { gsap } from 'gsap'
import type { Ref } from 'vue'

// Slightly longer than --duration-slow (520ms) so the blot has room to
// visibly spread before fading; --ease-out as the cubic-bezier string gsap
// needs (it can't read CSS custom properties).
const DURATION = 0.6
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)' // --ease-out

/**
 * Diameter (and top-left offset) for a circle centered at (x, y) that fully
 * covers a `width` × `height` box — i.e. reaches whichever corner is
 * furthest from the point. Pure so it's unit-testable.
 */
export function computeBlotRect(
  x: number,
  y: number,
  width: number,
  height: number,
): { left: number; top: number; size: number } {
  const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
  return { left: x - radius, top: y - radius, size: radius * 2 }
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A radial ink blot that blooms from the pointer position and fades out —
 * click feedback themed as ink hitting paper. `target` must be positioned
 * (`relative`/`isolate`) with `overflow-hidden` so the blot clips to it, and
 * should expose `--smoke-glow` (as SmokeButton does) for the blot's color.
 */
export function useInkRipple(target: Ref<HTMLElement | null>): {
  ripple: (event: PointerEvent | MouseEvent) => void
} {
  const ripple = (event: PointerEvent | MouseEvent) => {
    const el = target.value
    if (!el || prefersReducedMotion()) return

    const rect = el.getBoundingClientRect()
    const { left, top, size } = computeBlotRect(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    )

    const blot = document.createElement('span')
    blot.setAttribute('aria-hidden', 'true')
    blot.style.cssText =
      `position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;` +
      `border-radius:9999px;pointer-events:none;transform:scale(0);opacity:1;` +
      `background:radial-gradient(circle, rgb(var(--smoke-glow, 222 215 201) / 0.55) 0%, transparent 70%);`
    el.appendChild(blot)

    gsap.to(blot, {
      scale: 1,
      opacity: 0,
      duration: DURATION,
      ease: EASE_OUT,
      onComplete: () => blot.remove(),
    })
  }

  return { ripple }
}
