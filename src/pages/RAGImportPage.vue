<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-neutral-900">Document Import for RAG</h1>
      <p class="text-neutral-600 mt-1">Upload and process documents for AI-powered search and retrieval</p>
    </div>

    <!-- Upload Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- File Upload -->
      <div class="card">
        <h2 class="text-xl font-semibold text-neutral-900 mb-6">Upload Documents</h2>
        
        <div class="space-y-4">
          <!-- File Drop Zone -->
          <div 
            @drop="handleDrop"
            @dragover.prevent
            @dragenter.prevent
            @dragleave="isDragging = false"
            :class="`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
              isDragging ? 'border-primary-400 bg-primary-50' : 'border-neutral-300 hover:border-primary-400'
            }`"
          >
            <input
              ref="fileInput"
              type="file"
              @change="handleFileSelect"
              accept=".pdf,.docx,.txt,.csv,.json"
              multiple
              class="hidden"
            />
            
            <div class="space-y-3">
              <CloudArrowUpIcon class="w-12 h-12 text-neutral-400 mx-auto" />
              <div>
                <button @click="$refs.fileInput?.click()" class="text-primary-600 hover:text-primary-500 font-medium">
                  Click to upload files
                </button>
                <span class="text-neutral-600"> or drag and drop</span>
              </div>
              <div class="text-sm text-neutral-500 space-y-1">
                <p>Supports: PDF, DOCX, TXT, CSV, JSON</p>
                <p>Max file size: 10MB | Max files: 50</p>
              </div>
            </div>
          </div>

          <!-- Selected Files -->
          <div v-if="selectedFiles.length > 0" class="space-y-2">
            <h3 class="font-medium text-neutral-900">Selected Files ({{ selectedFiles.length }})</h3>
            <div class="max-h-40 overflow-y-auto space-y-2">
              <div 
                v-for="(file, index) in selectedFiles" 
                :key="index"
                class="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
              >
                <div class="flex items-center space-x-3">
                  <span class="text-lg">{{ RAGService.getFileIcon(file.type) }}</span>
                  <div>
                    <p class="text-sm font-medium text-neutral-900">{{ file.name }}</p>
                    <p class="text-xs text-neutral-500">{{ RAGService.formatFileSize(file.size) }}</p>
                  </div>
                </div>
                <button 
                  @click="removeFile(index)"
                  class="text-neutral-400 hover:text-red-600"
                >
                  <XMarkIcon class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Invalid Files -->
          <div v-if="invalidFiles.length > 0" class="bg-error-50 border border-error-200 rounded-lg p-4">
            <h4 class="font-medium text-error-900 mb-2">Invalid Files</h4>
            <div class="space-y-1">
              <div v-for="(item, index) in invalidFiles" :key="index" class="text-sm text-error-700">
                <strong>{{ item.file.name }}:</strong> {{ item.reason }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Processing Options -->
      <div class="card">
        <h2 class="text-xl font-semibold text-neutral-900 mb-6">Processing Options</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">
              Chunk Size (tokens)
            </label>
            <select v-model="processingOptions.chunkSize" class="input-field">
              <option :value="256">256 tokens (small chunks)</option>
              <option :value="512">512 tokens (recommended)</option>
              <option :value="1024">1024 tokens (large chunks)</option>
            </select>
            <p class="text-xs text-neutral-500 mt-1">
              Smaller chunks provide more precise search, larger chunks preserve more context
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">
              Chunk Overlap (tokens)
            </label>
            <select v-model="processingOptions.chunkOverlap" class="input-field">
              <option :value="0">No overlap</option>
              <option :value="50">50 tokens</option>
              <option :value="100">100 tokens (recommended)</option>
              <option :value="200">200 tokens</option>
            </select>
            <p class="text-xs text-neutral-500 mt-1">
              Overlap helps maintain context between chunks
            </p>
          </div>

          <div class="flex items-center space-x-3">
            <input 
              id="generateEmbeddings" 
              v-model="processingOptions.generateEmbeddings" 
              type="checkbox" 
              class="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <label for="generateEmbeddings" class="text-sm font-medium text-neutral-700">
              Generate embeddings for semantic search
            </label>
          </div>

          <div class="flex items-center space-x-3">
            <input 
              id="preserveFormatting" 
              v-model="processingOptions.preserveFormatting" 
              type="checkbox" 
              class="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <label for="preserveFormatting" class="text-sm font-medium text-neutral-700">
              Preserve document formatting
            </label>
          </div>

          <button
            @click="processFiles"
            :disabled="selectedFiles.length === 0 || ragStore.processing"
            class="btn-primary w-full"
          >
            <div v-if="ragStore.processing" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Process {{ selectedFiles.length }} File{{ selectedFiles.length !== 1 ? 's' : '' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Processing Progress -->
    <div v-if="ragStore.uploadProgress.length > 0" class="card mb-8">
      <h2 class="text-xl font-semibold text-neutral-900 mb-6">Processing Progress</h2>
      
      <div class="space-y-4">
        <div 
          v-for="(progress, index) in ragStore.uploadProgress" 
          :key="index"
          class="border border-neutral-200 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center space-x-3">
              <span class="text-lg">{{ RAGService.getFileIcon(selectedFiles[index]?.type || '') }}</span>
              <div>
                <p class="font-medium text-neutral-900">{{ progress.filename }}</p>
                <p class="text-sm text-neutral-500">{{ RAGService.formatFileSize(progress.size) }}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <span :class="`px-2 py-1 rounded-full text-xs ${getStatusColor(progress.status)}`">
                {{ progress.status }}
              </span>
              <span class="text-sm text-neutral-600">{{ progress.progress }}%</span>
            </div>
          </div>
          
          <div class="w-full bg-neutral-200 rounded-full h-2">
            <div 
              class="bg-primary-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${progress.progress}%` }"
            ></div>
          </div>
          
          <div v-if="progress.error" class="mt-2 text-sm text-error-600">
            Error: {{ progress.error }}
          </div>
        </div>
      </div>

      <div class="mt-4 flex justify-end">
        <button @click="ragStore.clearProgress" class="btn-outline">
          Clear Progress
        </button>
      </div>
    </div>

    <!-- Documents Library -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-neutral-900">Document Library</h2>
        <div class="flex items-center space-x-4">
          <div class="text-sm text-neutral-600">
            {{ ragStore.totalDocuments }} documents | {{ ragStore.completedDocuments }} processed
          </div>
          <button @click="ragStore.fetchDocuments()" class="text-sm text-primary-600 hover:text-primary-500">
            Refresh
          </button>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-success-50 border border-success-200 rounded-lg p-4">
          <div class="flex items-center">
            <CheckCircleIcon class="w-8 h-8 text-success-600 mr-3" />
            <div>
              <p class="text-2xl font-bold text-success-900">{{ ragStore.completedDocuments }}</p>
              <p class="text-sm text-success-700">Completed</p>
            </div>
          </div>
        </div>
        
        <div class="bg-warning-50 border border-warning-200 rounded-lg p-4">
          <div class="flex items-center">
            <ClockIcon class="w-8 h-8 text-warning-600 mr-3" />
            <div>
              <p class="text-2xl font-bold text-warning-900">{{ ragStore.documentsByStatus.processing.length }}</p>
              <p class="text-sm text-warning-700">Processing</p>
            </div>
          </div>
        </div>
        
        <div class="bg-error-50 border border-error-200 rounded-lg p-4">
          <div class="flex items-center">
            <XCircleIcon class="w-8 h-8 text-error-600 mr-3" />
            <div>
              <p class="text-2xl font-bold text-error-900">{{ ragStore.failedDocuments }}</p>
              <p class="text-sm text-error-700">Failed</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Documents List -->
      <div v-if="ragStore.loading" class="animate-pulse">
        <div v-for="i in 3" :key="i" class="flex items-center space-x-4 mb-4">
          <div class="w-10 h-10 bg-neutral-200 rounded-lg"></div>
          <div class="flex-1">
            <div class="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
            <div class="h-3 bg-neutral-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
      
      <div v-else-if="ragStore.documents.length === 0" class="text-center py-12">
        <DocumentIcon class="w-16 h-16 text-neutral-400 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-neutral-900 mb-2">No documents yet</h3>
        <p class="text-neutral-500">Upload your first documents to get started with RAG</p>
      </div>
      
      <div v-else class="space-y-4">
        <div 
          v-for="document in ragStore.documents" 
          :key="document.id"
          class="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50"
        >
          <div class="flex items-center space-x-4">
            <span class="text-2xl">{{ RAGService.getFileIcon(document.file_type) }}</span>
            <div>
              <h3 class="font-medium text-neutral-900">{{ document.filename }}</h3>
              <div class="flex items-center space-x-4 text-sm text-neutral-500">
                <span>{{ RAGService.formatFileSize(document.file_size) }}</span>
                <span>{{ document.chunk_count }} chunks</span>
                <span>{{ document.embedding_count }} embeddings</span>
                <span>{{ formatDate(document.created_at) }}</span>
              </div>
              <div v-if="document.error_message" class="text-sm text-error-600 mt-1">
                Error: {{ document.error_message }}
              </div>
            </div>
          </div>
          
          <div class="flex items-center space-x-3">
            <span :class="`px-2 py-1 rounded-full text-xs ${getDocumentStatusColor(document.status)}`">
              {{ document.status }}
            </span>
            <button 
              @click="deleteDocument(document.id)"
              class="text-neutral-400 hover:text-red-600"
              :disabled="ragStore.processing"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Import History -->
    <div class="card mt-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-neutral-900">Import History</h2>
        <button @click="ragStore.fetchImportSessions()" class="text-sm text-primary-600 hover:text-primary-500">
          Refresh
        </button>
      </div>
      
      <div v-if="ragStore.importSessions.length === 0" class="text-center py-8">
        <ClockIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <p class="text-neutral-500">No import history yet</p>
      </div>
      
      <div v-else class="space-y-4">
        <div 
          v-for="session in ragStore.importSessions" 
          :key="session.id"
          class="flex items-center justify-between p-4 bg-neutral-50 rounded-lg"
        >
          <div>
            <div class="flex items-center space-x-4 text-sm">
              <span class="font-medium">{{ session.processed_files }} of {{ session.total_files }} files processed</span>
              <span class="text-neutral-500">{{ session.total_chunks }} chunks</span>
              <span class="text-neutral-500">{{ session.total_embeddings }} embeddings</span>
            </div>
            <p class="text-xs text-neutral-400 mt-1">{{ formatDate(session.started_at) }}</p>
          </div>
          
          <span :class="`px-2 py-1 rounded-full text-xs ${getSessionStatusColor(session.status)}`">
            {{ session.status }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRAGStore } from '@/stores/rag'
