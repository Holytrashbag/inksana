<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="relative min-h-screen bg-surface px-4 py-16 sm:px-6 md:py-24">
    <div class="mx-auto max-w-6xl">
      <RouterLink
        to="/home"
        class="text-body-md tracking-wider text-ink-600 transition-colors duration-150 ease-out hover:text-ink-950 dark:text-ink-400 dark:hover:text-paper"
      >
        &lsaquo; Back
      </RouterLink>

      <h1
        class="mt-8 text-center font-display text-display-lg text-ink-950 sm:mt-12 dark:text-paper"
      >
        Portfolio
      </h1>
      <p
        class="mt-4 text-center text-body-sm text-ink-500 uppercase sm:text-body-md dark:text-ink-400"
      >
        Selected Work
      </p>

      <p class="mt-16 text-center text-body-md text-ink-500 dark:text-ink-400">
        Gallery coming soon.
      </p>
    </div>
  </main>
</template>
