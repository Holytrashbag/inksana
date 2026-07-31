<script setup lang="ts">
import GlassButton from '@/components/GlassButton.vue'
import SmokeButton from '@/components/SmokeButton.vue'
import WaterField from '@/components/WaterField.vue'
</script>

<template>
  <WaterField />
  <main class="relative">
    <section class="flex gap-16 min-h-screen flex-col items-center justify-center px-6">
      <div
        class="flex flex-col items-center gap-2 rounded-4xl bg-paper/5 px-16 py-6 backdrop-blur-sm dark:backdrop-blur-xs dark:bg-ink-950/5 shadow-2xl"
      >
        <h1 class="mt-4 font-display text-display-title text-ink-950 dark:text-paper">INKSANA</h1>
        <p class="text-body-lg text-ink-500 uppercase dark:text-ink-400 justify-self-center">
          Tattoo Studio &centerdot; Permanent Make-up
        </p>
      </div>
      <div class="flex flex-row gap-16">
        <GlassButton>View Portfolio</GlassButton>
        <SmokeButton>Book a Session</SmokeButton>
      </div>
    </section>
  </main>
</template>
