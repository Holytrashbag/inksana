<script setup lang="ts">
import { ref } from 'vue'

import GlassButton from '@/components/GlassButton.vue'
import GlassField from '@/components/GlassField.vue'
import GlassPanel from '@/components/GlassPanel.vue'

export type ContactFormPayload = { name: string; email: string; message: string }

const emit = defineEmits<{ submit: [payload: ContactFormPayload] }>()

const name = ref('')
const email = ref('')
const message = ref('')

function onSubmit() {
  emit('submit', { name: name.value, email: email.value, message: message.value })
}
</script>

<template>
  <GlassPanel class="mx-auto w-full max-w-narrow px-6 py-10 sm:px-10 sm:py-12">
    <form class="flex flex-col gap-6" novalidate @submit.prevent="onSubmit">
      <div class="flex flex-col gap-2">
        <p class="text-label text-ink-500 uppercase tracking-wider dark:text-ink-400">Contact</p>
        <h2 class="font-display text-display-sm text-ink-950 dark:text-paper">Get in Touch</h2>
      </div>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <GlassField id="contact-name" v-model="name" label="Name" autocomplete="name" required />
        <GlassField
          id="contact-email"
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          required
        />
      </div>
      <GlassField id="contact-message" v-model="message" label="Message" multiline required />
      <GlassButton type="submit" class="self-start">Send Message</GlassButton>
    </form>
  </GlassPanel>
</template>
