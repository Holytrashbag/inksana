import { onMounted, onUnmounted, watch, type Ref } from 'vue'

import { WaterRenderer, type WaterOptions } from '@/gl/waterRenderer'
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
  // registered in setup scope, so it disposes with the component
  watch(isDark, (dark) => renderer?.setTheme(dark))

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const onPointerMove = (event: PointerEvent) => {
    renderer?.setPointer(event.clientX / window.innerWidth, event.clientY / window.innerHeight)
  }
  const onPointerLeave = () => renderer?.clearPointer()
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

    if (prefersReducedMotion()) {
      // present a single calm frame, no animation
      renderer.settle()
    } else {
      renderer.start()
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerout', onPointerLeave)
      document.addEventListener('visibilitychange', onVisibility)
    }

    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerout', onPointerLeave)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibility)
    renderer?.dispose()
    renderer = null
  })

  return {
    isSupported: () => renderer !== null,
  }
}
