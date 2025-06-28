import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/pages/HomePage.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/pages/DashboardPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/health',
      name: 'Health',
      component: () => import('@/pages/HealthPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/chat',
      name: 'Chat',
      component: () => import('@/pages/ChatPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/analytics',
      name: 'Analytics',
      component: () => import('@/pages/AnalyticsPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'Profile',
      component: () => import('@/pages/ProfilePage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/import',
      name: 'DataImport',
      component: () => import('@/pages/DataImportPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/rag-import',
      name: 'RAGImport',
      component: () => import('@/pages/RAGImportPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/pages/NotFoundPage.vue')
    }
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  
  // Wait for auth to initialize
  if (!authStore.initialized) {
    await authStore.initialize()
  }

  if (to.name === 'Home') {
    return true
  }

  // Check auth requirements
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Home' }
  }
})

export default router