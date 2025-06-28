import { healthMetricsService } from './healthMetricsService.js'

export function initializeHealthService(): void {
  console.log('Health service initialized successfully')
}

export { healthMetricsService }
export * from './routes/health.js' 