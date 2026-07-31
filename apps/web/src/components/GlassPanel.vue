<script setup lang="ts">
import { ref } from 'vue'

import { useGlassPanel } from '@/composables/useGlassPanel'

const panel = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

useGlassPanel(canvas, panel, { radius: 28 })
</script>

<template>
  <div ref="panel" class="glass-panel relative isolate overflow-hidden rounded-frame">
    <canvas
      ref="canvas"
      class="glass-canvas pointer-events-none absolute inset-0 -z-10 h-full w-full"
      aria-hidden="true"
    />
    <div class="relative z-1">
      <slot />
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-transparency: reduce) {
  .glass-panel {
    background-color: var(--color-veil);
  }
  .glass-canvas {
    display: none;
  }
}
</style>
