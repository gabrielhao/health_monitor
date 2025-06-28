export interface HealthMetricResponse {
  source: string
  unit: string
  value: number | string | undefined
  timestamp: string | Date
  metricType: string | undefined
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface HealthMetricsQueryOptions {
  metricType?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

class BackendHealthService {
  private baseUrl = 'http://localhost:3001/api/health'

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get health metrics for a user
   */
  async getHealthMetrics(
    userId: string,
    options: HealthMetricsQueryOptions = {}
  ): Promise<HealthMetricResponse[]> {
    const params = new URLSearchParams({ userId })
    
    if (options.metricType) {
      params.append('metricType', options.metricType)
    }
    if (options.startDate) {
      params.append('startDate', options.startDate.toISOString())
    }
    if (options.endDate) {
      params.append('endDate', options.endDate.toISOString())
    }
    if (options.limit) {
      params.append('limit', options.limit.toString())
    }

    const response = await this.makeRequest<ApiResponse<HealthMetricResponse[]>>(
      `?${params.toString()}`
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch health metrics')
    }

    return response.data || []
  }

  /**
   * Get metrics count for a user
   */
  async getMetricsCount(userId: string): Promise<number> {
    const response = await this.makeRequest<ApiResponse<{ count: number }>>(
      `/count?userId=${encodeURIComponent(userId)}`
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to get metrics count')
    }

    return response.data?.count || 0
  }

  /**
   * Get metric types for a user
   */
  async getMetricTypes(userId: string): Promise<string[]> {
    const response = await this.makeRequest<ApiResponse<{ types: string[] }>>(
      `/types?userId=${encodeURIComponent(userId)}`
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to get metric types')
    }

    return response.data?.types || []
  }

  /**
   * Get aggregated metrics
   */
  async getAggregatedMetrics(
    userId: string,
    metricType: string,
    aggregationType: 'avg' | 'sum' | 'min' | 'max' | 'count',
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<{ value: number; count: number }> {
    const params = new URLSearchParams({
      userId,
      metricType,
      aggregationType
    })

    if (options.startDate) {
      params.append('startDate', options.startDate.toISOString())
    }
    if (options.endDate) {
      params.append('endDate', options.endDate.toISOString())
    }

    const response = await this.makeRequest<ApiResponse<{ value: number; count: number }>>(
      `/aggregate?${params.toString()}`
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to get aggregated metrics')
    }

    return response.data || { value: 0, count: 0 }
  }
}

// Create and export a default instance
export const backendHealthService = new BackendHealthService() 