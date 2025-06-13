import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryMonitor, type MemoryAlert } from '@/services/memoryMonitor'

// Mock performance.memory
const mockMemory = {
  usedJSHeapSize: 50 * 1024 * 1024, // 50MB
  totalJSHeapSize: 100 * 1024 * 1024, // 100MB
  jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
}

Object.defineProperty(global, 'performance', {
  value: {
    memory: mockMemory
  },
  writable: true
})

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor
  let mockOnAlert: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnAlert = vi.fn()
    monitor = new MemoryMonitor({
      warningThreshold: 0.7,
      criticalThreshold: 0.9,
      onAlert: mockOnAlert
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    monitor.stop()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Memory Monitoring', () => {
    it('should start and stop monitoring correctly', () => {
      // Act
      monitor.start(1000)
      expect(monitor['monitoring']).toBe(true)

      monitor.stop()
      expect(monitor['monitoring']).toBe(false)
    })

    it('should not start monitoring if already running', () => {
      // Arrange
      monitor.start(1000)
      const firstInterval = monitor['interval']

      // Act
      monitor.start(1000)

      // Assert
      expect(monitor['interval']).toBe(firstInterval)
    })

    it('should get current memory stats', async () => {
      // Act
      const stats = await monitor.getCurrentStats()

      // Assert
      expect(stats).toHaveProperty('used')
      expect(stats).toHaveProperty('total')
      expect(stats).toHaveProperty('percentage')
      expect(stats).toHaveProperty('timestamp')
      expect(stats.percentage).toBe(0.5) // 50MB / 100MB
    })

    it('should trigger warning alert when threshold exceeded', async () => {
      // Arrange
      mockMemory.usedJSHeapSize = 75 * 1024 * 1024 // 75MB (75% usage)
      monitor.start(100)

      // Act
      await vi.advanceTimersByTimeAsync(150)

      // Assert
      expect(mockOnAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('High memory usage: 75%')
        })
      )
    })

    it('should trigger critical alert when threshold exceeded', async () => {
      // Arrange
      mockMemory.usedJSHeapSize = 95 * 1024 * 1024 // 95MB (95% usage)
      monitor.start(100)

      // Act
      await vi.advanceTimersByTimeAsync(150)

      // Assert
      expect(mockOnAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'critical',
          message: expect.stringContaining('Critical memory usage: 95%')
        })
      )
    })

    it('should not trigger alerts when usage is below threshold', async () => {
      // Arrange
      mockMemory.usedJSHeapSize = 30 * 1024 * 1024 // 30MB (30% usage)
      monitor.start(100)

      // Act
      await vi.advanceTimersByTimeAsync(150)

      // Assert
      expect(mockOnAlert).not.toHaveBeenCalled()
    })
  })

  describe('Alert Management', () => {
    it('should store and retrieve recent alerts', async () => {
      // Arrange
      mockMemory.usedJSHeapSize = 95 * 1024 * 1024 // Critical usage
      monitor.start(100)

      // Act
      await vi.advanceTimersByTimeAsync(150)
      const alerts = monitor.getRecentAlerts(5)

      // Assert
      expect(alerts).toHaveLength(1)
      expect(alerts[0]).toHaveProperty('level', 'critical')
      expect(alerts[0]).toHaveProperty('message')
      expect(alerts[0]).toHaveProperty('timestamp')
      expect(alerts[0]).toHaveProperty('stats')
    })

    it('should limit stored alerts to 100', async () => {
      // Arrange
      mockMemory.usedJSHeapSize = 95 * 1024 * 1024
      monitor.start(10) // Very frequent monitoring

      // Act
      await vi.advanceTimersByTimeAsync(1500) // Should generate many alerts

      const allAlerts = monitor.getRecentAlerts(200)

      // Assert
      expect(allAlerts.length).toBeLessThanOrEqual(100)
    })

    it('should clear alerts', async () => {
      // Arrange
      mockMemory.usedJSHeapSize = 95 * 1024 * 1024
      monitor.start(100)
      await vi.advanceTimersByTimeAsync(150)

      // Act
      monitor.clearAlerts()
      const alerts = monitor.getRecentAlerts()

      // Assert
      expect(alerts).toHaveLength(0)
    })
  })

  describe('Fallback Memory Estimation', () => {
    it('should estimate memory when performance.memory unavailable', async () => {
      // Arrange
      const originalMemory = (global.performance as any).memory
      delete (global.performance as any).memory

      // Mock DOM elements
      const mockQuerySelectorAll = vi.fn().mockReturnValue(
        new Array(1000).fill({}) // 1000 DOM elements
      )
      Object.defineProperty(document, 'querySelectorAll', {
        value: mockQuerySelectorAll,
        writable: true
      })

      // Act
      const stats = await monitor.getCurrentStats()

      // Assert
      expect(stats.used).toBe(1000 * 1000) // 1000 elements * 1000 bytes
      expect(stats.total).toBe(512 * 1024 * 1024) // 512MB default
      expect(stats.percentage).toBeCloseTo(0.00190735) // ~0.19%

      // Restore
      ;(global.performance as any).memory = originalMemory
    })
  })

  describe('Memory Optimization Utilities', () => {
    it('should force garbage collection when available', () => {
      // Arrange
      const mockGC = vi.fn()
      ;(global as any).gc = mockGC

      // Act
      MemoryMonitor.forceGarbageCollection()

      // Assert
      expect(mockGC).toHaveBeenCalled()

      // Cleanup
      delete (global as any).gc
    })

    it('should handle missing garbage collection gracefully', () => {
      // Arrange
      delete (global as any).gc

      // Act & Assert
      expect(() => MemoryMonitor.forceGarbageCollection()).not.toThrow()
    })

    it('should optimize memory by clearing image caches', () => {
      // Arrange
      const mockImages = [
        { isConnected: false, src: 'old-image.jpg' },
        { isConnected: true, src: 'current-image.jpg' },
        { isConnected: false, src: 'another-old-image.jpg' }
      ]

      const mockQuerySelectorAll = vi.fn().mockReturnValue(mockImages)
      Object.defineProperty(document, 'querySelectorAll', {
        value: mockQuerySelectorAll,
        writable: true
      })

      // Act
      MemoryMonitor.optimizeMemory()

      // Assert
      expect(mockImages[0].src).toBe('')
      expect(mockImages[1].src).toBe('current-image.jpg') // Should not be cleared
      expect(mockImages[2].src).toBe('')
    })
  })

  describe('Error Handling', () => {
    it('should handle errors in memory checking gracefully', async () => {
      // Arrange
      const originalMemory = (global.performance as any).memory
      ;(global.performance as any).memory = null

      const mockQuerySelectorAll = vi.fn().mockImplementation(() => {
        throw new Error('DOM access error')
      })
      Object.defineProperty(document, 'querySelectorAll', {
        value: mockQuerySelectorAll,
        writable: true
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      monitor.start(100)

      // Act
      await vi.advanceTimersByTimeAsync(150)

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to check memory:',
        expect.any(Error)
      )

      // Cleanup
      ;(global.performance as any).memory = originalMemory
      consoleSpy.mockRestore()
    })
  })

  describe('Configuration', () => {
    it('should use default thresholds when not specified', () => {
      // Arrange
      const defaultMonitor = new MemoryMonitor()

      // Assert
      expect(defaultMonitor['warningThreshold']).toBe(0.8)
      expect(defaultMonitor['criticalThreshold']).toBe(0.9)
    })

    it('should use custom thresholds when specified', () => {
      // Arrange
      const customMonitor = new MemoryMonitor({
        warningThreshold: 0.6,
        criticalThreshold: 0.8
      })

      // Assert
      expect(customMonitor['warningThreshold']).toBe(0.6)
      expect(customMonitor['criticalThreshold']).toBe(0.8)
    })
  })
})