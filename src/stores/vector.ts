import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { VectorService } from '@/services/vectorService'
import type { 
  HealthDocument, 
  ImportSession, 
  DataSource, 
  SimilarContent,
  HealthDataImport 
} from '@/types/vector'
import { useAuthStore } from './auth'

export const useVectorStore = defineStore('vector', () => {
  const authStore = useAuthStore()
  
  const healthDocuments = ref<HealthDocument[]>([])
  const importSessions = ref<ImportSession[]>([])
  const dataSources = ref<DataSource[]>([])
  const similarContent = ref<SimilarContent[]>([])
  const loading = ref(false)
  const importing = ref(false)

  const documentsBySource = computed(() => {
    const grouped: Record<string, HealthDocument[]> = {}
    
    healthDocuments.value.forEach(doc => {
      if (!grouped[doc.source_app]) {
        grouped[doc.source_app] = []
      }
      grouped[doc.source_app].push(doc)
    })
    
    return grouped
  })

  const activeDataSources = computed(() => 
    dataSources.value.filter(source => source.is_active)
  )

  const recentImports = computed(() => 
    importSessions.value.slice(0, 5)
  )

  // Health Documents
  const fetchHealthDocuments = async (filters?: {
    source_app?: string
    document_type?: string
    limit?: number
  }) => {
    if (!authStore.user) return

    try {
      loading.value = true
      const documents = await VectorService.getHealthDocuments(authStore.user.id, filters)
      
      if (filters) {
        // If filtering, don't replace all documents
        return documents
      } else {
        healthDocuments.value = documents
      }
      
      return documents
    } catch (error) {
      console.error('Error fetching health documents:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const createHealthDocument = async (document: Omit<HealthDocument, 'id' | 'user_id' | 'created_at'>) => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      const newDocument = await VectorService.createHealthDocument({
        ...document,
        user_id: authStore.user.id
      })
      
      healthDocuments.value.unshift(newDocument)
      return newDocument
    } catch (error) {
      console.error('Error creating health document:', error)
      throw error
    }
  }

  // Import Sessions
  const fetchImportSessions = async () => {
    if (!authStore.user) return

    try {
      loading.value = true
      const sessions = await VectorService.getImportSessions(authStore.user.id)
      importSessions.value = sessions
      return sessions
    } catch (error) {
      console.error('Error fetching import sessions:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const importHealthData = async (importData: HealthDataImport) => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      importing.value = true
      const session = await VectorService.importHealthData(authStore.user.id, importData)
      
      // Add to sessions and refresh documents
      importSessions.value.unshift(session)
      await fetchHealthDocuments()
      
      return session
    } catch (error) {
      console.error('Error importing health data:', error)
      throw error
    } finally {
      importing.value = false
    }
  }

  // Data Sources
  const fetchDataSources = async () => {
    if (!authStore.user) return

    try {
      loading.value = true
      const sources = await VectorService.getDataSources(authStore.user.id)
      dataSources.value = sources
      return sources
    } catch (error) {
      console.error('Error fetching data sources:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const createDataSource = async (source: Omit<DataSource, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      const newSource = await VectorService.createDataSource({
        ...source,
        user_id: authStore.user.id
      })
      
      dataSources.value.unshift(newSource)
      return newSource
    } catch (error) {
      console.error('Error creating data source:', error)
      throw error
    }
  }

  const updateDataSource = async (sourceId: string, updates: Partial<DataSource>) => {
    try {
      const updatedSource = await VectorService.updateDataSource(sourceId, updates)
      
      const index = dataSources.value.findIndex(s => s.id === sourceId)
      if (index !== -1) {
        dataSources.value[index] = updatedSource
      }
      
      return updatedSource
    } catch (error) {
      console.error('Error updating data source:', error)
      throw error
    }
  }

  // Vector Search
  const searchSimilarContent = async (
    queryEmbedding: number[],
    options?: { threshold?: number; limit?: number }
  ) => {
    if (!authStore.user) return []

    try {
      loading.value = true
      const results = await VectorService.searchSimilarContent(
        queryEmbedding,
        authStore.user.id,
        options
      )
      
      similarContent.value = results
      return results
    } catch (error) {
      console.error('Error searching similar content:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    healthDocuments: readonly(healthDocuments),
    importSessions: readonly(importSessions),
    dataSources: readonly(dataSources),
    similarContent: readonly(similarContent),
    loading: readonly(loading),
    importing: readonly(importing),
    documentsBySource,
    activeDataSources,
    recentImports,
    fetchHealthDocuments,
    createHealthDocument,
    fetchImportSessions,
    importHealthData,
    fetchDataSources,
    createDataSource,
    updateDataSource,
    searchSimilarContent,
  }
})