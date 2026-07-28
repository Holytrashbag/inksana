import { onMounted, onUnmounted, watch, type Ref } from 'vue'

import { WaterRenderer, type WaterOptions } from '@/gl/waterRenderer'
import { hexToRgb01, resolveInkHex, useInkColor } from '@/composables/useInkColor'
import { useTheme } from '@/composables/useTheme'

export type UseWaterOptions = Pick<WaterOptions, 'pixelDensity'>

export type UseWaterReturn = {
  /** True once the WebGL2 context initialised successfully. */
  isSupported: () => boolean
}

/**
 * Drives a {@link WaterRenderer} bound to a canvas: pointer stirs the surface,
 * resize + visibility handling, reduced-motion fallback, and full teardown.
 * Keeps the component thin per the web app's WebGL conventions.
 */
export function useWater(
  canvas: Ref<HTMLCanvasElement | null>,
  options: UseWaterOptions = {},
): UseWaterReturn {
  let renderer: WaterRenderer | null = null
  const { isDark } = useTheme()
  const { accent } = useInkColor()
  // registered in setup scope, so it disposes with the component. The neutral
  // slot isn't stored, so theme changes alone can flip the resolved ink color.
  watch(isDark, (dark) => renderer?.setTheme(dark))
  watch([accent, isDark], ([name, dark]) => renderer?.setInk(hexToRgb01(resolveInkHex(name, dark))))

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const onPointerMove = (event: PointerEvent) => {
    renderer?.setPointer(event.clientX / window.innerWidth, event.clientY / window.innerHeight)
  }
  const onPointerLeave = () => renderer?.clearPointer()
  // Pointer events get cancelled once a mobile browser claims a gesture as a
  // page scroll, so a swipe stops driving pointermove partway through. touch*
  // events keep firing for the whole gesture even while the page scrolls.
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (touch)
      renderer?.setPointer(touch.clientX / window.innerWidth, touch.clientY / window.innerHeight)
  }
  const onTouchEnd = () => renderer?.clearPointer()
  const onResize = () => renderer?.resize()
  // pause when the tab is hidden so the loop doesn't accumulate a huge dt jump
  const onVisibility = () => {
    if (!renderer || prefersReducedMotion()) return
    if (document.hidden) renderer.stop()
    else renderer.start()
  }

  onMounted(() => {
    if (!canvas.value) return
    try {
      renderer = new WaterRenderer(canvas.value, options)
    } catch (error) {
      // WebGL2 / float targets unavailable — leave the canvas blank rather than crash
      console.warn('[useWater] disabled:', error)
      return
    }
    renderer.setTheme(isDark.value)
    renderer.setInk(hexToRgb01(resolveInkHex(accent.value, isDark.value)))

    if (prefersReducedMotion()) {
      // present a single calm frame, no animation
      renderer.settle()
    } else {
      renderer.start()
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerout', onPointerLeave)
      window.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('touchend', onTouchEnd)
      window.addEventListener('touchcancel', onTouchEnd)
      document.addEventListener('visibilitychange', onVisibility)
    }

    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerout', onPointerLeave)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('touchcancel', onTouchEnd)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibility)
    renderer?.dispose()
    renderer = null
  })

  return {
    isSupported: () => renderer !== null,
  }
}
