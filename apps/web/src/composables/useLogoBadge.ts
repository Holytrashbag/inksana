import { onMounted, onUnmounted, type Ref } from 'vue'

import { LogoBadgeRenderer, type LogoBadgeOptions } from '@/gl/logoBadgeRenderer'

export type UseLogoBadgeOptions = Pick<LogoBadgeOptions, 'pixelDensity'>

export type UseLogoBadgeReturn = {
  /** True once the WebGL2 context initialised successfully. */
  isSupported: () => boolean
}

/**
 * Drives a {@link LogoBadgeRenderer} bound to a canvas: the pointer parallax-
 * tilts the extruded metal signet, with resize + visibility handling, a
 * reduced-motion fallback, and full teardown. Keeps the component thin per the
 * web app's WebGL conventions.
 */
export function useLogoBadge(
  canvas: Ref<HTMLCanvasElement | null>,
  options: UseLogoBadgeOptions = {},
): UseLogoBadgeReturn {
  let renderer: LogoBadgeRenderer | null = null

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const onPointerMove = (event: PointerEvent) => {
    renderer?.setPointer(event.clientX / window.innerWidth, event.clientY / window.innerHeight)
  }
  const onPointerLeave = () => renderer?.clearPointer()
  const onResize = () => renderer?.resize()
  // pause when the tab is hidden so the loop doesn't accumulate work off-screen
  const onVisibility = () => {
    if (!renderer || prefersReducedMotion()) return
    if (document.hidden) renderer.stop()
    else renderer.start()
  }

  onMounted(() => {
    if (!canvas.value) return
    try {
      renderer = new LogoBadgeRenderer(canvas.value, options)
    } catch (error) {
      // WebGL2 unavailable — leave the canvas blank rather than crash
      console.warn('[useLogoBadge] disabled:', error)
      return
    }

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
