<script setup lang="ts">
import { ref } from 'vue'

import { useLogoBadge } from '@/composables/useLogoBadge'

const props = withDefaults(
  defineProps<{
    /** Device-pixel multiplier for the drawing buffer (0.5–2). */
    pixelDensity?: number
  }>(),
  {
    pixelDensity: undefined,
  },
)

const canvas = ref<HTMLCanvasElement | null>(null)

useLogoBadge(canvas, {
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
