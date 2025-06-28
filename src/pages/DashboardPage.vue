<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-neutral-900">
        Welcome back, {{ authStore.profile?.full_name || 'User' }}
      </h1>
      <p class="text-neutral-600 mt-1">
        Here's your health overview for today
      </p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div v-for="stat in quickStats" :key="stat.title" class="metric-card">
        <div class="flex items-center">
          <div :class="`w-12 h-12 rounded-lg flex items-center justify-center ${stat.bgColor}`">
            <component :is="stat.icon" :class="`w-6 h-6 ${stat.iconColor}`" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-neutral-600">{{ stat.title }}</p>
            <p class="text-2xl font-bold text-neutral-900">{{ stat.value }}</p>
            <p v-if="stat.change" :class="`text-sm ${stat.changeColor}`">
              {{ stat.change }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- Recent Metrics -->
      <div class="card">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-neutral-900">Recent Metrics</h2>
          <router-link to="/health" class="text-sm text-primary-600 hover:text-primary-500">
            View all
          </router-link>
        </div>
        
        <div class="space-y-4">
          <div v-if="healthStore.loading" class="animate-pulse">
            <div v-for="i in 3" :key="i" class="flex items-center space-x-4">
              <div class="w-10 h-10 bg-neutral-200 rounded-lg"></div>
              <div class="flex-1">
                <div class="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-neutral-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
          
          <div v-else-if="recentMetrics.length === 0" class="text-center py-8">
            <ClipboardDocumentListIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p class="text-neutral-500">No metrics recorded yet</p>
            <router-link to="/health" class="btn-primary mt-4">
              Add your first metric
            </router-link>
          </div>
          
          <div v-else v-for="metric in recentMetrics" :key="metric.id" class="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <component :is="getMetricIcon(metric.metric_type)" class="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p class="font-medium text-neutral-900">{{ formatMetricType(metric.metric_type) }}</p>
                <p class="text-sm text-neutral-500">{{ formatMetricValue(metric) }}</p>
              </div>
            </div>
            <p class="text-xs text-neutral-400">{{ formatDate(metric.recorded_at) }}</p>
          </div>
        </div>
      </div>

      <!-- Chat Preview -->
      <div class="card">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-neutral-900">Health Assistant</h2>
          <router-link to="/chat" class="text-sm text-primary-600 hover:text-primary-500">
            Open chat
          </router-link>
        </div>

        <div class="space-y-4">
          <div v-if="chatStore.messages.length === 0" class="text-center py-8">
            <ChatBubbleLeftRightIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p class="text-neutral-500 mb-3">Start a conversation with your health assistant</p>
            <router-link to="/chat" class="btn-primary">
              Start chatting
            </router-link>
          </div>

          <div v-else>
            <div v-for="message in recentMessages" :key="message.id" class="flex items-start space-x-3">
              <div :class="`w-8 h-8 rounded-full flex items-center justify-center ${message.sender_type === 'ai' ? 'bg-secondary-100' : 'bg-primary-100'}`">
                <component :is="message.sender_type === 'ai' ? CpuChipIcon : UserIcon" :class="`w-4 h-4 ${message.sender_type === 'ai' ? 'text-secondary-600' : 'text-primary-600'}`" />
              </div>
              <div class="flex-1">
                <p class="text-sm text-neutral-900">{{ message.message }}</p>
                <p class="text-xs text-neutral-500 mt-1">{{ formatDate(message.created_at) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Health Trends Chart -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-neutral-900">Health Trends</h2>
        <router-link to="/analytics" class="text-sm text-primary-600 hover:text-primary-500">
          View analytics
        </router-link>
      </div>

      <div class="h-64 flex items-center justify-center bg-neutral-50 rounded-lg">
        <div class="text-center">
          <ChartBarIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <p class="text-neutral-500">Chart visualization will appear here</p>
          <p class="text-sm text-neutral-400">Add more metrics to see trends</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useHealthStore } from '@/stores/health'
import { useChatStore } from '@/stores/chat'
import { format } from 'date-fns'
import {
  HeartIcon,
  ScaleIcon,
  ClockIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  CpuChipIcon,
  BeakerIcon,
  FireIcon,
} from '@heroicons/vue/24/outline'
import type { MetricType } from '@/types'

const authStore = useAuthStore()
const healthStore = useHealthStore()
const chatStore = useChatStore()

const quickStats = ref([
  {
    title: 'Latest BP',
    value: '120/80',
    change: '+2 from last',
    changeColor: 'text-success-600',
    icon: HeartIcon,
    bgColor: 'bg-error-100',
    iconColor: 'text-error-600'
  },
  {
    title: 'Weight',
    value: '70.5 kg',
    change: '-0.5 kg',
    changeColor: 'text-success-600',
    icon: ScaleIcon,
    bgColor: 'bg-primary-100',
    iconColor: 'text-primary-600'
  },
  {
    title: 'Sleep',
    value: '7.5 hrs',
    change: '+30 min',
    changeColor: 'text-success-600',
    icon: ClockIcon,
    bgColor: 'bg-secondary-100',
    iconColor: 'text-secondary-600'
  },
  {
    title: 'Steps',
    value: '8,420',
    change: '84% of goal',
    changeColor: 'text-warning-600',
    icon: FireIcon,
    bgColor: 'bg-accent-100',
    iconColor: 'text-accent-600'
  }
])

const recentMetrics = computed(() => 
  healthStore.metrics.slice(0, 5)
)

const recentMessages = computed(() => 
  chatStore.messages.slice(-3)
)

const getMetricIcon = (type: MetricType) => {
  const icons = {
    blood_pressure: HeartIcon,
    heart_rate: HeartIcon,
    weight: ScaleIcon,
    blood_sugar: BeakerIcon,
    temperature: BeakerIcon,
    oxygen_saturation: HeartIcon,
    steps: FireIcon,
    sleep_hours: ClockIcon,
    exercise_minutes: FireIcon,
    water_intake: BeakerIcon,
    mood_score: HeartIcon,
  }
  return icons[type] || ClipboardDocumentListIcon
}

const formatMetricType = (type: MetricType): string => {
  const labels = {
    blood_pressure: 'Blood Pressure',
    heart_rate: 'Heart Rate',
    weight: 'Weight',
    blood_sugar: 'Blood Sugar',
    temperature: 'Temperature',
    oxygen_saturation: 'Oxygen Saturation',
    steps: 'Steps',
    sleep_hours: 'Sleep Hours',
    exercise_minutes: 'Exercise',
    water_intake: 'Water Intake',
    mood_score: 'Mood Score',
  }
  return labels[type] || type
}

const formatMetricValue = (metric: any): string => {
  if (metric.metric_type === 'blood_pressure' && metric.systolic && metric.diastolic) {
    return `${metric.systolic}/${metric.diastolic} mmHg`
  }
  return `${metric.value} ${metric.unit}`
}

const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM d, HH:mm')
}

onMounted(async () => {
  await Promise.all([
    healthStore.fetchMetrics(),
    chatStore.fetchMessages(5)
  ])
})
</script>