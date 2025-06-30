import { backendHealthService } from '@/services/backendHealthService'
import { RAGService } from '@/services/ragService'
import type { HealthMetric, MetricType } from '@/types'
import type { HealthImportSession, HealthDocument, HealthProgressItem, HealthDataImport } from '@/types/health'
import type { RAGDocument, RAGImportSession } from '@/types/rag'
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
  
  // New state for document management and uploads
  const importSessions = ref<HealthImportSession[]>([])
  const documents = ref<HealthDocument[]>([])
  const uploadProgress = ref<HealthProgressItem[]>([])
  const processing = ref(false)

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
    // TODO: Get user ID from auth store
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
    
    // TODO: Get user ID from auth store
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
    
    // TODO: Get user ID from auth store
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
    
    // TODO: Get user ID from auth store
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


  // Get metrics for date range
  const getMetricsForDateRange = async (
    metricType: MetricType,
    startDate: string,
    endDate: string
  ) => {
    
    // TODO: Get user ID from auth store
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

  // Convert RAG types to Health types for consistency
  const convertRAGDocumentToHealth = (ragDoc: RAGDocument): HealthDocument => {
    return {
      id: ragDoc.id,
      user_id: ragDoc.user_id,
      source_app: ragDoc.metadata?.source_app || 'manual',
      document_type: ragDoc.contentType || 'unknown',
      title: ragDoc.originalFileName || ragDoc.documentId,
      content: '', // Not needed for listing
      metadata: {
        ...ragDoc.metadata,
        filesize: ragDoc.fileSize,
        contentType: ragDoc.contentType,
        originalFileName: ragDoc.originalFileName,
      },
      file_path: ragDoc.documentFilePath,
      import_session_id: ragDoc.metadata?.session_id,
      processed_at: ragDoc.isProcessed ? (
        ragDoc.uploadDate instanceof Date ? ragDoc.uploadDate.toISOString() : String(ragDoc.uploadDate)
      ) : undefined,
      created_at: ragDoc.uploadDate instanceof Date ? ragDoc.uploadDate.toISOString() : String(ragDoc.uploadDate),
      _partitionKey: ragDoc._partitionKey
    }
  }

  const convertRAGSessionToHealth = (ragSession: RAGImportSession): HealthImportSession => {
    return {
      id: ragSession.id,
      user_id: ragSession.user_id,
      source_app: 'rag_import',
      status: ragSession.status === 'processing' ? 'processing' : 
              ragSession.status === 'completed' ? 'completed' : 'failed',
      total_records: ragSession.total_files,
      processed_records: ragSession.processed_files,
      failed_records: ragSession.failed_files,
      error_log: ragSession.error_log.map(err => ({
        error: typeof err === 'string' ? err : err.error || 'Unknown error',
        timestamp: new Date().toISOString(),
        item: typeof err === 'object' && err.filename ? err.filename : undefined
      })),
      metadata: {
        total_chunks: ragSession.total_chunks,
        total_embeddings: ragSession.total_embeddings,
        type: 'document_import'
      },
      started_at: ragSession.started_at,
      completed_at: ragSession.completed_at,
      _partitionKey: ragSession._partitionKey
    }
  }

  // New methods for document management and uploads
  const fetchImportSessions = async () => {
    if (!authStore.user) return

    try {
      loading.value = true
      const userId = authStore.user.id || '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6'
      
      // Fetch RAG import sessions and convert to health format
      const ragSessions = await RAGService.getImportSessions(userId)
      importSessions.value = ragSessions.map(convertRAGSessionToHealth)
    } catch (error) {
      console.error('Error fetching import sessions:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchDocuments = async () => {
    if (!authStore.user) return

    try {
      loading.value = true
      const userId = authStore.user.id || '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6'
      
      // Add a small delay to ensure initialization completes
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Fetch RAG documents and convert to health format
      const ragDocs = await RAGService.getDocuments(userId)
      documents.value = ragDocs.map(convertRAGDocumentToHealth)
    } catch (error) {
      console.error('Error fetching documents:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const importHealthData = async (importData: HealthDataImport): Promise<HealthImportSession> => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      processing.value = true
      
      // Mock session for now
      const session: HealthImportSession = {
        id: `session-${Date.now()}`,
        user_id: authStore.user.id,
        source_app: importData.source,
        status: 'completed',
        total_records: importData.data.length,
        processed_records: importData.data.length,
        failed_records: 0,
        error_log: [],
        metadata: importData.metadata || {},
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        _partitionKey: authStore.user.id
      }

      importSessions.value.unshift(session)
      return session
    } catch (error) {
      console.error('Error importing health data:', error)
      throw error
    } finally {
      processing.value = false
    }
  }

  const deleteDocument = async (documentId: string) => {
    if (!authStore.user) return
    
    try {
      const userId = authStore.user.id || '34e40758-9f57-4bce-85c6-bfc4871e3b92.dada2b80-4552-4be6-a0ee-864f4f3c56f6'
      
      // Use RAGService to delete the document
      await RAGService.deleteDocument(documentId, userId)
      
      // Remove from local state
      const index = documents.value.findIndex(doc => doc.id === documentId)
      if (index !== -1) {
        documents.value.splice(index, 1)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }

  const clearProgress = () => {
    uploadProgress.value = []
  }

  // Document computed properties
  const totalDocuments = computed(() => documents.value.length)
  const completedDocuments = computed(() => 
    documents.value.filter(doc => doc.processed_at).length
  )
  const processingDocuments = computed(() => 
    documents.value.filter(doc => !doc.processed_at).length
  )

  return {
    // Existing properties
    metrics: readonly(metrics),
    loading: readonly(loading),
    metricsByType,
    latestMetrics,
    fetchMetrics,
    getMetricsCount,
    getMetricTypes,
    getAggregatedMetrics,
    getMetricsForDateRange,
    
    // New properties for document management
    importSessions: readonly(importSessions),
    documents: readonly(documents),
    uploadProgress: readonly(uploadProgress),
    processing: readonly(processing),
    totalDocuments,
    completedDocuments,
    processingDocuments,
    
    // New methods
    fetchImportSessions,
    fetchDocuments,
    importHealthData,
    deleteDocument,
    clearProgress,
  }
})