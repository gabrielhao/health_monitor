<template>
  <nav
    class="fixed top-0 left-0 h-full w-64 bg-white/40  z-50 transform transition-transform duration-300 lg:translate-x-0"
    :class="{ '-translate-x-full': !isOpen && isMobile }"
  >
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div
        class="flex items-center justify-between pl-10 border-b border-neutral-200"
      >
        <div class="flex items-center space-x-3">
          <div class="w-24 h-24 rounded-lg flex items-center justify-center">

            <img
              src="@/assets/AIvital_logo.png"
              alt="Logo"
              class="w-24 h-24 object-contain"
            />
          </div>
        </div>
        <button
          @click="toggleNavigation"
          class="lg:hidden p-1 rounded-md hover:bg-white"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- Navigation Links -->
      <div class="flex-1 px-4 py-6">
        <ul class="space-y-2">
          <li v-for="item in navigationItems" :key="item.name">
            <router-link
              :to="item.to"
              class="flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200"
              :class="
                item.name === currentRoute
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              "
            >
              <component :is="item.icon" class="w-5 h-5 mr-3" />
              {{ item.name }}
            </router-link>
          </li>
        </ul>
      </div>

      <!-- User Profile -->
      <div class="p-4 border-t border-neutral-200">
        <div class="flex items-center space-x-3 mb-4">
          <div
            class="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center"
          >
            <UserIcon class="w-6 h-6 text-primary-600" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-neutral-900 truncate">
              {{ authStore.profile?.full_name || 'User' }}
            </p>
            <p class="text-xs text-neutral-500 truncate">
              {{ authStore.userEmail }}
            </p>
          </div>
        </div>
        <button
          @click="handleSignOut"
          class="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-200"
        >
          <ArrowRightOnRectangleIcon class="w-5 h-5 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  </nav>

  <!-- Mobile Overlay -->
  <div
    v-if="isOpen && isMobile"
    @click="closeNavigation"
    class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
  ></div>

  <!-- Mobile Menu Button -->
  <button
    v-if="isMobile"
    @click="toggleNavigation"
    class="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md lg:hidden"
  >
    <Bars3Icon class="w-6 h-6" />
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import {

  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  Bars3Icon,
  CloudArrowUpIcon,
  // DocumentTextIcon, // Removed unused icon
} from '@heroicons/vue/24/outline';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isOpen = ref(false);
const isMobile = ref(false);

const navigationItems = [
  { name: 'Dashboard', to: '/dashboard', icon: ChartBarIcon },
  { name: 'Health', to: '/health', icon: ClipboardDocumentListIcon },
  { name: 'Chat', to: '/chat', icon: ChatBubbleLeftRightIcon },
  { name: 'Analytics', to: '/analytics', icon: ChartBarIcon },
  { name: 'Import Data', to: '/import', icon: CloudArrowUpIcon },
//  { name: 'Import Documents', to: '/rag-import', icon: DocumentTextIcon },
  { name: 'Profile', to: '/profile', icon: Cog6ToothIcon },
];

const currentRoute = computed(() => {
  const matchedItem = navigationItems.find((item) => item.to === route.path);
  return matchedItem?.name || '';
});

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024;
  if (!isMobile.value) {
    isOpen.value = false;
  }
};

const toggleNavigation = () => {
  isOpen.value = !isOpen.value;
};

const closeNavigation = () => {
  isOpen.value = false;
};

const handleSignOut = async () => {
  try {
    await authStore.signOut();
    router.push('/');
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});
</script>
