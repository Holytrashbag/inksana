import { onMounted, onUnmounted, watch, type Ref } from 'vue'

import { GlassCursorRenderer } from '@/gl/glassCursorRenderer'

export type UseGlassCursorOptions = {
  /** URL of an image to refract under the lens; omit for the procedural grid. */
  src?: Ref<string | undefined>
  /** Device-pixel multiplier for the drawing buffer. */
  pixelDensity?: number
}

export type UseGlassCursorReturn = {
  /** True once the WebGL2 context initialised successfully. */
  isSupported: () => boolean
}

/**
 * Drives a {@link GlassCursorRenderer} bound to a canvas element, wiring pointer
 * tracking, resize handling, optional image loading, and full teardown.
 */
export function useGlassCursor(
  canvas: Ref<HTMLCanvasElement | null>,
  options: UseGlassCursorOptions = {},
): UseGlassCursorReturn {
  let renderer: GlassCursorRenderer | null = null

  const onPointerMove = (event: PointerEvent) => {
    renderer?.setMouse(event.clientX / window.innerWidth, event.clientY / window.innerHeight)
  }
  const onPointerLeave = () => renderer?.clearMouse()
  const onResize = () => renderer?.resize()

  const loadImage = (src: string | undefined) => {
    if (!renderer) return
    if (!src) {
      renderer.clearImage()
      return
    }
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.addEventListener('load', () => renderer?.setImage(image), { once: true })
    image.src = src
  }

  onMounted(() => {
    if (!canvas.value) return
    try {
      renderer = new GlassCursorRenderer(canvas.value, { pixelDensity: options.pixelDensity })
    } catch (error) {
      // WebGL2 unavailable — leave the canvas blank rather than crash the app
      console.warn('[useGlassCursor] disabled:', error)
      return
    }

    renderer.start()
    loadImage(options.src?.value)

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerout', onPointerLeave)
    window.addEventListener('resize', onResize)
  })

  if (options.src) {
    watch(options.src, (src) => loadImage(src))
  }

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerout', onPointerLeave)
    window.removeEventListener('resize', onResize)
    renderer?.dispose()
    renderer = null
  })

  return {
    isSupported: () => renderer !== null,
  }
}
