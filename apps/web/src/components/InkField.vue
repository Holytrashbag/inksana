<script setup lang="ts">
import { ref } from 'vue'

import { useInkField } from '@/composables/useInkField'

const props = withDefaults(
  defineProps<{
    /** Number of contour lines across the height (8–80). */
    lineCount?: number
    /** Device-pixel multiplier for the drawing buffer (0.5–2). */
    pixelDensity?: number
  }>(),
  {
    lineCount: undefined,
    pixelDensity: undefined,
  },
)

const canvas = ref<HTMLCanvasElement | null>(null)

useInkField(canvas, {
  lineCount: props.lineCount,
  pixelDensity: props.pixelDensity,
})
</script>

<template>
  <canvas
    ref="canvas"
    class="pointer-events-none fixed inset-0 -z-20 block h-full w-full bg-surface"
    aria-hidden="true"
  />
</template>
