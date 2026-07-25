<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { isDark, toggle } = useTheme()
</script>

<template>
  <!-- Sits above the fixed WebGL canvases. Shows the mark for the theme it will
       switch to: a sun while dark, a moon while light. Single-weight linework to
       match the studio's drawn marks. -->
  <button
    type="button"
    :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    :aria-pressed="isDark"
    class="fixed right-5 top-5 z-50 grid h-11 w-11 place-items-center rounded-pill border border-hairline bg-surface-card/70 text-ink-700 shadow-card backdrop-blur-sm transition-colors hover:text-ink-950 dark:text-ink-200 dark:hover:text-paper"
    @click="toggle"
  >
    <svg
      v-if="isDark"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2.5V4.5M12 19.5V21.5M4.5 12H2.5M21.5 12H19.5M5.6 5.6L7 7M17 17L18.4 18.4M18.4 5.6L17 7M7 17L5.6 18.4"
      />
    </svg>
    <svg
      v-else
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.5A8 8 0 1 1 9.5 4A6.2 6.2 0 0 0 20 14.5Z" />
    </svg>
  </button>
</template>
