import { onMounted, onUnmounted, watch, type Ref } from 'vue'

import { InkFieldRenderer, type InkFieldOptions } from '@/gl/inkFieldRenderer'
import { useTheme } from '@/composables/useTheme'

export type UseInkFieldOptions = Pick<InkFieldOptions, 'lineCount' | 'pixelDensity' | 'inkColor'>

export type UseInkFieldReturn = {
  /** True once the WebGL2 context initialised successfully. */
  isSupported: () => boolean
}

/**
 * Drives an {@link InkFieldRenderer} bound to a canvas: pointer stirring,
 * resize + visibility handling, reduced-motion fallback, and full teardown.
 * Keeps the component thin per the web app's WebGL conventions.
 */
export function useInkField(
  canvas: Ref<HTMLCanvasElement | null>,
  options: UseInkFieldOptions = {},
): UseInkFieldReturn {
  let renderer: InkFieldRenderer | null = null
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
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    renderer?.setScroll(max > 0 ? window.scrollY / max : 0)
  }
  // pause when the tab is hidden so the loop doesn't accumulate a huge dt jump
  const onVisibility = () => {
    if (!renderer || prefersReducedMotion()) return
    if (document.hidden) renderer.stop()
    else renderer.start()
  }

  onMounted(() => {
    if (!canvas.value) return
    try {
      renderer = new InkFieldRenderer(canvas.value, options)
    } catch (error) {
      // WebGL2 unavailable — leave the canvas blank rather than crash the app
      console.warn('[useInkField] disabled:', error)
      return
    }
    renderer.setTheme(isDark.value)

    if (prefersReducedMotion()) {
      // present a single settled ink drawing, no animation
      renderer.settle()
    } else {
      renderer.start()
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerout', onPointerLeave)
      document.addEventListener('visibilitychange', onVisibility)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // seed the current scroll position
  })

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerout', onPointerLeave)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('visibilitychange', onVisibility)
    renderer?.dispose()
    renderer = null
  })

  return {
    isSupported: () => renderer !== null,
  }
}
