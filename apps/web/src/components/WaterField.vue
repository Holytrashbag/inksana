<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import InkColorPicker from '@/components/InkColorPicker.vue'
import { provideGlassBackground } from '@/composables/useGlassBackground'
import { useWater } from '@/composables/useWater'

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

useWater(canvas, {
  pixelDensity: props.pixelDensity,
})

// Lets GlassPanel (and any other WebGL2 effect) sample this canvas live to
// refract whatever's actually rendered behind it, instead of a static image.
onMounted(() => provideGlassBackground(canvas.value))
onUnmounted(() => provideGlassBackground(null))
</script>

<template>
  <canvas
    ref="canvas"
    class="pointer-events-none fixed inset-0 -z-20 block h-full w-full bg-surface"
    aria-hidden="true"
  />
  <InkColorPicker />
</template>
