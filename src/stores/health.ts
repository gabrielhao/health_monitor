import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { supabase } from '@/services/supabase'
import type { HealthMetric, MetricType } from '@/types'
import { useAuthStore } from './auth'

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
    
    Object.entries(metricsByType.value).forEach(([type, typeMetrics]) => {
      const sorted = [...typeMetrics].sort((a, b) => 
        new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      )
      if (sorted.length > 0) {
        latest[type as MetricType] = sorted[0]
      }
    })
    
    return latest
  })

  // Fetch metrics
  const fetchMetrics = async (metricType?: MetricType, limit?: number) => {
    if (!authStore.user) return

    try {
      loading.value = true
      
      let query = supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', authStore.user.id)
        .order('recorded_at', { ascending: false })

      if (metricType) {
        query = query.eq('metric_type', metricType)
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) throw error

      if (metricType || limit) {
        // If filtering, don't replace all metrics
        return data
      } else {
        metrics.value = data || []
      }
      
      return data
    } catch (error) {
      console.error('Error fetching metrics:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Add metric
  const addMetric = async (metricData: Omit<HealthMetric, 'id' | 'user_id' | 'created_at'>) => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      loading.value = true
      
      const { data, error } = await supabase
        .from('health_metrics')
        .insert({
          ...metricData,
          user_id: authStore.user.id,
        })
        .select()
        .single()

      if (error) throw error

      metrics.value.unshift(data)
      return data
    } catch (error) {
      console.error('Error adding metric:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Update metric
  const updateMetric = async (id: string, updates: Partial<HealthMetric>) => {
    try {
      loading.value = true
      
      const { data, error } = await supabase
        .from('health_metrics')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      const index = metrics.value.findIndex(m => m.id === id)
      if (index !== -1) {
        metrics.value[index] = data
      }

      return data
    } catch (error) {
      console.error('Error updating metric:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Delete metric
  const deleteMetric = async (id: string) => {
    try {
      loading.value = true
      
      const { error } = await supabase
        .from('health_metrics')
        .delete()
        .eq('id', id)

      if (error) throw error

      metrics.value = metrics.value.filter(m => m.id !== id)
    } catch (error) {
      console.error('Error deleting metric:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Get metrics for date range
  const getMetricsForDateRange = async (
    metricType: MetricType,
    startDate: string,
    endDate: string
  ) => {
    if (!authStore.user) return []

    try {
      const { data, error } = await supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', authStore.user.id)
        .eq('metric_type', metricType)
        .gte('recorded_at', startDate)
        .lte('recorded_at', endDate)
        .order('recorded_at', { ascending: true })

      if (error) throw error

      return data || []
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
    addMetric,
    updateMetric,
    deleteMetric,
    getMetricsForDateRange,
  }
})