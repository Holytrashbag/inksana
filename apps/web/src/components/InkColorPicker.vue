<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import PillBadge from '@/components/PillBadge.vue'
import { INK_ACCENTS, neutralHex, useInkColor, type InkAccentName } from '@/composables/useInkColor'
import { useTheme } from '@/composables/useTheme'

type Slot = {
  key: string
  label: string
  hex: string
  isActive: boolean
  select: () => void
}

const { accent, setAccent, reset } = useInkColor()
const { isDark } = useTheme()

const open = ref(false)

function choose(name: InkAccentName | null): void {
  if (name) setAccent(name)
  else reset()
  open.value = false
}

// The neutral slot is never stored — it's always "grey on dark, ink on light"
// — so it's built fresh from the live theme rather than read from INK_ACCENTS.
const neutralSlot = computed<Slot>(() => ({
  key: 'neutral',
  label: isDark.value ? 'Grey' : 'Ink',
  hex: neutralHex(isDark.value),
  isActive: accent.value === null,
  select: () => choose(null),
}))

const accentSlots = computed<Slot[]>(() =>
  INK_ACCENTS.map((option) => ({
    key: option.name,
    label: option.label,
    hex: option.hex,
    isActive: accent.value === option.name,
    select: () => choose(option.name),
  })),
)

const slots = computed<Slot[]>(() => [neutralSlot.value, ...accentSlots.value])
const active = computed(() => accentSlots.value.find((s) => s.isActive) ?? neutralSlot.value)
const others = computed(() => slots.value.filter((s) => !s.isActive))

function onDocumentClick(event: MouseEvent): void {
  // Listening on 'click' (not 'pointerdown') guarantees a swatch's own click
  // handler — which sets the color and closes the menu itself — always runs
  // first: the DOM dispatches to the actual target before bubbling to
  // document, so this can only ever fire for genuinely outside clicks.
  // Checked via the marker attribute + closest() (not a component ref's
  // $el) so it depends only on the rendered DOM, not on PillBadge internals.
  const target = event.target as HTMLElement | null
  if (open.value && !target?.closest('[data-ink-picker]')) {
    open.value = false
  }
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!-- Sits beside the theme toggle, above the fixed WebGL canvas. Collapsed to
       just the active swatch; clicking it reveals the other accent options
       (see --color-accent-* in main.css) so the line color stays on the
       studio's palette rather than a free color picker. -->
  <PillBadge data-ink-picker class="right-20 gap-1.5 px-2">
    <button
      type="button"
      :aria-label="`Background line color: ${active.label}. Choose a different color.`"
      aria-haspopup="true"
      :aria-expanded="open"
      class="h-5 w-5 shrink-0 rounded-pill border border-ink-950 transition-transform dark:border-paper"
      :style="{ backgroundColor: active.hex }"
      @click="open = !open"
    />
    <template v-if="open">
      <button
        v-for="option in others"
        :key="option.key"
        type="button"
        :aria-label="`Set the background line color to ${option.label}`"
        class="h-5 w-5 shrink-0 rounded-pill border border-hairline transition-transform hover:scale-110"
        :style="{ backgroundColor: option.hex }"
        @click="option.select()"
      />
    </template>
  </PillBadge>
</template>
