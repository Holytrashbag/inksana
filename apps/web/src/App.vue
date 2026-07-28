<script setup lang="ts">
import { RouterView } from 'vue-router'

import CustomCursor from '@/components/CustomCursor.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <ThemeToggle />
  <CustomCursor />
  <RouterView />
</template>
