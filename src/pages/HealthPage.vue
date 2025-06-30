<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-neutral-900">Health Metrics</h1>
        <p class="text-neutral-600 mt-1">Track and monitor your health data</p>
      </div>
    </div>

    <!-- Metric Type Filter -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="type in metricTypes"
        :key="type.value"
        @click="selectedType = selectedType === type.value ? null : type.value"
        :class="`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
          selectedType === type.value
            ? 'bg-primary-600 text-white'
            : 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50'
        }`"
      >
        {{ type.label }}
      </button>
    </div>

    <!-- Metrics List -->
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-if="healthStore.loading"
        v-for="i in 6"
        :key="i"
        class="animate-pulse"
      >
        <div class="metric-card">
          <div class="h-4 bg-neutral-200 rounded w-3/4 mb-3"></div>
          <div class="h-6 bg-neutral-200 rounded w-1/2 mb-2"></div>
          <div class="h-3 bg-neutral-200 rounded w-2/3"></div>
        </div>
      </div>

      <div v-else-if="filteredMetrics.length === 0" class="col-span-full">
        <div class="text-center py-12">
          <ClipboardDocumentListIcon
            class="w-16 h-16 text-neutral-800 mx-auto mb-4"
          />
          <h3 class="text-lg font-medium text-neutral-900 mb-2">
            No metrics found
          </h3>
          <p class="text-neutral-600 mb-6">
            {{
              selectedType
                ? 'No metrics of this type yet.'
                : 'No health metrics available to display.'
            }}
          </p>
        </div>
      </div>

      <div
        v-else
        v-for="metric in filteredMetrics"
        :key="metric.id"
        class="metric-card"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center space-x-3">
            <div
              class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"
            >
              <component
                :is="getMetricIcon(metric.metric_type)"
                class="w-5 h-5 text-primary-600"
              />
            </div>
            <div>
              <h3 class="font-medium text-neutral-900">
                {{ formatMetricType(metric.metric_type) }}
              </h3>
              <p class="text-sm text-neutral-500">
                {{ formatDate(metric.recorded_at) }}
              </p>
            </div>
          </div>
        </div>

        <div class="mb-3">
          <p class="text-2xl font-bold text-neutral-900">
            {{ formatMetricValue(metric) }}
          </p>
        </div>

        <div v-if="metric.notes" class="bg-neutral-50 rounded-lg p-3">
          <p class="text-sm text-neutral-600">{{ metric.notes }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  h,
  type Component,
} from 'vue';
import { useHealthStore } from '@/stores/health';
import { format } from 'date-fns';
import {
  ClipboardDocumentListIcon,
  HeartIcon,
  ScaleIcon,
  BeakerIcon,
  ClockIcon,
  FireIcon,
} from '@heroicons/vue/24/outline';
import type { MetricType, HealthMetric } from '@/types';

const healthStore = useHealthStore();

const selectedType = ref<MetricType | null>(null);

const metricTypes = [
  { value: 'blood_pressure' as MetricType, label: 'Blood Pressure' },
  { value: 'heart_rate' as MetricType, label: 'Heart Rate' },
  { value: 'weight' as MetricType, label: 'Weight' },
  { value: 'blood_sugar' as MetricType, label: 'Blood Sugar' },
  { value: 'temperature' as MetricType, label: 'Temperature' },
  { value: 'oxygen_saturation' as MetricType, label: 'Oxygen Saturation' },
  { value: 'steps' as MetricType, label: 'Steps' },
  { value: 'sleep_hours' as MetricType, label: 'Sleep Hours' },
  { value: 'exercise_minutes' as MetricType, label: 'Exercise Minutes' },
  { value: 'water_intake' as MetricType, label: 'Water Intake' },
  { value: 'mood_score' as MetricType, label: 'Mood Score' },
  { value: 'physical_effort' as MetricType, label: 'Physical Effort' },
];

const filteredMetrics = computed(() => {
  if (!selectedType.value) {
    return healthStore.metrics;
  }
  return healthStore.metrics.filter(
    (metric) => metric.metric_type === selectedType.value
  );
});

// Create a fallback component to ensure we never return null
const FallbackIcon = () => h('div', { class: 'w-5 h-5 bg-gray-300 rounded' });

const getMetricIcon = (type: MetricType): Component => {
  const icons: Partial<Record<MetricType, Component>> = {
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
    physical_effort: FireIcon,
  };

  // Return the specific icon or fallback to ClipboardDocumentListIcon or ultimate fallback
  return icons[type] || ClipboardDocumentListIcon || FallbackIcon;
};

const formatMetricType = (type: MetricType): string => {
  const labels: Record<MetricType, string> = {
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
    physical_effort: 'Physical Effort',
  };
  return labels[type] || type;
};

const formatMetricValue = (metric: HealthMetric): string => {
  if (
    metric.metric_type === 'blood_pressure' &&
    metric.systolic &&
    metric.diastolic
  ) {
    return `${metric.systolic}/${metric.diastolic} ${metric.unit}`;
  }
  return `${metric.value} ${metric.unit}`;
};

const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM d, yyyy HH:mm');
};

onMounted(async () => {
  await healthStore.fetchMetrics();
});
</script>
