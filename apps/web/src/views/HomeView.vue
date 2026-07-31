<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import ContactForm from '@/components/ContactForm.vue'
import GlassButton from '@/components/GlassButton.vue'
import SmokeButton from '@/components/SmokeButton.vue'
import WaterField from '@/components/WaterField.vue'

const router = useRouter()
import { useContactReveal } from '@/composables/useContactReveal'

const hero = ref<HTMLElement | null>(null)
const contact = ref<HTMLElement | null>(null)

const { revealed, reveal, conceal } = useContactReveal(hero, contact)
</script>

<template>
  <WaterField />
  <main class="relative">
    <div class="relative grid">
      <section
        ref="hero"
        :inert="revealed"
        class="col-start-1 row-start-1 flex min-h-screen flex-col items-center justify-center gap-8 px-4 sm:gap-12 sm:px-6 md:gap-16"
      >
        <div
          class="flex flex-col items-center gap-2 rounded-3xl bg-paper/5 px-6 py-4 backdrop-blur-sm sm:rounded-4xl sm:px-12 sm:py-5 md:px-16 md:py-6 dark:backdrop-blur-xs dark:bg-ink-950/5 shadow-2xl"
        >
          <h1
            class="mt-2 text-center font-display text-display-lg text-ink-950 sm:mt-4 lg:text-display-title dark:text-paper"
          >
            INKSANA
          </h1>
          <p
            class="text-center text-body-sm text-ink-500 uppercase sm:text-body-md md:text-body-lg dark:text-ink-400 justify-self-center"
          >
            Tattoo Studio &centerdot; Permanent Make-up
          </p>
        </div>
        <div
          class="flex w-full max-w-xs flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row sm:gap-8 md:gap-16"
        >
          <GlassButton @click="router.push('/portfolio')">View Portfolio</GlassButton>
          <SmokeButton @click="reveal">Book a Session</SmokeButton>
        </div>
      </section>
      <section
        ref="contact"
        :inert="!revealed"
        class="col-start-1 row-start-1 flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-16 sm:px-6"
      >
        <button
          type="button"
          class="text-ink-800 text-body-md tracking-wider transition-colors duration-150 ease-out hover:text-paper dark:text-ink-200 dark:hover:text-ink-950"
          @click="conceal"
        >
          &lsaquo; Back
        </button>
        <ContactForm />
      </section>
    </div>
  </main>
</template>
