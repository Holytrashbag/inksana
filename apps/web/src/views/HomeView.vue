<script setup lang="ts">
import GlassPanel from '@/components/GlassPanel.vue'
import WaterField from '@/components/WaterField.vue'
</script>

<template>
  <WaterField />
  <main class="relative">
    <section class="flex min-h-screen flex-col items-center justify-center px-6">
      <GlassPanel class="p-16">
        <h1 class="mt-4 font-display text-display-title text-ink-950 dark:text-paper">INKSANA</h1>
        <p class="text-body-lg text-ink-500 uppercase dark:text-ink-400">
          Tattoo Studio &centerdot; Permanent Make-up
        </p>
      </GlassPanel>
    </section>
  </main>
</template>
