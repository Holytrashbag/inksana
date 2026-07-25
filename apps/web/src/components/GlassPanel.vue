<template>
  <!-- A slab of frosted glass: fully translucent so the backdrop blurs through,
       with an edge gloss, inset highlights for thickness, and a fine surface
       grain. Everything expressible as utilities lives here; the grain image and
       the reduced-transparency fallback are the only bits that can't. -->
  <div
    class="glass-panel relative isolate overflow-hidden rounded-frame border border-white/40 bg-transparent shadow-[var(--shadow-raised),inset_0_1px_0_rgb(255_255_255/0.65),inset_0_-1px_1px_rgb(13_12_11/0.05)] backdrop-blur-xs backdrop-saturate-[1.6]"
  >
    <!-- top-down gloss — the light catching the glass surface -->
    <div
      class="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgb(255_255_255/0.3),rgb(255_255_255/0)_45%)]"
    />
    <!-- fine grain frozen into the glass -->
    <div
      class="glass-grain pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
    />
    <div class="relative z-1">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* The only two things Tailwind utilities can't express: an SVG feTurbulence
   grain, and the prefers-reduced-transparency fallback (no Tailwind variant). */
.glass-grain {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

@media (prefers-reduced-transparency: reduce) {
  .glass-panel {
    background-color: var(--color-veil);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