import { RAGService } from '@/services/ragService'
import { format } from 'date-fns'
import {
  CloudArrowUpIcon,
  XMarkIcon,
  DocumentIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import type { RAGProcessingOptions } from '@/types/rag'

const ragStore = useRAGStore()

const selectedFiles = ref<File[]>([])
const invalidFiles = ref<{ file: File, reason: string }[]>([])
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement>()

const processingOptions = reactive<RAGProcessingOptions>({
  chunkSize: 512,
  chunkOverlap: 100,
  generateEmbeddings: true,
  preserveFormatting: false
})

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    addFiles(target.files)
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
  
  const files = event.dataTransfer?.files
  if (files) {
    addFiles(files)
  }
}

const addFiles = (fileList: FileList) => {
  try {
    const { valid, invalid } = RAGService.validateFiles(fileList)
    
    // Add valid files (avoid duplicates)
    valid.forEach(file => {
      if (!selectedFiles.value.some(f => f.name === file.name && f.size === file.size)) {
        selectedFiles.value.push(file)
      }
    })
    
    invalidFiles.value = invalid
    
    // Clear invalid files after 5 seconds
    if (invalid.length > 0) {
      setTimeout(() => {
        invalidFiles.value = []
      }, 5000)
    }
  } catch (error) {
    console.error('File validation error:', error)
    invalidFiles.value = [{ file: fileList[0], reason: error instanceof Error ? error.message : 'Validation failed' }]
  }
}

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1)
}

