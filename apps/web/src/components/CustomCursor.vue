<script setup lang="ts">
import { ref } from 'vue'

import { useCustomCursor } from '@/composables/useCustomCursor'

const SIZE = 48
// Tip of the arrow sits at (6, 4) in the 30x30 viewBox below — that's the
// point that should track the real pointer position, not the shape's centre.
const HOTSPOT = { x: 6 / 30, y: 4 / 30 }

const cursor = ref<SVGSVGElement | null>(null)

useCustomCursor(cursor, { size: SIZE, hotspot: HOTSPOT })
</script>

<template>
  <svg
    ref="cursor"
    :width="SIZE"
    :height="SIZE"
    viewBox="0 0 30 30"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="miter"
    stroke-linecap="round"
    class="pointer-events-none fixed left-0 top-0 z-[60] text-ink-900 opacity-0 transition-opacity duration-300 will-change-transform dark:text-ink-100"
    aria-hidden="true"
  >
    <!-- Tilted arrow outline: a straight shaft down the left edge, a notched
         tail flag bottom-right, closing back up to the tip — drawn as a
         hollow line rather than a filled glyph. -->
    <path d="M6 4 L6 20 L11 15.5 L15 22 Z" />
    <!-- A little ink curl flicking off the tail, like a brush stroke that
         doesn't quite lift off the page. -->
    <path d="M15 22 C20 23 23 19 20 16 C18 14 16 15.5 17 18" />
  </svg>
</template>
