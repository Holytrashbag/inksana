<script setup lang="ts">
withDefaults(defineProps<{ type?: 'button' | 'submit' | 'reset' }>(), { type: 'button' })
const emit = defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <button
    :type="type"
    class="glass-button rounded-lg border border-hairline bg-surface-ink/60 dark:bg-surface-card/20 px-6 py-3 sm:px-8 sm:py-3.5 md:px-10 md:py-4 shadow-card backdrop-blur-xs transition-all duration-150 ease-out hover:-translate-y-1 hover:bg-surface-ink/95 dark:hover:bg-surface-card/60 hover:shadow-raised active:translate-y-0 focus-visible:shadow-focus focus-visible:outline-none"
    @click="emit('click', $event)"
  >
    <span
      class="text-body-sm sm:text-body-md font-medium tracking-wide text-ink-50 dark:text-ink-900 uppercase dark:text-paper"
    >
      <slot />
    </span>
  </button>
</template>

<style scoped>
/* Plain CSS glassmorphism (backdrop-filter), unlike SmokeButton's WebGL2
   plasma — a quieter secondary treatment sitting beside the primary CTA.
   Reduced transparency falls back to a solid card, same as GlassPanel. */
@media (prefers-reduced-transparency: reduce) {
  .glass-button {
    background-color: var(--color-surface-card);
    backdrop-filter: none;
  }
}
</style>
