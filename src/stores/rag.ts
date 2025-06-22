import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { RAGService } from '@/services/ragService'
import type { RAGDocument, RAGImportSession, FileUploadProgress, RAGProcessingOptions } from '@/types/rag'
import { useAuthStore } from './auth'

export const useRAGStore = defineStore('rag', () => {
  const authStore = useAuthStore()
  
  const documents = ref<RAGDocument[]>([])
  const importSessions = ref<RAGImportSession[]>([])
  const uploadProgress = ref<FileUploadProgress[]>([])
  const loading = ref(false)
  const processing = ref(false)

  const documentsByStatus = computed(() => {
    const grouped: Record<string, RAGDocument[]> = {
      completed: [],
      processing: [],
      failed: []
    }
    
    documents.value.forEach(doc => {
      grouped[doc.status].push(doc)
    })
    
    return grouped
  })

  const totalDocuments = computed(() => documents.value.length)
  const completedDocuments = computed(() => documentsByStatus.value.completed.length)
  const failedDocuments = computed(() => documentsByStatus.value.failed.length)

  const fetchDocuments = async () => {
    if (!authStore.user) return

    try {
      loading.value = true
      // Add a small delay to ensure initialization completes
      await new Promise(resolve => setTimeout(resolve, 1000))
      const docs = await RAGService.getDocuments(authStore.user.id)
      documents.value = docs
    } catch (error) {
      console.error('Error fetching documents:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchImportSessions = async () => {
    if (!authStore.user) return

    try {
      const sessions = await RAGService.getImportSessions(authStore.user.id)
      importSessions.value = sessions
    } catch (error) {
      console.error('Error fetching import sessions:', error)
      throw error
    }
  }

  const processFiles = async (
    files: File[],
    options: RAGProcessingOptions
  ): Promise<RAGImportSession> => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      processing.value = true
      
      // Create import session
      const session = await RAGService.createImportSession(authStore.user.id, files.length)
      importSessions.value.unshift(session)

      // Initialize progress tracking
      uploadProgress.value = files.map(file => ({
        filename: file.name,
        size: file.size,
        status: 'pending',
        progress: 0
      }))

      let processedCount = 0
      let failedCount = 0
      const errors: any[] = []

      // Process files sequentially to avoid overwhelming the system
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const progressItem = uploadProgress.value[i]

        try {
          progressItem.status = 'uploading'
          progressItem.progress = 25

          progressItem.status = 'processing'
          progressItem.progress = 50

          const document = await RAGService.processDocument(
            file,
            authStore.user.id,
            session.id,
            options
          )

          documents.value.unshift(document)
          progressItem.status = 'completed'
          progressItem.progress = 100
          processedCount++

        } catch (error) {
          progressItem.status = 'failed'
          progressItem.error = error instanceof Error ? error.message : 'Processing failed'
          failedCount++
          errors.push({
            filename: file.name,
            error: progressItem.error
          })
        }

        // Update session progress
        await RAGService.updateImportSession(session.id, authStore.user.id, {
          processed_files: processedCount,
          failed_files: failedCount,
          error_log: errors
        })
      }

      // Final session update
      const finalStatus = failedCount === 0 ? 'completed' : (processedCount > 0 ? 'completed' : 'failed')
      const updatedSession = await RAGService.updateImportSession(session.id, authStore.user.id, {
        status: finalStatus,
        completed_at: new Date().toISOString()
      })

      // Update local session
      const sessionIndex = importSessions.value.findIndex(s => s.id === session.id)
      if (sessionIndex !== -1) {
        importSessions.value[sessionIndex] = updatedSession
      }

      return updatedSession

    } catch (error) {
      console.error('Error processing files:', error)
      throw error
    } finally {
      processing.value = false
    }
  }

  const deleteDocument = async (documentId: string) => {
    if (!authStore.user) return
    
    try {
      await RAGService.deleteDocument(documentId, authStore.user.id)
      documents.value = documents.value.filter(doc => doc.id !== documentId)
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }

  const searchDocuments = async (query: string) => {
    if (!authStore.user) return []

    try {
      return await RAGService.searchSimilarChunks(query, authStore.user.id)
    } catch (error) {
      console.error('Error searching documents:', error)
      throw error
    }
  }

  const clearProgress = () => {
    uploadProgress.value = []
  }

  return {
    documents: readonly(documents),
    importSessions: readonly(importSessions),
    uploadProgress: readonly(uploadProgress),
    loading: readonly(loading),
    processing: readonly(processing),
    documentsByStatus,
    totalDocuments,
    completedDocuments,
    failedDocuments,
    fetchDocuments,
    fetchImportSessions,
    processFiles,
    deleteDocument,
    searchDocuments,
    clearProgress
  }
})