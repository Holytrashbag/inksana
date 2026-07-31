import { gsap } from 'gsap'
import { onMounted, onUnmounted, ref, type Ref } from 'vue'

// Values mirror the DS's signature "ink settling" motion (the ink-bleed
// keyframe plus --duration-slow/--ease-ink in main.css) — hardcoded here
// since gsap tweens can't read CSS custom properties directly.
const DURATION_OUT = 0.32
const DURATION_IN = 0.52 // --duration-slow
const EASE_OUT = 'power2.in'
const EASE_INK = 'cubic-bezier(0.22, 0.61, 0.22, 1)' // --ease-ink
const BLUR_PX = 4 // ink-bleed's blur amount
const SETTLE_SCALE = 0.985 // ink-bleed's scale amount
const TRAVEL_PX = 16

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Cross-fades between two same-slot sections (hero ↔ contact) with the DS's
 * ink-settling motion: the outgoing section dissolves as one block, then the
 * incoming section's direct children bleed in with a slight stagger, like ink
 * drawing itself onto paper. `outgoing`/`incoming` should occupy the same
 * grid cell (see HomeView) so the swap reads as a replace, not a scroll.
 */
export function useContactReveal(
  outgoing: Ref<HTMLElement | null>,
  incoming: Ref<HTMLElement | null>,
): { revealed: Ref<boolean>; reveal: () => void; conceal: () => void } {
  const revealed = ref(false)
  let timeline: gsap.core.Timeline | null = null

  const swap = (show: boolean) => {
    const leaving = show ? outgoing.value : incoming.value
    const entering = show ? incoming.value : outgoing.value
    if (!leaving || !entering || show === revealed.value) return
    const enteringChildren = Array.from(entering.children)

    timeline?.kill()

    if (prefersReducedMotion()) {
      gsap.set(leaving, { autoAlpha: 0 })
      gsap.set(entering, { autoAlpha: 1 })
      gsap.set(enteringChildren, { autoAlpha: 1, filter: 'blur(0px)', scale: 1, y: 0 })
      revealed.value = show
      return
    }

    timeline = gsap.timeline({ onComplete: () => (revealed.value = show) })
    timeline
      .to(leaving, {
        autoAlpha: 0,
        filter: `blur(${BLUR_PX}px)`,
        scale: SETTLE_SCALE,
        duration: DURATION_OUT,
        ease: EASE_OUT,
      })
      // `leaving`'s own filter/scale (set above) stick around as inline
      // styles after the tween — whichever section plays `entering` next
      // must have those cleared here, or it renders permanently blurred the
      // next time it swaps back in (only its *children* get animated below,
      // never the container itself).
      .set(entering, { autoAlpha: 1, clearProps: 'filter,transform' })
      .fromTo(
        enteringChildren,
        { autoAlpha: 0, filter: `blur(${BLUR_PX}px)`, scale: SETTLE_SCALE, y: TRAVEL_PX },
        {
          autoAlpha: 1,
          filter: 'blur(0px)',
          scale: 1,
          y: 0,
          duration: DURATION_IN,
          ease: EASE_INK,
          stagger: 0.08,
        },
        '-=0.05',
      )
  }

  onMounted(() => {
    if (incoming.value) gsap.set(incoming.value, { autoAlpha: 0 })
  })

  onUnmounted(() => timeline?.kill())

  return {
    revealed,
    reveal: () => swap(true),
    conceal: () => swap(false),
  }
}
