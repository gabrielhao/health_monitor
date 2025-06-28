import { backendHealthService } from '@/services/backendHealthService'
import type { HealthMetric, MetricType } from '@/types'
import { defineStore } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { useAuthStore } from './auth'

// Helper function to convert backend response to frontend HealthMetric format
const mapBackendToFrontendMetric = (backendMetric: any): HealthMetric => {
  return {
    id: backendMetric.id || `${backendMetric.metricType}-${backendMetric.timestamp}`,
    user_id: backendMetric.userId || '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6',
    metric_type: backendMetric.metricType as MetricType,
    value: typeof backendMetric.value === 'number' ? backendMetric.value : parseFloat(backendMetric.value?.toString() || '0'),
    unit: backendMetric.unit || '',
    systolic: backendMetric.systolic,
    diastolic: backendMetric.diastolic,
    notes: backendMetric.notes,
    recorded_at: typeof backendMetric.timestamp === 'string' ? backendMetric.timestamp : backendMetric.timestamp?.toISOString() || new Date().toISOString(),
    created_at: typeof backendMetric.timestamp === 'string' ? backendMetric.timestamp : backendMetric.timestamp?.toISOString() || new Date().toISOString(),
  }
}

export const useHealthStore = defineStore('health', () => {
  const authStore = useAuthStore()
  
  const metrics = ref<HealthMetric[]>([])
  const loading = ref(false)

  const metricsByType = computed(() => {
    const grouped: Record<MetricType, HealthMetric[]> = {} as Record<MetricType, HealthMetric[]>
    
    metrics.value.forEach(metric => {
      if (!grouped[metric.metric_type]) {
        grouped[metric.metric_type] = []
      }
      grouped[metric.metric_type].push(metric)
    })
    
    return grouped
  })

  const latestMetrics = computed(() => {
    const latest: Record<MetricType, HealthMetric> = {} as Record<MetricType, HealthMetric>
    
    Object.entries(metricsByType.value).forEach(([metricType, typeMetrics]) => {
      const sorted = [...typeMetrics].sort((a, b) => 
        new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      )
      if (sorted.length > 0) {
        latest[metricType as MetricType] = sorted[0]
      }
    })
    
    return latest
  })

  // Fetch metrics from backend
  const fetchMetrics = async (metricType?: MetricType, limit?: number) => {
    // Get user ID from auth store with fallback
    const userId = /* authStore.user?.id || */ '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6'
    
    console.log('Using user ID for health metrics:', userId)
    console.log('Auth store user:', authStore.user)
    console.log('Auth store profile:', authStore.profile)

    try {
      loading.value = true
      
      const options: any = {}
      if (metricType) {
        options.metricType = metricType
      }
      if (limit) {
        options.limit = limit
      }

      const backendMetrics = await backendHealthService.getHealthMetrics(userId, options)
      const frontendMetrics = backendMetrics.map(mapBackendToFrontendMetric)

      if (metricType || limit) {
        // If filtering, don't replace all metrics
        return frontendMetrics
      } else {
        metrics.value = frontendMetrics
      }
      
      return frontendMetrics
    } catch (error) {
      console.error('Error fetching metrics:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Get metrics count from backend
  const getMetricsCount = async (): Promise<number> => {
    const userId = /* authStore.user?.id || */ '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6'

    try {
      return await backendHealthService.getMetricsCount(userId)
    } catch (error) {
      console.error('Error getting metrics count:', error)
      return 0
    }
  }

  // Get metric types from backend
  const getMetricTypes = async (): Promise<string[]> => {
    const userId = /* authStore.user?.id || */ '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6'

    try {
      return await backendHealthService.getMetricTypes(userId)
    } catch (error) {
      console.error('Error getting metric types:', error)
      return []
    }
  }

  // Get aggregated metrics from backend
  const getAggregatedMetrics = async (
    metricType: MetricType,
    aggregationType: 'avg' | 'sum' | 'min' | 'max' | 'count',
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<{ value: number; count: number }> => {
    const userId = /* authStore.user?.id || */ '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6'

    try {
      return await backendHealthService.getAggregatedMetrics(
        userId,
        metricType,
        aggregationType,
        options
      )
    } catch (error) {
      console.error('Error getting aggregated metrics:', error)
      return { value: 0, count: 0 }
    }
  }

  // Placeholder functions for future implementation
  const addMetric = async (metricData: Omit<HealthMetric, 'id' | 'user_id' | 'created_at'>) => {
    console.warn('Add metric not implemented yet - backend POST endpoint needed')
    throw new Error('Add metric not implemented yet')
  }

  const updateMetric = async (id: string, updates: Partial<HealthMetric>) => {
    console.warn('Update metric not implemented yet - backend PUT endpoint needed')
    throw new Error('Update metric not implemented yet')
  }

  const deleteMetric = async (id: string) => {
    console.warn('Delete metric not implemented yet - backend DELETE endpoint needed')
    throw new Error('Delete metric not implemented yet')
  }

  // Get metrics for date range
  const getMetricsForDateRange = async (
    metricType: MetricType,
    startDate: string,
    endDate: string
  ) => {
    const userId = /* authStore.user?.id || */ '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6'

    try {
      const backendMetrics = await backendHealthService.getHealthMetrics(userId, {
        metricType,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      })
      
      return backendMetrics.map(mapBackendToFrontendMetric)
    } catch (error) {
      console.error('Error fetching metrics for date range:', error)
      throw error
    }
  }

  return {
    metrics: readonly(metrics),
    loading: readonly(loading),
    metricsByType,
    latestMetrics,
    fetchMetrics,
    getMetricsCount,
    getMetricTypes,
    getAggregatedMetrics,
    addMetric,
    updateMetric,
    deleteMetric,
    getMetricsForDateRange,
  }
})