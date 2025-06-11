<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-neutral-900">Health Metrics</h1>
        <p class="text-neutral-600 mt-1">Track and monitor your health data</p>
      </div>
      <button @click="showAddModal = true" class="btn-primary">
        <PlusIcon class="w-5 h-5 mr-2" />
        Add Metric
      </button>
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
      <div v-if="healthStore.loading" v-for="i in 6" :key="i" class="animate-pulse">
        <div class="metric-card">
          <div class="h-4 bg-neutral-200 rounded w-3/4 mb-3"></div>
          <div class="h-6 bg-neutral-200 rounded w-1/2 mb-2"></div>
          <div class="h-3 bg-neutral-200 rounded w-2/3"></div>
        </div>
      </div>

      <div v-else-if="filteredMetrics.length === 0" class="col-span-full">
        <div class="text-center py-12">
          <ClipboardDocumentListIcon class="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <h3 class="text-lg font-medium text-neutral-900 mb-2">No metrics found</h3>
          <p class="text-neutral-500 mb-6">
            {{ selectedType ? 'No metrics of this type yet.' : 'Start tracking your health by adding your first metric.' }}
          </p>
          <button @click="showAddModal = true" class="btn-primary">
            Add First Metric
          </button>
        </div>
      </div>

      <div v-else v-for="metric in filteredMetrics" :key="metric.id" class="metric-card group">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <component :is="getMetricIcon(metric.metric_type)" class="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 class="font-medium text-neutral-900">{{ formatMetricType(metric.metric_type) }}</h3>
              <p class="text-sm text-neutral-500">{{ formatDate(metric.recorded_at) }}</p>
            </div>
          </div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button @click="editMetric(metric)" class="p-1 text-neutral-400 hover:text-neutral-600">
              <PencilIcon class="w-4 h-4" />
            </button>
            <button @click="deleteMetricConfirm(metric)" class="p-1 text-neutral-400 hover:text-red-600 ml-1">
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="mb-3">
          <p class="text-2xl font-bold text-neutral-900">{{ formatMetricValue(metric) }}</p>
        </div>

        <div v-if="metric.notes" class="bg-neutral-50 rounded-lg p-3">
          <p class="text-sm text-neutral-600">{{ metric.notes }}</p>
        </div>
      </div>
    </div>

    <!-- Add/Edit Metric Modal -->
    <div v-if="showAddModal || editingMetric" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">
          {{ editingMetric ? 'Edit Metric' : 'Add New Metric' }}
        </h3>

        <form @submit.prevent="handleSubmit">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">
                Metric Type
              </label>
              <select v-model="form.metric_type" class="input-field" required>
                <option value="" disabled>Select metric type</option>
                <option v-for="type in metricTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>

            <div v-if="form.metric_type === 'blood_pressure'" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Systolic
                </label>
                <input
                  v-model.number="form.systolic"
                  type="number"
                  class="input-field"
                  placeholder="120"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Diastolic  
                </label>
                <input
                  v-model.number="form.diastolic"
                  type="number"
                  class="input-field"
                  placeholder="80"
                  required
                />
              </div>
            </div>

            <div v-else>
              <label class="block text-sm font-medium text-neutral-700 mb-1">
                Value
              </label>
              <input
                v-model.number="form.value"
                type="number"
                step="0.1"
                class="input-field"
                placeholder="Enter value"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">
                Unit
              </label>
              <input
                v-model="form.unit"
                type="text"
                class="input-field"
                :placeholder="getDefaultUnit(form.metric_type)"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">
                Date & Time
              </label>
              <input
                v-model="form.recorded_at"
                type="datetime-local"
                class="input-field"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                v-model="form.notes"
                rows="3"
                class="input-field"
                placeholder="Add any additional notes..."
              ></textarea>
            </div>
          </div>

          <div v-if="error" class="mt-4 bg-error-50 border border-error-200 rounded-lg p-3">
            <p class="text-sm text-error-700">{{ error }}</p>
          </div>

          <div class="flex space-x-3 mt-6">
            <button type="submit" :disabled="loading" class="btn-primary flex-1">
              <div v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {{ editingMetric ? 'Update' : 'Add' }} Metric
            </button>
            <button type="button" @click="closeModal" class="btn-outline flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deletingMetric" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">Delete Metric</h3>
        <p class="text-neutral-600 mb-6">
          Are you sure you want to delete this metric? This action cannot be undone.
        </p>
        <div class="flex space-x-3">
          <button @click="confirmDelete" :disabled="loading" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1">
            Delete
          </button>
          <button @click="deletingMetric = null" class="btn-outline flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useHealthStore } from '@/stores/health'
