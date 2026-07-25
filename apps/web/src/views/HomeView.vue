<script setup lang="ts">
import GlassPanel from '@/components/GlassPanel.vue'
import InkField from '@/components/InkField.vue'
</script>

<template>
  <InkField />
  <main class="relative">
    <section class="flex min-h-screen flex-col items-center justify-center px-6">
      <GlassPanel class="flex flex-col items-center px-8 py-12 text-center sm:px-16 sm:py-16">
        <p class="text-label text-ink-500 uppercase dark:text-ink-400">Fine-line tattoo studio</p>
        <h1 class="mt-4 font-display text-display-xl text-ink-950 dark:text-paper">INKSANA</h1>
        <p class="mt-4 max-w-narrow text-body-lg text-ink-600 dark:text-ink-300">
          Ink that settles into the skin the way it settles into the page.
        </p>
      </GlassPanel>
    </section>
    <section class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p class="text-label text-ink-500 uppercase dark:text-ink-400">The craft</p>
      <p class="mt-4 max-w-narrow font-display text-display-md text-ink-900 dark:text-ink-200">
        Every line drawn once, by hand, with intent — then set into skin to last a lifetime.
      </p>
    </section>
  </main>
</template>
