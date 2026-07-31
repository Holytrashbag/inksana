import { onMounted, onUnmounted, watch, type Ref } from 'vue'

import { SmokeButtonRenderer, type SmokeButtonOptions } from '@/gl/smokeButtonRenderer'
import {
  complementRgb,
  hexToRgb01,
  resolveInkHex,
  saturateRgb,
  useInkColor,
} from '@/composables/useInkColor'

export type UseSmokeButtonOptions = Pick<SmokeButtonOptions, 'pixelDensity'>

// How quickly the hover amount eases toward its target — see stepCursor/
// stepHover in the other GL composables for the same rationale.
const HOVER_SPEED = 8
// The plasma wants a punchier hue than the accent swatches are tuned for
// (see saturateRgb's doc comment).
const ACCENT_SATURATION_BOOST = 1.6

/** Ease `value` toward `target` over `dt` seconds. Pure so it's unit-testable. */
export function stepHover(value: number, target: number, dt: number): number {
  const step = dt > 0.05 ? 0.05 : dt // clamp so a stalled tab can't jump-cut the swirl
  const ease = 1 - Math.exp(-step * HOVER_SPEED)
  return value + (target - value) * ease
}

/**
 * Drives a {@link SmokeButtonRenderer} bound to a canvas behind `button`'s
 * label. Always renders its ink-diffusing-into-paper palette against a dark
 * base regardless of the page's light/dark theme — a deliberate, singular
 * accent treatment for the page's primary call to action, not a themed
 * surface. Sizes the canvas from its own parent element (the padded frame
 * div), eases a hover+focus amount into the renderer, and follows the
 * shared ink-accent color. Full teardown on unmount.
 */
export function useSmokeButton(
  canvas: Ref<HTMLCanvasElement | null>,
  button: Ref<HTMLElement | null>,
  options: UseSmokeButtonOptions = {},
): void {
  let renderer: SmokeButtonRenderer | null = null
  let rafId = 0
  let hover = 0
  let hoverTarget = 0
  let hovered = false
  let focused = false
  let start = 0
  let last = 0

  const { accent } = useInkColor()

  // Fixed to the dark-theme neutral when unset — this button's palette is
  // deliberately theme-independent (see doc comment above). Complemented
  // (not just saturated) so the button's plasma never collapses into the
  // same hue as the water background it sits on top of — the two are
  // supposed to contrast, not match.
  const applyAccent = () => {
    const base = hexToRgb01(resolveInkHex(accent.value, true))
    const rgb = saturateRgb(complementRgb(base), ACCENT_SATURATION_BOOST)
    renderer?.setAccent(rgb)
    // Exposed as a CSS custom property (space-separated 0..255 triplet, the
    // same convention Tailwind itself uses) so the button's own outer glow —
    // plain CSS, not GL — can pick up the live accent too.
    button.value?.style.setProperty('--smoke-glow', rgb.map((c) => Math.round(c * 255)).join(' '))
  }
  watch(accent, applyAccent)

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const resize = () => {
    const wrap = canvas.value?.parentElement
    if (!renderer || !wrap) return
    renderer.resize(wrap.clientWidth, wrap.clientHeight)
  }

  const renderOnce = (timeSeconds: number) => {
    renderer?.render(timeSeconds)
  }

  const frame = (now: number) => {
    if (!start) start = now
    const dt = last ? (now - last) / 1000 : 0
    last = now
    hover = stepHover(hover, hoverTarget, dt)
    renderer?.setHover(hover)
    renderOnce((now - start) / 1000)
    rafId = requestAnimationFrame(frame)
  }

  const setHoverTarget = (target: number) => {
    hoverTarget = target
    if (prefersReducedMotion()) {
      hover = hoverTarget
      renderer?.setHover(hover)
      renderOnce(0)
    }
  }

  const onPointerEnter = () => {
    hovered = true
    setHoverTarget(1)
  }
  const onPointerLeave = () => {
    hovered = false
    setHoverTarget(focused ? 1 : 0)
  }
  const onFocus = () => {
    focused = true
    setHoverTarget(1)
  }
  const onBlur = () => {
    focused = false
    setHoverTarget(hovered ? 1 : 0)
  }

  // pause while hidden, same as the other GL composables — no benefit to
  // animating a button nobody can see
  const onVisibility = () => {
    if (prefersReducedMotion()) return
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    } else if (!rafId) {
      last = 0
      rafId = requestAnimationFrame(frame)
    }
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    const wrap = canvas.value?.parentElement
    if (!canvas.value || !button.value || !wrap) return
    try {
      renderer = new SmokeButtonRenderer(canvas.value, options)
    } catch (error) {
      // WebGL2 unavailable — leave the canvas blank, the CSS glow still shows
      console.warn('[useSmokeButton] disabled:', error)
      return
    } finally {
      applyAccent()
    }
    resize()

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(wrap)
    window.addEventListener('resize', resize)

    button.value.addEventListener('pointerenter', onPointerEnter)
    button.value.addEventListener('pointerleave', onPointerLeave)
    button.value.addEventListener('focus', onFocus)
    button.value.addEventListener('blur', onBlur)

    if (prefersReducedMotion()) {
      renderOnce(0)
    } else {
      rafId = requestAnimationFrame(frame)
      document.addEventListener('visibilitychange', onVisibility)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    button.value?.removeEventListener('pointerenter', onPointerEnter)
    button.value?.removeEventListener('pointerleave', onPointerLeave)
    button.value?.removeEventListener('focus', onFocus)
    button.value?.removeEventListener('blur', onBlur)
    resizeObserver?.disconnect()
    resizeObserver = null
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    renderer?.dispose()
    renderer = null
  })
}
