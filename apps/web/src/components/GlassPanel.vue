<script setup lang="ts">
import { ref } from 'vue'

import { useGlassPanel } from '@/composables/useGlassPanel'

const panel = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

useGlassPanel(canvas, panel, { radius: 28 })
</script>

<template>
  <!-- A pane of glass rendered in WebGL2, not faked with CSS: the canvas
       samples whatever's live behind the panel (the WaterField background)
       every frame and bends it inward near the rounded edges like a real
       lens, softened by a cheap frosted blur, with a top-down gloss and an
       inset edge highlight baked into the shader. The outer ring and drop
       shadow stay as plain CSS — the shader only draws within the panel's
       own bounds, so it can't cast a shadow outside them. -->
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
/* Reduced transparency: skip the live refraction and fall back to a plain
   frosted card, same as the CSS-only version used to do for backdrop-filter. */
@media (prefers-reduced-transparency: reduce) {
  .glass-panel {
    background-color: var(--color-veil);
  }
  .glass-canvas {
    display: none;
  }
}
</style>
