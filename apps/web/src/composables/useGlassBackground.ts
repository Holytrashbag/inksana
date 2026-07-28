import { ref, type Ref } from 'vue'

// Module-level singleton, same pattern as useTheme/useInkColor: WaterField
// registers its live canvas here on mount, and any WebGL2 effect that needs to
// refract or sample "whatever's rendered behind it on the page" (currently
// just GlassPanel) reads it back out, reactively.
const background = ref<HTMLCanvasElement | null>(null)

/** Register (or clear, passing null) the canvas other GL effects should sample. */
export function provideGlassBackground(canvas: HTMLCanvasElement | null): void {
  background.value = canvas
}

/** The currently registered background canvas, if any. */
export function useGlassBackground(): Ref<HTMLCanvasElement | null> {
  return background
}
