<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    label: string
    type?: 'text' | 'email' | 'tel'
    multiline?: boolean
    placeholder?: string
    autocomplete?: string
    required?: boolean
  }>(),
  {
    type: 'text',
    multiline: false,
    placeholder: undefined,
    autocomplete: undefined,
    required: false,
  },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="flex flex-col gap-2">
    <label :for="id" class="text-label text-ink-500 uppercase tracking-wider dark:text-ink-400">
      {{ label }}
    </label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      rows="5"
      class="w-full resize-none rounded-lg border border-hairline/40 bg-surface-card/25 px-4 py-3 text-body-md text-ink-950 shadow-carved outline-none transition-shadow duration-150 ease-out placeholder:text-ink-400 focus:shadow-carved-focus dark:border-hairline/20 dark:bg-surface-card/10 dark:text-paper dark:placeholder:text-ink-500"
    />
    <input
      v-else
      :id="id"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      class="w-full rounded-lg border border-hairline/40 bg-surface-card/25 px-4 py-3 text-body-md text-ink-950 shadow-carved outline-none transition-shadow duration-150 ease-out placeholder:text-ink-400 focus:shadow-carved-focus dark:border-hairline/20 dark:bg-surface-card/10 dark:text-paper dark:placeholder:text-ink-500"
    />
  </div>
</template>