import { format } from 'date-fns'
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  HeartIcon,
  ScaleIcon,
  BeakerIcon,
  ClockIcon,
  FireIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import type { MetricType, HealthMetric } from '@/types'

const healthStore = useHealthStore()

const showAddModal = ref(false)
const editingMetric = ref<HealthMetric | null>(null)
const deletingMetric = ref<HealthMetric | null>(null)
const selectedType = ref<MetricType | null>(null)
const loading = ref(false)
const error = ref('')

const form = reactive({
  metric_type: '' as MetricType,
  value: 0,
  unit: '',
  systolic: 0,
  diastolic: 0,
  notes: '',
  recorded_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
})

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
]

const filteredMetrics = computed(() => {
  if (!selectedType.value) {
    return healthStore.metrics
  }
  return healthStore.metrics.filter(metric => metric.metric_type === selectedType.value)
})

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

const formatMetricValue = (metric: HealthMetric): string => {
  if (metric.metric_type === 'blood_pressure' && metric.systolic && metric.diastolic) {
    return `${metric.systolic}/${metric.diastolic} ${metric.unit}`
  }
  return `${metric.value} ${metric.unit}`
}

const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM d, yyyy HH:mm')
}

const getDefaultUnit = (type: MetricType): string => {
  const units = {
    blood_pressure: 'mmHg',
    heart_rate: 'bpm',
    weight: 'kg',
    blood_sugar: 'mg/dL',
    temperature: '°C',
    oxygen_saturation: '%',
    steps: 'steps',
    sleep_hours: 'hours',
    exercise_minutes: 'minutes',
    water_intake: 'L',
    mood_score: '/10',
  }
  return units[type] || ''
}

const resetForm = () => {
  form.metric_type = '' as MetricType
  form.value = 0
  form.unit = ''
  form.systolic = 0
  form.diastolic = 0
  form.notes = ''
  form.recorded_at = format(new Date(), "yyyy-MM-dd'T'HH:mm")
}

const editMetric = (metric: HealthMetric) => {
  editingMetric.value = metric
  form.metric_type = metric.metric_type
  form.value = metric.value || 0
  form.unit = metric.unit
  form.systolic = metric.systolic || 0
  form.diastolic = metric.diastolic || 0
  form.notes = metric.notes || ''
  form.recorded_at = format(new Date(metric.recorded_at), "yyyy-MM-dd'T'HH:mm")
}

const deleteMetricConfirm = (metric: HealthMetric) => {
  deletingMetric.value = metric
}

const confirmDelete = async () => {
  if (!deletingMetric.value) return

  try {
    loading.value = true
    await healthStore.deleteMetric(deletingMetric.value.id)
    deletingMetric.value = null
  } catch (err: any) {
    error.value = err.message || 'Failed to delete metric'
  } finally {
    loading.value = false
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingMetric.value = null
  error.value = ''
  resetForm()
}

const handleSubmit = async () => {
  error.value = ''

  try {
    loading.value = true

    const metricData = {
      metric_type: form.metric_type,
      value: form.metric_type === 'blood_pressure' ? null : form.value,
      unit: form.unit,
      systolic: form.metric_type === 'blood_pressure' ? form.systolic : null,
      diastolic: form.metric_type === 'blood_pressure' ? form.diastolic : null,
      notes: form.notes || null,
      recorded_at: new Date(form.recorded_at).toISOString(),
    }

    if (editingMetric.value) {
      await healthStore.updateMetric(editingMetric.value.id, metricData)
    } else {
      await healthStore.addMetric(metricData)
    }

    closeModal()
  } catch (err: any) {
    error.value = err.message || 'Failed to save metric'
  } finally {
    loading.value = false
  }
}

// Auto-set unit when metric type changes
watch(() => form.metric_type, (newType) => {
  if (newType) {
    form.unit = getDefaultUnit(newType)
  }
})

onMounted(async () => {
  await healthStore.fetchMetrics()
})
</script>