const processFiles = async () => {
  if (selectedFiles.value.length === 0) return

  try {
    await ragStore.processFiles(selectedFiles.value, processingOptions)
    
    // Clear selected files on success
    selectedFiles.value = []
    invalidFiles.value = []
    
    // Reset file input
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  } catch (error) {
    console.error('Processing failed:', error)
  }
}

const deleteDocument = async (documentId: string) => {
  if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
    try {
      await ragStore.deleteDocument(documentId)
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }
}

const getStatusColor = (status: string) => {
  const colors = {
    pending: 'bg-neutral-100 text-neutral-800',
    uploading: 'bg-primary-100 text-primary-800',
    processing: 'bg-warning-100 text-warning-800',
    completed: 'bg-success-100 text-success-800',
    failed: 'bg-error-100 text-error-800'
  }
  return colors[status as keyof typeof colors] || colors.pending
}

const getDocumentStatusColor = (status: string) => {
  const colors = {
    processing: 'bg-warning-100 text-warning-800',
    completed: 'bg-success-100 text-success-800',
    failed: 'bg-error-100 text-error-800'
  }
  return colors[status as keyof typeof colors] || colors.processing
}

const getSessionStatusColor = (status: string) => {
  const colors = {
    processing: 'bg-warning-100 text-warning-800',
    completed: 'bg-success-100 text-success-800',
    failed: 'bg-error-100 text-error-800'
  }
  return colors[status as keyof typeof colors] || colors.processing
}

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'MMM d, yyyy HH:mm')
}

onMounted(async () => {
  await Promise.all([
    ragStore.fetchDocuments(),
    ragStore.fetchImportSessions()
  ])
})
</script>