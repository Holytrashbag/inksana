import { onMounted, onUnmounted, watch, type Ref } from 'vue'

import { GlassPanelRenderer, type GlassPanelOptions } from '@/gl/glassPanelRenderer'
import { useGlassBackground } from '@/composables/useGlassBackground'
import { useTheme } from '@/composables/useTheme'

export type UseGlassPanelOptions = Pick<GlassPanelOptions, 'radius' | 'pixelDensity'>

/**
 * Drives a {@link GlassPanelRenderer} bound to a canvas overlaying `panel`:
 * tracks the panel's size (ResizeObserver) and position (read every frame —
 * cheap for one element, and it's the simplest way to stay correct through
 * scrolling), and full teardown on unmount. Keeps the component thin per the
 * web app's WebGL conventions.
 */
export function useGlassPanel(
  canvas: Ref<HTMLCanvasElement | null>,
  panel: Ref<HTMLElement | null>,
  options: UseGlassPanelOptions = {},
): void {
  let renderer: GlassPanelRenderer | null = null
  let rafId = 0

  const background = useGlassBackground()
  const { isDark } = useTheme()
  // registered in setup scope, so it disposes with the component
  watch(isDark, (dark) => renderer?.setTheme(dark))

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const resize = () => {
    if (!renderer || !panel.value) return
    renderer.resize(panel.value.getBoundingClientRect())
  }

  const frame = () => {
    if (renderer && panel.value && background.value) {
      renderer.setPosition(panel.value.getBoundingClientRect())
      renderer.render(background.value)
    }
    rafId = requestAnimationFrame(frame)
  }

  // pause while hidden, same as WaterField/CustomCursor — otherwise this keeps
  // re-sampling the (possibly stopped) background canvas for the whole time
  // the tab is backgrounded, for no visible benefit
  const onVisibility = () => {
    if (prefersReducedMotion()) return
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    } else if (!rafId) {
      rafId = requestAnimationFrame(frame)
    }
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    if (!canvas.value || !panel.value) return
    try {
      renderer = new GlassPanelRenderer(canvas.value, options)
    } catch (error) {
      // WebGL2 unavailable — leave the canvas blank, CSS border/shadow still show
      console.warn('[useGlassPanel] disabled:', error)
      return
    }
    renderer.setTheme(isDark.value)
    resize()

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(panel.value)
    window.addEventListener('resize', resize)

    if (prefersReducedMotion()) {
      // present a single static frame against whatever the (also-reduced) background shows
      if (background.value) {
        renderer.setPosition(panel.value.getBoundingClientRect())
        renderer.render(background.value)
      }
    } else {
      rafId = requestAnimationFrame(frame)
      document.addEventListener('visibilitychange', onVisibility)
    }
  })

  // Reduced-motion + mounted before the background registers: catch it once it does.
  watch(background, (bg) => {
    if (!rafId && prefersReducedMotion() && bg && renderer && panel.value) {
      renderer.setPosition(panel.value.getBoundingClientRect())
      renderer.render(bg)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    resizeObserver?.disconnect()
    resizeObserver = null
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    renderer?.dispose()
    renderer = null
  })
}
