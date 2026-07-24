<script setup lang="ts">
import { ref, toRef } from 'vue'

import { useGlassCursor } from '@/composables/useGlassCursor'

const props = withDefaults(
  defineProps<{
    /** Optional image URL to refract under the lens; omit for a procedural grid. */
    src?: string
    /** Device-pixel multiplier for the drawing buffer (0.5–2). */
    pixelDensity?: number
  }>(),
  {
    src: undefined,
    pixelDensity: undefined,
  },
)

const canvas = ref<HTMLCanvasElement | null>(null)

useGlassCursor(canvas, {
  src: toRef(props, 'src'),
  pixelDensity: props.pixelDensity,
})
</script>

<template>
  <canvas ref="canvas" class="pointer-events-none fixed inset-0 -z-10 block h-full w-full" aria-hidden="true" />
</template>
