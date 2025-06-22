import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHealthStore } from '@/stores/health'
import { useAuthStore } from '@/stores/auth'
import { mockSupabaseClient, createMockUser } from '../mocks/supabase'
import type { HealthMetric, MetricType } from '@/types'

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn()
}))

describe('Health Store', () => {
  let mockAuthStore: any

  beforeEach(() => {
    setActivePinia(createPinia())
    
    mockAuthStore = {
      user: createMockUser()
    }
    ;(useAuthStore as any).mockReturnValue(mockAuthStore)
    
    vi.clearAllMocks()
  })

  describe('fetchMetrics', () => {
    it('should fetch all metrics successfully', async () => {
      // Arrange
      const mockMetrics: HealthMetric[] = [
        {
          id: 'metric-1',
          user_id: 'test-user-id',
          metric_type: 'blood_pressure' as MetricType,
          systolic: 120,
          diastolic: 80,
          unit: 'mmHg',
          recorded_at: '2024-01-01T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'metric-2',
          user_id: 'test-user-id',
          metric_type: 'heart_rate' as MetricType,
          value: 72,
          unit: 'bpm',
          recorded_at: '2024-01-01T11:00:00Z',
          created_at: '2024-01-01T11:00:00Z'
        }
      ]

      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockMetrics,
            error: null
          })
        })
      })

      const healthStore = useHealthStore()

      // Act
      const result = await healthStore.fetchMetrics()

      // Assert
      expect(healthStore.metrics).toEqual(mockMetrics)
      expect(result).toEqual(mockMetrics)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('health_metrics')
    })

    it('should fetch metrics filtered by type', async () => {
      // Arrange
      const heartRateMetrics: HealthMetric[] = [
        {
          id: 'metric-1',
          user_id: 'test-user-id',
          metric_type: 'heart_rate' as MetricType,
          value: 72,
          unit: 'bpm',
          recorded_at: '2024-01-01T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z'
        }
      ]

      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: heartRateMetrics,
              error: null
            })
          })
        })
      })

      const healthStore = useHealthStore()

      // Act
      const result = await healthStore.fetchMetrics('heart_rate')

      // Assert
      expect(result).toEqual(heartRateMetrics)
      // Should not replace all metrics when filtering
      expect(healthStore.metrics).toEqual([])
    })

    it('should handle fetch errors', async () => {
      // Arrange
      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      })

      const healthStore = useHealthStore()

      // Act & Assert
      await expect(healthStore.fetchMetrics()).rejects.toThrow('Database error')
    })

    it('should require authentication', async () => {
      // Arrange
      mockAuthStore.user = null
      const healthStore = useHealthStore()

      // Act
      const result = await healthStore.fetchMetrics()

      // Assert
      expect(result).toBeUndefined()
      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    })
  })

  describe('addMetric', () => {
    it('should add metric successfully', async () => {
      // Arrange
      const newMetric = {
        metric_type: 'weight' as MetricType,
        value: 70.5,
        unit: 'kg',
        recorded_at: '2024-01-01T10:00:00Z'
      }

      const createdMetric: HealthMetric = {
        id: 'metric-new',
        user_id: 'test-user-id',
        ...newMetric,
        created_at: '2024-01-01T10:00:00Z'
      }

      mockSupabaseClient.from().insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: createdMetric,
            error: null
          })
        })
      })

      const healthStore = useHealthStore()

      // Act
      const result = await healthStore.addMetric(newMetric)

      // Assert
      expect(result).toEqual(createdMetric)
      expect(healthStore.metrics[0]).toEqual(createdMetric)
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
        ...newMetric,
        user_id: 'test-user-id'
      })
    })

    it('should handle add errors', async () => {
      // Arrange
      mockSupabaseClient.from().insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Insert failed'))
        })
      })

      const healthStore = useHealthStore()

      // Act & Assert
      await expect(healthStore.addMetric({
        metric_type: 'weight' as MetricType,
        value: 70,
        unit: 'kg',
        recorded_at: '2024-01-01T10:00:00Z'
      })).rejects.toThrow('Insert failed')
    })

    it('should require authentication', async () => {
      // Arrange
      mockAuthStore.user = null
      const healthStore = useHealthStore()

      // Act & Assert
      await expect(healthStore.addMetric({
        metric_type: 'weight' as MetricType,
        value: 70,
        unit: 'kg',
        recorded_at: '2024-01-01T10:00:00Z'
      })).rejects.toThrow('Not authenticated')
    })
  })

  describe('updateMetric', () => {
    it('should update metric successfully', async () => {
      // Arrange
      const existingMetric: HealthMetric = {
        id: 'metric-1',
        user_id: 'test-user-id',
        metric_type: 'weight' as MetricType,
        value: 70,
        unit: 'kg',
        recorded_at: '2024-01-01T10:00:00Z',
        created_at: '2024-01-01T10:00:00Z'
      }

      const updatedMetric: HealthMetric = {
        ...existingMetric,
        value: 69.5
      }

      const healthStore = useHealthStore()
      healthStore.metrics = [existingMetric]

      mockSupabaseClient.from().update.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: updatedMetric,
              error: null
            })
          })
        })
      })

      // Act
      const result = await healthStore.updateMetric('metric-1', { value: 69.5 })

      // Assert
      expect(result).toEqual(updatedMetric)
      expect(healthStore.metrics[0]).toEqual(updatedMetric)
    })

    it('should handle update errors', async () => {
      // Arrange
      mockSupabaseClient.from().update.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Update failed'))
          })
        })
      })

      const healthStore = useHealthStore()

      // Act & Assert
      await expect(healthStore.updateMetric('metric-1', { value: 69.5 }))
        .rejects.toThrow('Update failed')
    })

    it('should require authentication', async () => {
      // Arrange
      mockAuthStore.user = null
      const healthStore = useHealthStore()

      // Act & Assert
      await expect(healthStore.updateMetric('metric-1', { value: 69.5 }))
        .rejects.toThrow('Not authenticated')
    })
  })

  describe('deleteMetric', () => {
    it('should delete metric successfully', async () => {
      // Arrange
      const existingMetrics: HealthMetric[] = [
        {
          id: 'metric-1',
          user_id: 'test-user-id',
          metric_type: 'weight' as MetricType,
          value: 70,
          unit: 'kg',
          recorded_at: '2024-01-01T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'metric-2',
          user_id: 'test-user-id',
          metric_type: 'heart_rate' as MetricType,
          value: 72,
          unit: 'bpm',
          recorded_at: '2024-01-01T11:00:00Z',
          created_at: '2024-01-01T11:00:00Z'
        }
      ]

      mockSupabaseClient.from().delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null
        })
      })

      const healthStore = useHealthStore()
      healthStore.metrics = [...existingMetrics]

      // Act
      await healthStore.deleteMetric('metric-1')

      // Assert
      expect(healthStore.metrics).toHaveLength(1)
      expect(healthStore.metrics[0].id).toBe('metric-2')
    })

    it('should handle delete errors', async () => {
      // Arrange
      mockSupabaseClient.from().delete.mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('Delete failed'))
      })

      const healthStore = useHealthStore()

      // Act & Assert
      await expect(healthStore.deleteMetric('metric-1'))
        .rejects.toThrow('Delete failed')
    })
  })

  describe('getMetricsForDateRange', () => {
    it('should fetch metrics within date range', async () => {
      // Arrange
      const mockMetrics: HealthMetric[] = [
        {
          id: '1',
          user_id: 'test-user-id',
          metric_type: 'heart_rate' as MetricType,
          value: 72,
          unit: 'bpm',
          recorded_at: '2024-01-01T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: '2',
          user_id: 'test-user-id',
          metric_type: 'heart_rate' as MetricType,
          value: 75,
          unit: 'bpm',
          recorded_at: '2024-01-02T10:00:00Z',
          created_at: '2024-01-02T10:00:00Z'
        }
      ]

      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockMetrics,
                error: null
              })
            })
          })
        })
      })

      const healthStore = useHealthStore()

      // Act
      const result = await healthStore.getMetricsForDateRange(
        'heart_rate' as MetricType,
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      )

      // Assert
      expect(result).toEqual(mockMetrics)
    })

    it('should handle empty results', async () => {
      // Arrange
      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      })

      const healthStore = useHealthStore()

      // Act
      const result = await healthStore.getMetricsForDateRange(
        'heart_rate' as MetricType,
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      )

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Latest Metrics', () => {
    it('should return latest metric for each type', async () => {
      // Arrange
      const mixedMetrics: HealthMetric[] = [
        {
          id: '1',
          user_id: 'test-user-id',
          metric_type: 'heart_rate' as MetricType,
          value: 72,
          unit: 'bpm',
          recorded_at: '2024-01-01T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: '2',
          user_id: 'test-user-id',
          metric_type: 'weight' as MetricType,
          value: 70,
          unit: 'kg',
          recorded_at: '2024-01-01T11:00:00Z',
          created_at: '2024-01-01T11:00:00Z'
        },
        {
          id: '3',
          user_id: 'test-user-id',
          metric_type: 'heart_rate' as MetricType,
          value: 75,
          unit: 'bpm',
          recorded_at: '2024-01-02T10:00:00Z',
          created_at: '2024-01-02T10:00:00Z'
        },
        {
          id: '4',
          user_id: 'test-user-id',
          metric_type: 'blood_pressure' as MetricType,
          systolic: 120,
          diastolic: 80,
          unit: 'mmHg',
          recorded_at: '2024-01-01T12:00:00Z',
          created_at: '2024-01-01T12:00:00Z'
        }
      ]

      const healthStore = useHealthStore()
      healthStore.metrics = mixedMetrics

      // Act
      const latestMetrics = healthStore.latestMetrics

      // Assert
      expect(Object.keys(latestMetrics)).toHaveLength(3) // One for each metric type
      expect(latestMetrics['heart_rate']?.value).toBe(75) // Latest heart rate
      expect(latestMetrics['weight']?.value).toBe(70)
      expect(latestMetrics['blood_pressure']?.systolic).toBe(120)
    })

    it('should handle empty metrics array', () => {
      // Arrange
      const healthStore = useHealthStore()
      healthStore.metrics = []

      // Act
      const latestMetrics = healthStore.latestMetrics

      // Assert
      expect(Object.keys(latestMetrics)).toHaveLength(0)
    })
  })

  describe('Computed Properties', () => {
    it('should group metrics by type correctly', () => {
      // Arrange
      const mixedMetrics = [
        { id: '1', metric_type: 'heart_rate' as MetricType, value: 72 },
        { id: '2', metric_type: 'weight' as MetricType, value: 70 },
        { id: '3', metric_type: 'heart_rate' as MetricType, value: 75 },
        { id: '4', metric_type: 'blood_pressure' as MetricType, systolic: 120, diastolic: 80 }
      ]

      const healthStore = useHealthStore()
      healthStore.metrics = mixedMetrics

      // Act
      const grouped = healthStore.metricsByType

      // Assert
      expect(grouped.heart_rate).toHaveLength(2)
      expect(grouped.weight).toHaveLength(1)
      expect(grouped.blood_pressure).toHaveLength(1)
      expect(grouped.heart_rate[0].value).toBe(72)
      expect(grouped.heart_rate[1].value).toBe(75)
    })

    it('should return latest metrics correctly', () => {
      // Arrange
      const metricsWithDates = [
        {
          id: '1',
          metric_type: 'heart_rate' as MetricType,
          value: 72,
          recorded_at: '2024-01-01T10:00:00Z'
        },
        {
          id: '2',
          metric_type: 'heart_rate' as MetricType,
          value: 75,
          recorded_at: '2024-01-02T10:00:00Z' // More recent
        },
        {
          id: '3',
          metric_type: 'weight' as MetricType,
          value: 70,
          recorded_at: '2024-01-01T11:00:00Z'
        }
      ]

      const healthStore = useHealthStore()
      healthStore.metrics = metricsWithDates

      // Act
      const latest = healthStore.latestMetrics

      // Assert
      expect(latest.heart_rate.id).toBe('2') // Most recent heart rate
      expect(latest.heart_rate.value).toBe(75)
      expect(latest.weight.id).toBe('3')
      expect(latest.weight.value).toBe(70)
    })
  })

  describe('Loading States', () => {
    it('should manage loading state correctly', async () => {
      // Arrange
      let resolvePromise: (value: any) => void
      const promise = new Promise(resolve => {
        resolvePromise = resolve
      })

      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(promise)
        })
      })

      const healthStore = useHealthStore()

      // Act - Start async operation
      const fetchPromise = healthStore.fetchMetrics()

      // Assert - Loading should be true
      expect(healthStore.loading).toBe(true)

      // Act - Complete async operation
      resolvePromise!({ data: [], error: null })
      await fetchPromise

      // Assert - Loading should be false
      expect(healthStore.loading).toBe(false)
    })
  })
})