<template>
  <div id="app" class="min-h-screen bg-neutral-50">
    <div class="home-bg" v-if="route.path !== '/'"></div>
    <div
      v-if="!authStore.initialized"
      class="flex items-center justify-center min-h-screen"
    >
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"
      ></div>
    </div>

    <template v-else>
      <div>
        <AppNavigation v-if="authStore.isAuthenticated" />

        <main :class="{ 'pl-64': authStore.isAuthenticated && !isMobile }">
          <router-view />
        </main>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import AppNavigation from '@/components/shared/AppNavigation.vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const authStore = useAuthStore();
const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024;
};

onMounted(async () => {
  await authStore.initialize();
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});
</script>

<style scoped>

.home-bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none; 
  background: url('@/assets/zhiyuan-sun-moixNMJcVk8-unsplash.jpg') center
    center/cover no-repeat;
  filter: blur(10px);
}


#app > *:not(.home-bg) {
  position: relative;
  z-index: 1;
}

.home-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.2);
  pointer-events: none;
}
</style>
