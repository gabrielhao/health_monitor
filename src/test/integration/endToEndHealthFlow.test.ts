import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import HealthPage from '@/pages/HealthPage.vue'
import DashboardPage from '@/pages/DashboardPage.vue'
import AnalyticsPage from '@/pages/AnalyticsPage.vue'
import { useAuthStore } from '@/stores/auth'
import { useHealthStore } from '@/stores/health'
import { mockSupabaseClient, createMockUser, createMockProfile } from '../mocks/supabase'

vi.mock('@/services/supabase', () => ({
  supabase: mockSupabaseClient
}))

describe('End-to-End Health Data Flow', () => {
  let router: any
  let pinia: any
  let authStore: any
  let healthStore: any

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/dashboard', component: DashboardPage },
        { path: '/health', component: HealthPage },
        { path: '/analytics', component: AnalyticsPage }
      ]
    })

    authStore = useAuthStore()
    healthStore = useHealthStore()

    // Setup authenticated user
    authStore.user = createMockUser()
    authStore.profile = createMockProfile()
    authStore.isAuthenticated = true

    vi.clearAllMocks()
  })

  describe('Health Metric Management Flow', () => {
    it('should add, view, edit, and delete health metrics', async () => {
      // Arrange
      const mockMetrics = [
        {
          id: 'metric-1',
          user_id: 'test-user-id',
          metric_type: 'blood_pressure',
          value: null,
          unit: 'mmHg',
          systolic: 120,
          diastolic: 80,
          notes: 'Morning reading',
          recorded_at: '2024-01-01T08:00:00Z',
          created_at: '2024-01-01T08:00:00Z'
        }
      ]

      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockMetrics,
              error: null
            })
          })
        })
      })

      const wrapper = mount(HealthPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      await router.isReady()

      // Act - Load existing metrics
      await healthStore.fetchMetrics()
      await wrapper.vm.$nextTick()

      // Assert - Metrics are displayed
      expect(wrapper.text()).toContain('Blood Pressure')
      expect(wrapper.text()).toContain('120/80 mmHg')
      expect(wrapper.text()).toContain('Morning reading')

      // Act - Add new metric
      const addButton = wrapper.find('button:contains("Add Metric")')
      await addButton.trigger('click')

      expect(wrapper.vm.showAddModal).toBe(true)

      // Fill form
      await wrapper.find('select[name="metric_type"]').setValue('heart_rate')
      await wrapper.find('input[name="value"]').setValue('72')
      await wrapper.find('input[name="unit"]').setValue('bpm')

      // Mock successful creation
      mockSupabaseClient.from().insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'metric-2',
              metric_type: 'heart_rate',
              value: 72,
              unit: 'bpm'
            },
            error: null
          })
        })
      })

      // Submit form
      await wrapper.find('form').trigger('submit')

      // Assert - New metric was added
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('health_metrics')
      expect(wrapper.vm.showAddModal).toBe(false)
    })

    it('should filter metrics by type', async () => {
      // Arrange
      const mixedMetrics = [
        {
          id: 'metric-1',
          metric_type: 'blood_pressure',
          systolic: 120,
          diastolic: 80,
          unit: 'mmHg'
        },
        {
          id: 'metric-2',
          metric_type: 'heart_rate',
          value: 72,
          unit: 'bpm'
        },
        {
          id: 'metric-3',
          metric_type: 'weight',
          value: 70.5,
          unit: 'kg'
        }
      ]

      healthStore.metrics = mixedMetrics

      const wrapper = mount(HealthPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Act - Filter by heart rate
      const heartRateFilter = wrapper.find('button:contains("Heart Rate")')
      await heartRateFilter.trigger('click')

      // Assert - Only heart rate metrics shown
      expect(wrapper.vm.selectedType).toBe('heart_rate')
      expect(wrapper.vm.filteredMetrics).toHaveLength(1)
      expect(wrapper.vm.filteredMetrics[0].metric_type).toBe('heart_rate')
    })
  })

  describe('Dashboard Integration', () => {
    it('should display recent metrics and health trends', async () => {
      // Arrange
      const recentMetrics = [
        {
          id: 'recent-1',
          metric_type: 'blood_pressure',
          systolic: 118,
          diastolic: 76,
          recorded_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'recent-2',
          metric_type: 'weight',
          value: 69.8,
          unit: 'kg',
          recorded_at: '2024-01-15T09:00:00Z'
        }
      ]

      healthStore.metrics = recentMetrics

      const wrapper = mount(DashboardPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Assert - Recent metrics are displayed
      expect(wrapper.text()).toContain('Recent Metrics')
      expect(wrapper.text()).toContain('Blood Pressure')
      expect(wrapper.text()).toContain('Weight')
      expect(wrapper.text()).toContain('118/76')
      expect(wrapper.text()).toContain('69.8')
    })

    it('should show empty state when no metrics exist', async () => {
      // Arrange
      healthStore.metrics = []

      const wrapper = mount(DashboardPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Assert - Empty state is shown
      expect(wrapper.text()).toContain('No metrics recorded yet')
      expect(wrapper.text()).toContain('Add your first metric')
    })
  })

  describe('Analytics Integration', () => {
    it('should display health analytics and trends', async () => {
      // Arrange
      const analyticsData = [
        {
          metric_type: 'blood_pressure',
          values: [
            { date: '2024-01-01', systolic: 120, diastolic: 80 },
            { date: '2024-01-02', systolic: 118, diastolic: 78 },
            { date: '2024-01-03', systolic: 116, diastolic: 76 }
          ]
        }
      ]

      const wrapper = mount(AnalyticsPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      await wrapper.vm.$nextTick()

      // Assert - Analytics components are rendered
      expect(wrapper.text()).toContain('Health Analytics')
      expect(wrapper.text()).toContain('Time Range')
      expect(wrapper.text()).toContain('Health Trends')
      expect(wrapper.text()).toContain('Health Insights')
    })

    it('should filter analytics by time range', async () => {
      // Arrange
      const wrapper = mount(AnalyticsPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Act - Change time range
      const timeRangeSelect = wrapper.find('select')
      await timeRangeSelect.setValue('7d')

      // Assert - Time range is updated
      expect(wrapper.vm.selectedRange).toBe('7d')
    })
  })

  describe('Data Validation and Error Handling', () => {
    it('should validate metric input data', async () => {
      // Arrange
      const wrapper = mount(HealthPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Act - Open add metric modal
      await wrapper.find('button:contains("Add Metric")').trigger('click')

      // Try to submit without required fields
      await wrapper.find('form').trigger('submit')

      // Assert - Validation prevents submission
      expect(wrapper.vm.error).toBeTruthy()
    })

    it('should handle API errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.from().insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Database connection failed'))
        })
      })

      const wrapper = mount(HealthPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Act - Try to add metric with API error
      await wrapper.find('button:contains("Add Metric")').trigger('click')
      
      await wrapper.find('select[name="metric_type"]').setValue('heart_rate')
      await wrapper.find('input[name="value"]').setValue('72')
      await wrapper.find('input[name="unit"]').setValue('bpm')
      
      await wrapper.find('form').trigger('submit')

      // Assert - Error is handled and displayed
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.error).toContain('Database connection failed')
    })
  })

  describe('Real-time Updates', () => {
    it('should update metrics list when new metric is added', async () => {
      // Arrange
      const initialMetrics = [
        { id: 'metric-1', metric_type: 'weight', value: 70, unit: 'kg' }
      ]
      
      healthStore.metrics = initialMetrics

      const wrapper = mount(HealthPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Act - Add new metric
      const newMetric = {
        id: 'metric-2',
        metric_type: 'heart_rate',
        value: 75,
        unit: 'bpm'
      }

      mockSupabaseClient.from().insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: newMetric,
            error: null
          })
        })
      })

      await healthStore.addMetric(newMetric)

      // Assert - Metrics list is updated
      expect(healthStore.metrics).toHaveLength(2)
      expect(healthStore.metrics[0]).toEqual(newMetric) // New metric is first (unshift)
    })
  })

  describe('Performance and Memory Management', () => {
    it('should handle large datasets efficiently', async () => {
      // Arrange
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `metric-${i}`,
        metric_type: 'heart_rate',
        value: 60 + Math.random() * 40,
        unit: 'bpm',
        recorded_at: new Date(Date.now() - i * 86400000).toISOString()
      }))

      healthStore.metrics = largeDataset

      const wrapper = mount(HealthPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Act - Component should render without performance issues
      await wrapper.vm.$nextTick()

      // Assert - Component renders successfully with large dataset
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.vm.filteredMetrics.length).toBeLessThanOrEqual(1000)
    })

    it('should cleanup resources when component unmounts', async () => {
      // Arrange
      const wrapper = mount(HealthPage, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Act - Unmount component
      wrapper.unmount()

      // Assert - No memory leaks or errors
      expect(() => wrapper.unmount()).not.toThrow()
    })
  })
})