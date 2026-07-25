import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import Home2View from '@/views/Home2View.vue'
import Home3View from '@/views/Home3View.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: HomeView },
    { path: '/home2', name: 'home2', component: Home2View },
    { path: '/home3', name: 'home3', component: Home3View },
  ],
})

export default router
