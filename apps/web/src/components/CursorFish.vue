<script setup lang="ts">
import { ref } from 'vue'

import { useCursorFish } from '@/composables/useCursorFish'

const FISH_W = 112
const FISH_H = 67

const fish = ref<SVGSVGElement | null>(null)

useCursorFish(fish, { width: FISH_W, height: FISH_H })
</script>

<template>
  <svg
    ref="fish"
    :width="FISH_W"
    :height="FISH_H"
    viewBox="0 0 100 60"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="pointer-events-none fixed left-0 top-0 z-40 origin-center text-ink-900 opacity-0 transition-opacity duration-300 will-change-transform"
    aria-hidden="true"
  >
    <!-- abstract single-weight koi: one flowing body-into-tail gesture, sweeping fins, an eye -->
    <path
      d="M90 28 C80 16 52 14 34 20 C24 23 18 14 8 9 C16 22 16 34 8 47 C18 42 26 38 34 36 C52 42 80 40 90 28 Z"
    />
    <path d="M44 15.5 C50 6 58 8 62 16" />
    <path d="M56 38 C60 47 66 46 70 39" />
    <path d="M73 18 Q69 28 74 38" />
    <circle cx="81" cy="24" r="1.4" fill="currentColor" stroke="none" />
  </svg>
</template>
