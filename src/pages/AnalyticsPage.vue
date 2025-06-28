<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-neutral-900">Health Analytics</h1>
      <p class="text-neutral-600 mt-1">
        Analyze your health trends and patterns
      </p>
    </div>

    <!-- Time Range Filter -->
    <div class="flex flex-wrap items-center gap-4 mb-8">
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-neutral-700">Time Range:</label>
        <select
          v-model="selectedRange"
          class="input-field w-auto bg-neutral-50/50"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium text-neutral-700">Metric:</label>
        <select v-model="selectedMetric" class="input-field w-auto bg-neutral-50/50 ">
          <option value="">All metrics</option>
          <option
            v-for="type in availableMetrics"
            :key="type.value"
            :value="type.value"
          >
            {{ type.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div
        v-for="summary in summaryStats"
        :key="summary.title"
        class="metric-card card"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-neutral-600">
              {{ summary.title }}
            </p>
            <p class="text-2xl font-bold text-neutral-900 mt-1">
              {{ summary.value }}
            </p>
            <p
              v-if="summary.trend"
              :class="`text-sm mt-1 ${summary.trendColor}`"
            >
              {{ summary.trend }}
            </p>
          </div>
          <div
            :class="`w-12 h-12 rounded-lg flex items-center justify-center ${summary.bgColor}`"
          >
            <component
              :is="summary.icon"
              :class="`w-6 h-6 ${summary.iconColor}`"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- Trend Chart -->
      <div class="card">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-neutral-900">Health Trends</h2>
          <button class="text-sm text-primary-600 hover:text-primary-500">
            Export
          </button>
        </div>

        <div
          class="h-64 flex items-center justify-center bg-neutral-50/50 rounded-lg"
        >
          <div class="text-center">
            <ChartBarIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p class="text-neutral-500">Trend chart will appear here</p>
            <p class="text-sm text-neutral-400">Chart.js integration needed</p>
          </div>
        </div>
      </div>

      <!-- Distribution Chart -->
      <div class="card">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-neutral-900">
            Data Distribution
          </h2>
          <button class="text-sm text-primary-600 hover:text-primary-500">
            Export
          </button>
        </div>

        <div
          class="h-64 flex items-center justify-center bg-neutral-50/50 rounded-lg"
        >
          <div class="text-center">
            <ChartPieIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p class="text-neutral-500">Distribution chart will appear here</p>
            <p class="text-sm text-neutral-400">Chart.js integration needed</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Insights Section -->
    <div class="card">
      <h2 class="text-xl font-semibold text-neutral-900 mb-6">
        Health Insights
      </h2>

      <div class="space-y-4">
        <div
          v-for="insight in insights"
          :key="insight.id"
          class="flex items-start space-x-4 p-4 bg-neutral-50/50 rounded-lg"
        >
          <div
            :class="`w-10 h-10 rounded-lg flex items-center justify-center ${insight.bgColor}`"
          >
            <component
              :is="insight.icon"
              :class="`w-5 h-5 ${insight.iconColor}`"
            />
          </div>
          <div class="flex-1">
            <h3 class="font-medium text-neutral-900">{{ insight.title }}</h3>
            <p class="text-sm text-neutral-600 mt-1">
              {{ insight.description }}
            </p>
            <div
              class="flex items-center mt-2 space-x-4 text-xs text-neutral-500"
            >
              <span>{{ insight.metric }}</span>
              <span>•</span>
              <span>{{ insight.date }}</span>
            </div>
          </div>
          <div
            :class="`px-2 py-1 rounded-full text-xs ${insight.severityColor}`"
          >
            {{ insight.severity }}
          </div>
        </div>
      </div>
    </div>

    <!-- Data Export Section -->
    <div class="card mt-8">
      <h2 class="text-xl font-semibold text-neutral-900 mb-6">Export Data</h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          class="btn-outline flex items-center justify-center bg-neutral-50/50"
        >
          <DocumentArrowDownIcon class="w-5 h-5 mr-2" />
          Export CSV
        </button>
        <button
          class="btn-outline flex items-center justify-center bg-neutral-50/50"
        >
          <DocumentArrowDownIcon class="w-5 h-5 mr-2" />
          Export PDF Report
        </button>
        <button
          class="btn-outline flex items-center justify-center bg-neutral-50/50"
        >
          <ShareIcon class="w-5 h-5 mr-2" />
          Share with Doctor
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useHealthStore } from '@/stores/health';
import {
  ChartBarIcon,
  ChartPieIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  DocumentArrowDownIcon,
  ShareIcon,
  HeartIcon,
  ScaleIcon,
  ClockIcon,
  FireIcon,
} from '@heroicons/vue/24/outline';
import type { MetricType } from '@/types';

const healthStore = useHealthStore();

const selectedRange = ref('30d');
const selectedMetric = ref<MetricType | ''>('');

const availableMetrics = [
  { value: 'blood_pressure' as MetricType, label: 'Blood Pressure' },
  { value: 'heart_rate' as MetricType, label: 'Heart Rate' },
  { value: 'weight' as MetricType, label: 'Weight' },
  { value: 'blood_sugar' as MetricType, label: 'Blood Sugar' },
  { value: 'sleep_hours' as MetricType, label: 'Sleep Hours' },
  { value: 'steps' as MetricType, label: 'Steps' },
];

const summaryStats = ref([
  {
    title: 'Avg Blood Pressure',
    value: '118/78',
    trend: '↓ 2 mmHg vs last month',
    trendColor: 'text-success-600',
    icon: HeartIcon,
    bgColor: 'bg-error-100',
    iconColor: 'text-error-600',
  },
  {
    title: 'Weight Trend',
    value: '70.2 kg',
    trend: '↓ 0.8 kg vs last month',
    trendColor: 'text-success-600',
    icon: ScaleIcon,
    bgColor: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
  {
    title: 'Avg Sleep',
    value: '7.2 hrs',
    trend: '↑ 15 min vs last week',
    trendColor: 'text-success-600',
    icon: ClockIcon,
    bgColor: 'bg-secondary-100',
    iconColor: 'text-secondary-600',
  },
  {
    title: 'Daily Steps',
    value: '8,342',
    trend: '↑ 12% vs last week',
    trendColor: 'text-success-600',
    icon: FireIcon,
    bgColor: 'bg-accent-100',
    iconColor: 'text-accent-600',
  },
]);

const insights = ref([
  {
    id: 1,
    title: 'Blood Pressure Improvement',
    description:
      'Your blood pressure has shown consistent improvement over the last 2 weeks. Keep up the good work with your medication and lifestyle changes.',
    metric: 'Blood Pressure',
    date: '2 days ago',
    severity: 'Good',
    severityColor: 'bg-success-100 text-success-800',
    icon: CheckCircleIcon,
    bgColor: 'bg-success-100',
    iconColor: 'text-success-600',
  },
  {
    id: 2,
    title: 'Sleep Pattern Alert',
    description:
      'Your sleep duration has been below 7 hours for the past week. Consider improving your sleep hygiene for better health outcomes.',
    metric: 'Sleep Hours',
    date: '1 day ago',
    severity: 'Warning',
    severityColor: 'bg-warning-100 text-warning-800',
    icon: ExclamationTriangleIcon,
    bgColor: 'bg-warning-100',
    iconColor: 'text-warning-600',
  },
  {
    id: 3,
    title: 'Weight Tracking',
    description:
      "You're on track with your weight management goals. Your consistent tracking is helping maintain steady progress.",
    metric: 'Weight',
    date: '3 days ago',
    severity: 'Info',
    severityColor: 'bg-primary-100 text-primary-800',
    icon: InformationCircleIcon,
    bgColor: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
]);

onMounted(async () => {
  await healthStore.fetchMetrics();
});
</script>

<style scoped>
.card {
  background: rgba(255, 255, 255, 0.45);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-radius: 1rem;
  border-style: none;
  padding: 1.5rem;
  backdrop-filter: blur(2px);
}
</style>
