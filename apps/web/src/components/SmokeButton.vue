<script setup lang="ts">
import { ref } from 'vue'

import { useSmokeButton } from '@/composables/useSmokeButton'

withDefaults(defineProps<{ type?: 'button' | 'submit' | 'reset' }>(), { type: 'button' })
const emit = defineEmits<{ click: [MouseEvent] }>()

const button = ref<HTMLButtonElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

useSmokeButton(canvas, button)
</script>

<template>
  <button
    ref="button"
    :type="type"
    class="smoke-button group relative isolate overflow-hidden rounded-lg transition-transform duration-150 ease-out hover:-translate-y-1 active:translate-y-0 focus-visible:shadow-focus focus-visible:outline-none"
    @click="emit('click', $event)"
  >
    <div class="absolute -inset-4 -z-10">
      <canvas
        ref="canvas"
        class="absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
        aria-hidden="true"
      />
    </div>
    <div
      class="m-0.5 rounded-md bg-surface-ink/30 px-12 py-5 transition-colors duration-300 group-hover:bg-surface-ink/10"
    >
      <span class="text-body-md font-medium tracking-wide text-paper uppercase">
        <slot />
      </span>
    </div>
  </button>
</template>

<style scoped>
/* The GL smoke alone reads as a dark, low-contrast rectangle against an
   already-dark page (see the reported screenshot) — a plain box-shadow glow
   in the live ink-accent color gives it the silhouette and pull a primary
   CTA needs. --smoke-glow is set from JS (useSmokeButton) as an r g b
   triplet; the fallback matches the dark-theme neutral so there's no flash
   before the first frame. Layered near+far shadows read as a soft halo
   rather than a single hard ring. */
.smoke-button {
  border: 1px solid rgb(var(--smoke-glow, 222 215 201) / 0.4);
  box-shadow:
    0 0 28px 2px rgb(var(--smoke-glow, 222 215 201) / 0.55),
    0 0 72px 14px rgb(var(--smoke-glow, 222 215 201) / 0.3);
  transition:
    box-shadow 300ms var(--ease-out),
    border-color 300ms var(--ease-out);
}
.smoke-button:hover,
.smoke-button:focus-visible {
  border-color: rgb(var(--smoke-glow, 222 215 201) / 0.7);
  box-shadow:
    0 0 40px 6px rgb(var(--smoke-glow, 222 215 201) / 0.75),
    0 0 100px 22px rgb(var(--smoke-glow, 222 215 201) / 0.45);
}
</style>
