<template>
  <div id="app" class="min-h-screen bg-neutral-50">
    <div v-if="!authStore.initialized" class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
    
    <template v-else>
      <AppNavigation v-if="authStore.isAuthenticated" />
      
      <main :class="{ 'pl-64': authStore.isAuthenticated && !isMobile }">
        <router-view />
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppNavigation from '@/components/shared/AppNavigation.vue'

const authStore = useAuthStore()
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

onMounted(async () => {
  await authStore.initialize()
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>