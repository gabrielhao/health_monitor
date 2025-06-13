export interface MemoryStats {
  used: number
  total: number
  percentage: number
  timestamp: Date
}

export interface MemoryAlert {
  level: 'warning' | 'critical'
  message: string
  timestamp: Date
  stats: MemoryStats
}

export class MemoryMonitor {
  private alerts: MemoryAlert[] = []
  private monitoring = false
  private interval?: number
  private warningThreshold = 0.8 // 80%
  private criticalThreshold = 0.9 // 90%
  private onAlert?: (alert: MemoryAlert) => void

  constructor(options: {
    warningThreshold?: number
    criticalThreshold?: number
    onAlert?: (alert: MemoryAlert) => void
  } = {}) {
    this.warningThreshold = options.warningThreshold || 0.8
    this.criticalThreshold = options.criticalThreshold || 0.9
    this.onAlert = options.onAlert
  }

  start(intervalMs = 5000) {
    if (this.monitoring) return

    this.monitoring = true
    this.interval = window.setInterval(() => {
      this.checkMemory()
    }, intervalMs)

    console.log('Memory monitoring started')
  }

  stop() {
    if (!this.monitoring) return

    this.monitoring = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = undefined
    }

    console.log('Memory monitoring stopped')
  }

  private async checkMemory() {
    try {
      const stats = await this.getMemoryStats()
      
      if (stats.percentage >= this.criticalThreshold) {
        this.createAlert('critical', `Critical memory usage: ${Math.round(stats.percentage * 100)}%`, stats)
      } else if (stats.percentage >= this.warningThreshold) {
        this.createAlert('warning', `High memory usage: ${Math.round(stats.percentage * 100)}%`, stats)
      }
    } catch (error) {
      console.error('Failed to check memory:', error)
    }
  }

  private async getMemoryStats(): Promise<MemoryStats> {
    // Use Performance API if available
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: memory.usedJSHeapSize / memory.totalJSHeapSize,
        timestamp: new Date()
      }
    }

    // Fallback estimation
    const estimatedUsed = this.estimateMemoryUsage()
    const estimatedTotal = 512 * 1024 * 1024 // Assume 512MB limit
    
    return {
      used: estimatedUsed,
      total: estimatedTotal,
      percentage: estimatedUsed / estimatedTotal,
      timestamp: new Date()
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation based on DOM elements and data structures
    const domElements = document.querySelectorAll('*').length
    const estimatedPerElement = 1000 // bytes per DOM element
    
    return domElements * estimatedPerElement
  }

  private createAlert(level: 'warning' | 'critical', message: string, stats: MemoryStats) {
    const alert: MemoryAlert = {
      level,
      message,
      timestamp: new Date(),
      stats
    }

    this.alerts.push(alert)
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    console.warn(`Memory Alert [${level.toUpperCase()}]: ${message}`)
    
    this.onAlert?.(alert)
  }

  getRecentAlerts(count = 10): MemoryAlert[] {
    return this.alerts.slice(-count)
  }

  getCurrentStats(): Promise<MemoryStats> {
    return this.getMemoryStats()
  }

  clearAlerts() {
    this.alerts = []
  }

  // Memory optimization utilities
  static forceGarbageCollection() {
    // Force garbage collection if available (Chrome DevTools)
    if ('gc' in window) {
      (window as any).gc()
      console.log('Forced garbage collection')
    }
  }

  static optimizeMemory() {
    // Clear caches and unused references
    
    // Clear image caches
    const images = document.querySelectorAll('img')
    images.forEach(img => {
      if (!img.isConnected) {
        img.src = ''
      }
    })

    // Clear event listeners on removed elements
    // This is automatically handled by modern browsers but good practice
    
    console.log('Memory optimization completed')
  }
}

export const memoryMonitor = new MemoryMonitor({
  onAlert: (alert) => {
    // Could integrate with notification system
    if (alert.level === 'critical') {
      // Take emergency action
      MemoryMonitor.forceGarbageCollection()
      MemoryMonitor.optimizeMemory()
    }
  }
})