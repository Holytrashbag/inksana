<script setup lang="ts">
import CursorFish from '@/components/CursorFish.vue'
import GlassPanel from '@/components/GlassPanel.vue'
import WaterField from '@/components/WaterField.vue'
</script>

<template>
  <WaterField />
  <CursorFish />
  <main class="relative">
    <section class="flex min-h-screen flex-col items-center justify-center px-6">
      <GlassPanel class="flex flex-col items-center px-8 py-12 text-center sm:px-16 sm:py-16">
        <p class="text-label text-ink-500 uppercase">Fine-line tattoo studio</p>
        <h1 class="mt-4 font-display text-display-xl text-ink-950">INKSANA</h1>
        <p class="mt-4 max-w-narrow text-body-lg text-ink-600">
          Ink finds its own way through the skin — we only give it direction.
        </p>
      </GlassPanel>
    </section>
    <section class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p class="text-label text-ink-500 uppercase">The craft</p>
      <p class="mt-4 max-w-narrow font-display text-display-md text-ink-900">
        A single drop, coaxed into a line that lasts a lifetime — never rushed, never twice the same.
      </p>
    </section>
  </main>
</template>
