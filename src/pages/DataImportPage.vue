<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-neutral-900">Health Data Import</h1>
      <p class="text-neutral-600 mt-1">Import and manage health data from various sources</p>
    </div>

    <!-- Data Sources Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div v-for="source in supportedSources" :key="source.id" class="metric-card">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div :class="`w-12 h-12 rounded-lg flex items-center justify-center ${source.bgColor}`">
              <component :is="source.icon" :class="`w-6 h-6 ${source.iconColor}`" />
            </div>
            <div>
              <h3 class="font-medium text-neutral-900">{{ source.name }}</h3>
              <p class="text-sm text-neutral-500">{{ source.description }}</p>
            </div>
          </div>
        </div>
        
        <div class="flex items-center justify-between">
          <span :class="`text-xs px-2 py-1 rounded-full ${source.statusColor}`">
            {{ getSourceStatus(source.id) }}
          </span>
          <button 
            @click="connectSource(source)"
            :class="`text-sm ${source.connected ? 'text-success-600 hover:text-success-500' : 'text-primary-600 hover:text-primary-500'}`"
          >
            {{ source.connected ? 'Connected' : 'Connect' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Import Actions -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- File Upload -->
      <div class="card">
        <h2 class="text-xl font-semibold text-neutral-900 mb-6">Upload Health Data</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">
              Data Source
            </label>
            <select v-model="uploadForm.source" class="input-field">
              <option value="">Select source</option>
              <option value="apple_health">Apple Health Export</option>
              <option value="google_fit">Google Fit Export</option>
              <option value="fitbit">Fitbit Export</option>
              <option value="garmin">Garmin Connect</option>
              <option value="manual">Manual Upload</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">
              Upload File
            </label>
            <div 
              @drop="handleDrop"
              @dragover.prevent
              @dragenter.prevent
              class="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors duration-200"
            >
              <input
                ref="fileInput"
                type="file"
                @change="handleFileSelect"
                accept=".xml,.json,.csv,.zip"
                class="hidden"
              />
              <CloudArrowUpIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <p class="text-neutral-600 mb-2">
                <button @click="handleFileInputClick" class="text-primary-600 hover:text-primary-500">
                  Click to upload
                </button>
                or drag and drop
              </p>
              <p class="text-sm text-neutral-500">
                Supports XML, JSON, CSV, ZIP files up to 5GB
              </p>
              <p class="text-xs text-primary-600 mt-2">
                ✓ Large files automatically use chunked upload with resume capability
              </p>
            </div>
            
            <div v-if="uploadForm.file" class="mt-3 p-3 bg-primary-50 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <DocumentIcon class="w-5 h-5 text-primary-600" />
                  <span class="text-sm font-medium text-primary-900">{{ uploadForm.file.name }}</span>
                  <span class="text-xs text-primary-600">({{ formatFileSize(uploadForm.file.size) }})</span>
                </div>
                <button @click="clearFile" class="text-primary-600 hover:text-primary-800">
                  <XMarkIcon class="w-4 h-4" />
                </button>
              </div>
              
              <!-- Large file info -->
              <div v-if="uploadForm.file.size > 100 * 1024 * 1024" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                <p class="text-xs text-blue-700">
                  <strong>Large File Detected:</strong> This {{ formatFileSize(uploadForm.file.size) }} file will be uploaded using chunked upload for reliability and resume capability.
                </p>
              </div>
            </div>
          </div>

          <div v-if="uploadForm.file">
            <label class="block text-sm font-medium text-neutral-700 mb-2">
              Import Notes (Optional)
            </label>
            <textarea
              v-model="uploadForm.notes"
              rows="3"
              class="input-field"
              placeholder="Add any notes about this import..."
            ></textarea>
          </div>

          <!-- Advanced Options for Large Files -->
          <div v-if="uploadForm.file && uploadForm.file.size > 100 * 1024 * 1024" class="space-y-3">
            <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h4 class="font-medium text-blue-900 mb-2">Large File Upload Options</h4>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input 
                    type="radio" 
                    v-model="uploadForm.chunkSize" 
                    :value="5 * 1024 * 1024" 
                    class="mr-2"
                  />
                  <span class="text-sm text-blue-800">
                    <strong>Standard Chunks (5MB)</strong> - Recommended for most connections
                  </span>
                </label>
                <label class="flex items-center">
                  <input 
                    type="radio" 
                    v-model="uploadForm.chunkSize" 
                    :value="10 * 1024 * 1024" 
                    class="mr-2"
                  />
                  <span class="text-sm text-blue-800">
                    <strong>Large Chunks (10MB)</strong> - For fast, stable connections
                  </span>
                </label>
                <label class="flex items-center">
                  <input 
                    type="radio" 
                    v-model="uploadForm.chunkSize" 
                    :value="2 * 1024 * 1024" 
                    class="mr-2"
                  />
                  <span class="text-sm text-blue-800">
                    <strong>Small Chunks (2MB)</strong> - For slower or unstable connections
                  </span>
                </label>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="uploadError" class="bg-error-50 border border-error-200 rounded-lg p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-error-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-error-800">Upload Failed</h3>
                <p class="text-sm text-error-700 mt-1">{{ uploadError }}</p>
                <div v-if="uploadErrorDetails" class="mt-2">
                  <details class="text-xs text-error-600">
                    <summary class="cursor-pointer hover:text-error-800">Show technical details</summary>
                    <pre class="mt-2 whitespace-pre-wrap">{{ uploadErrorDetails }}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>

          <button
            @click="handleUpload"
            :disabled="!uploadForm.source || !uploadForm.file || fileUpload.uploading.value"
            class="btn-primary w-full"
          >
            <div v-if="fileUpload.uploading.value" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            {{ getUploadButtonText() }}
          </button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card">
        <h2 class="text-xl font-semibold text-neutral-900 mb-6">Quick Actions</h2>
        
        <div class="space-y-4">
          <button class="w-full btn-outline text-left flex items-center">
            <DevicePhoneMobileIcon class="w-5 h-5 mr-3 text-neutral-500" />
            <div>
              <p class="font-medium">Connect Apple Health</p>
              <p class="text-sm text-neutral-500">Sync data from iPhone Health app</p>
            </div>
          </button>
          
          <button class="w-full btn-outline text-left flex items-center">
            <CloudIcon class="w-5 h-5 mr-3 text-neutral-500" />
            <div>
              <p class="font-medium">Google Fit Integration</p>
              <p class="text-sm text-neutral-500">Connect your Google Fit account</p>
            </div>
          </button>
          
          <button class="w-full btn-outline text-left flex items-center">
            <ClockIcon class="w-5 h-5 mr-3 text-neutral-500" />
            <div>
              <p class="font-medium">Wearable Devices</p>
              <p class="text-sm text-neutral-500">Connect fitness trackers</p>
            </div>
          </button>
          
          <button @click="showSampleData = true" class="w-full btn-outline text-left flex items-center">
            <BeakerIcon class="w-5 h-5 mr-3 text-neutral-500" />
            <div>
              <p class="font-medium">Import Sample Data</p>
              <p class="text-sm text-neutral-500">Try with demo health data</p>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Upload Progress -->
    <div v-if="fileUpload.uploading.value || (fileUpload.progress.value.percentage > 0 && fileUpload.progress.value.percentage < 100)" class="mb-8">
      <FileUploadProgress
        :file-name="uploadForm.file?.name || ''"
        :progress="fileUpload.progress.value"
        :uploading="fileUpload.uploading.value"
        :error="fileUpload.error.value"
        :formatted-speed="fileUpload.formattedSpeed.value"
        :formatted-e-t-a="fileUpload.formattedETA.value"
        @cancel="fileUpload.cancelUpload"
      />
    </div>

    <!-- Processing Progress -->
    <div v-if="currentImport" class="card mb-8">
      <h2 class="text-xl font-semibold text-neutral-900 mb-4">Processing Progress</h2>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-neutral-700">Processing {{ currentImport.source_app }} data...</span>
          <span class="text-sm text-neutral-500">{{ currentImport.processed_records }} / {{ currentImport.total_records }}</span>
        </div>
        <div class="w-full bg-neutral-200 rounded-full h-2">
          <div 
            class="bg-primary-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${(currentImport.processed_records / currentImport.total_records) * 100}%` }"
          ></div>
        </div>
        <div v-if="currentImport.status === 'completed'" class="text-sm text-success-600">
          ✓ Processing completed successfully
        </div>
        <div v-if="currentImport.status === 'failed'" class="text-sm text-error-600">
          ✗ Processing failed
        </div>
      </div>
    </div>

    <!-- Import History -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-neutral-900">Import History</h2>
        <button @click="vectorStore.fetchImportSessions()" class="text-sm text-primary-600 hover:text-primary-500">
          Refresh
        </button>
      </div>
      
      <div v-if="vectorStore.loading" class="animate-pulse">
        <div v-for="i in 3" :key="i" class="flex items-center space-x-4 mb-4">
          <div class="w-10 h-10 bg-neutral-200 rounded-lg"></div>
          <div class="flex-1">
            <div class="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
            <div class="h-3 bg-neutral-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
      
      <div v-else-if="vectorStore.importSessions.length === 0" class="text-center py-8">
        <CloudArrowUpIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <p class="text-neutral-500">No import history yet</p>
        <p class="text-sm text-neutral-400">Your data imports will appear here</p>
      </div>
      
      <div v-else class="space-y-4">
        <div v-for="session in vectorStore.importSessions" :key="session.id" class="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
          <div class="flex items-center space-x-4">
            <div :class="`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(session.status).bg}`">
              <component :is="getStatusIcon(session.status)" :class="`w-5 h-5 ${getStatusColor(session.status).text}`" />
            </div>
            <div>
              <p class="font-medium text-neutral-900">{{ formatSourceName(session.source_app) }}</p>
              <p class="text-sm text-neutral-500">
                {{ session.processed_records }} of {{ session.total_records }} records processed
              </p>
              <p class="text-xs text-neutral-400">{{ formatDate(session.started_at) }}</p>
            </div>
          </div>
          
          <div class="flex items-center space-x-3">
            <span :class="`px-2 py-1 rounded-full text-xs ${getStatusColor(session.status).badge}`">
              {{ session.status }}
            </span>
            <button v-if="session.error_log.length > 0" @click="showErrors({...session, error_log: [...session.error_log]})" class="text-sm text-error-600 hover:text-error-500">
              View Errors
            </button>
            <button @click="viewImportDetails({...session, error_log: [...session.error_log]})" class="text-sm text-primary-600 hover:text-primary-500">
              Details
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sample Data Modal -->
    <div v-if="showSampleData" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">Import Sample Data</h3>
        <p class="text-neutral-600 mb-6">
          This will import sample health data to help you explore the features of Aivital.
        </p>
        <div class="flex space-x-3">
          <button @click="importSampleData" :disabled="vectorStore.importing" class="btn-primary flex-1">
            Import Sample Data
          </button>
          <button @click="showSampleData = false" class="btn-outline flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Error Details Modal -->
    <div v-if="selectedSession" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">Import Errors</h3>
        <div class="max-h-64 overflow-y-auto space-y-2">
          <div v-for="(error, index) in selectedSession.error_log" :key="index" class="p-3 bg-error-50 rounded-lg">
            <p class="text-sm font-medium text-error-900">{{ error.item || 'Unknown item' }}</p>
            <p class="text-xs text-error-700">{{ error.error }}</p>
          </div>
        </div>
        <div class="flex justify-end mt-6">
          <button @click="selectedSession = null" class="btn-outline">
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Import Details Modal -->
    <div v-if="detailsSession" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-lg max-w-4xl w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">Import Details</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 class="font-medium text-neutral-900 mb-2">Import Information</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-neutral-600">Source:</span>
                <span class="font-medium">{{ formatSourceName(detailsSession.source_app) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Status:</span>
                <span :class="`font-medium ${getStatusColor(detailsSession.status).text}`">{{ detailsSession.status }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Started:</span>
                <span>{{ formatDate(detailsSession.started_at) }}</span>
              </div>
              <div v-if="detailsSession.completed_at" class="flex justify-between">
                <span class="text-neutral-600">Completed:</span>
                <span>{{ formatDate(detailsSession.completed_at) }}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 class="font-medium text-neutral-900 mb-2">Processing Summary</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-neutral-600">Total Records:</span>
                <span class="font-medium">{{ detailsSession.total_records }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Processed:</span>
                <span class="font-medium text-success-600">{{ detailsSession.processed_records }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Failed:</span>
                <span class="font-medium text-error-600">{{ detailsSession.failed_records }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Success Rate:</span>
                <span class="font-medium">{{ Math.round((detailsSession.processed_records / detailsSession.total_records) * 100) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="detailsSession.metadata && Object.keys(detailsSession.metadata).length > 0" class="mb-6">
          <h4 class="font-medium text-neutral-900 mb-2">Metadata</h4>
          <div class="bg-neutral-50 rounded-lg p-3">
            <pre class="text-sm text-neutral-700">{{ JSON.stringify(detailsSession.metadata, null, 2) }}</pre>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button @click="viewImportedDocuments(detailsSession)" class="btn-outline">
            View Imported Data
          </button>
          <button @click="detailsSession = null" class="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useVectorStore } from '@/stores/vector'
import { useRouter } from 'vue-router'
import { useFileUpload } from '@/composables/useFileUpload'
import { format } from 'date-fns'
import FileUploadProgress from '@/components/shared/FileUploadProgress.vue'
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  CloudIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'
import type { ImportSession } from '@/types/vector'

const vectorStore = useVectorStore()
const router = useRouter()
const fileUpload = useFileUpload()

const showSampleData = ref(false)
const selectedSession = ref<ImportSession | null>(null)
const detailsSession = ref<ImportSession | null>(null)
const currentImport = ref<ImportSession | null>(null)
const fileInput = ref<HTMLInputElement>()
const uploadError = ref('')
const uploadErrorDetails = ref('')

const uploadForm = reactive({
  source: '',
  file: null as File | null,
  notes: '',
  chunkSize: 5 * 1024 * 1024 // Default 5MB chunks
})

const supportedSources = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    description: 'iPhone Health app data',
    icon: DevicePhoneMobileIcon,
    bgColor: 'bg-primary-100',
    iconColor: 'text-primary-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800'
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    description: 'Google fitness tracking',
    icon: CloudIcon,
    bgColor: 'bg-success-100',
    iconColor: 'text-success-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800'
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Fitbit device data',
    icon: ClockIcon,
    bgColor: 'bg-secondary-100',
    iconColor: 'text-secondary-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800'
  },
  {
    id: 'garmin',
    name: 'Garmin',
    description: 'Garmin Connect data',
    icon: ClockIcon,
    bgColor: 'bg-accent-100',
    iconColor: 'text-accent-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800'
  }
]

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    uploadForm.file = target.files[0]
    uploadError.value = ''
    uploadErrorDetails.value = ''
    validateFile(target.files[0])
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  const files = event.dataTransfer?.files
  if (files && files[0]) {
    uploadForm.file = files[0]
    uploadError.value = ''
    uploadErrorDetails.value = ''
    validateFile(files[0])
  }
}

const clearFile = () => {
  uploadForm.file = null
  uploadError.value = ''
  uploadErrorDetails.value = ''
  fileUpload.resetProgress()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const validateFile = (file: File) => {
  const maxSize = 5 * 1024 * 1024 * 1024 // 5GB
  const allowedTypes = ['.xml', '.json', '.csv', '.zip']
  
  if (file.size > maxSize) {
    uploadError.value = 'File size must be less than 5GB'
    uploadForm.file = null
    return false
  }
  
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!allowedTypes.includes(fileExtension)) {
    uploadError.value = 'File type not supported. Please upload XML, JSON, CSV, or ZIP files.'
    uploadForm.file = null
    return false
  }
  
  return true
}

const getUploadButtonText = () => {
  if (fileUpload.uploading.value) {
    return 'Uploading...'
  }
  if (uploadForm.file && uploadForm.file.size > 100 * 1024 * 1024) {
    return 'Upload Large File'
  }
  return 'Import Data'
}

const handleUpload = async () => {
  if (!uploadForm.source || !uploadForm.file) return

  uploadError.value = ''
  uploadErrorDetails.value = ''

  try {
    // Initialize current import with basic info
    currentImport.value = {
      id: '',
      user_id: '',
      source_app: uploadForm.source,
      status: 'processing',
      total_records: 0,
      processed_records: 0,
      failed_records: 0,
      error_log: [],
      metadata: {},
      started_at: new Date().toISOString()
    }

    // Process XML file and store embeddings
    const sessionId = await fileUpload.uploadFile(uploadForm.file, {
      chunkSize: uploadForm.chunkSize,
      onProgress: (progress) => {
        console.log(`Processing progress: ${progress}%`)
        // Update current import progress if available
        if (currentImport.value) {
          currentImport.value = {
            ...currentImport.value,
            processed_records: Math.round((progress / 100) * (currentImport.value.total_records || 1))
          }
        }
      },
      onChunkComplete: (chunkIndex, totalChunks) => {
        console.log(`Chunk ${chunkIndex + 1}/${totalChunks} processed`)
        // Update total records based on chunks if not set
        if (currentImport.value && !currentImport.value.total_records) {
          currentImport.value = {
            ...currentImport.value,
            total_records: totalChunks * 100 // Estimate 100 records per chunk
          }
        }
      }
    })

    console.log('File processed successfully:', sessionId)

    // Start server-side processing
    const payload = {
      sessionId,
      source: uploadForm.source,
      metadata: {
        filename: uploadForm.file.name,
        filesize: uploadForm.file.size,
        filetype: uploadForm.file.type,
        notes: uploadForm.notes,
        processed_at: new Date().toISOString(),
        chunk_size: uploadForm.chunkSize,
        total_chunks: currentImport.value?.total_records ? Math.ceil(currentImport.value.total_records / 100) : undefined
      }
    }

    const response = await fetch('/api/process-health-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Azure Function call failed: ${response.statusText}`)
    }

    const data = await response.json()

    console.log('Processing completed:', data)
    currentImport.value = {
      ...data.importSession,
      error_log: [...data.importSession.error_log] // Convert readonly array to mutable
    }

    // Reset form
    uploadForm.source = ''
    uploadForm.file = null
    uploadForm.notes = ''
    fileUpload.resetProgress()
    
    // Refresh import sessions
    await vectorStore.fetchImportSessions()

  } catch (error: any) {
    console.error('Processing failed:', error)
    uploadError.value = error.message || 'Processing failed. Please try again.'
    uploadErrorDetails.value = error.stack || error.toString()
    
    // Update current import status on error
    if (currentImport.value) {
      currentImport.value = {
        ...currentImport.value,
        status: 'failed',
        error_log: [...(currentImport.value.error_log || []), {
          error: error.message,
          timestamp: new Date().toISOString()
        }]
      }
    }
  }
}

const importSampleData = async () => {
  try {
    const sampleData = generateSampleAppleHealthData()
    
    const importSession = await vectorStore.importHealthData({
      source: 'apple_health',
      data: sampleData,
      metadata: {
        type: 'sample_data',
        generated_at: new Date().toISOString(),
        description: 'Sample Apple Health data for demonstration'
      }
    })
    
    currentImport.value = importSession
    showSampleData.value = false
    
    // Refresh import sessions
    await vectorStore.fetchImportSessions()
  } catch (error) {
    console.error('Sample data import failed:', error)
    uploadError.value = 'Failed to import sample data'
  }
}

const generateSampleAppleHealthData = () => {
  const now = new Date()
  const data = []
  
  // Generate sample data for the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
    
    // Heart rate data
    data.push({
      type: 'HKQuantityTypeIdentifierHeartRate',
      value: 65 + Math.random() * 20,
      unit: 'count/min',
      startDate: date.toISOString(),
      endDate: date.toISOString(),
      sourceName: 'Apple Watch',
      device: 'Apple Watch Series 8'
    })
    
    // Step count
    data.push({
      type: 'HKQuantityTypeIdentifierStepCount',
      value: Math.floor(8000 + Math.random() * 4000),
      unit: 'count',
      startDate: date.toISOString(),
      endDate: date.toISOString(),
      sourceName: 'iPhone',
      device: 'iPhone 14 Pro'
    })
    
    // Weight (weekly)
    if (i % 7 === 0) {
      data.push({
        type: 'HKQuantityTypeIdentifierBodyMass',
        value: Math.round((70 + Math.random() * 2 - 1) * 10) / 10,
        unit: 'kg',
        startDate: date.toISOString(),
        endDate: date.toISOString(),
        sourceName: 'Health App',
        device: 'iPhone'
      })
    }
    
    // Sleep data
    if (Math.random() > 0.3) {
      const sleepStart = new Date(date)
      sleepStart.setHours(22, 30, 0, 0)
      const sleepEnd = new Date(sleepStart)
      sleepEnd.setHours(sleepEnd.getHours() + 7 + Math.random() * 2)
      
      data.push({
        type: 'HKCategoryTypeIdentifierSleepAnalysis',
        value: 'HKCategoryValueSleepAnalysisAsleep',
        unit: '',
        startDate: sleepStart.toISOString(),
        endDate: sleepEnd.toISOString(),
        sourceName: 'Apple Watch',
        device: 'Apple Watch Series 8'
      })
    }
  }
  
  return data
}

const connectSource = (source: any) => {
  // In a real implementation, this would handle OAuth or API connections
  console.log('Connecting to', source.name)
  // For demo purposes, show a message
  alert(`Connecting to ${source.name} would require OAuth integration in a real implementation.`)
}

const getSourceStatus = (sourceId: string) => {
  // Check if source is connected
  const connectedSources = vectorStore.activeDataSources
  return connectedSources.some(s => s.source_type === sourceId) ? 'Connected' : 'Not Connected'
}

const getStatusIcon = (status: string) => {
  const icons = {
    pending: ClockIcon,
    processing: ClockIcon,
    completed: CheckCircleIcon,
    failed: XCircleIcon
  }
  return icons[status as keyof typeof icons] || ClockIcon
}

const getStatusColor = (status: string) => {
  const colors = {
    pending: {
      bg: 'bg-warning-100',
      text: 'text-warning-600',
      badge: 'bg-warning-100 text-warning-800'
    },
    processing: {
      bg: 'bg-primary-100',
      text: 'text-primary-600',
      badge: 'bg-primary-100 text-primary-800'
    },
    completed: {
      bg: 'bg-success-100',
      text: 'text-success-600',
      badge: 'bg-success-100 text-success-800'
    },
    failed: {
      bg: 'bg-error-100',
      text: 'text-error-600',
      badge: 'bg-error-100 text-error-800'
    }
  }
  return colors[status as keyof typeof colors] || colors.pending
}

const formatSourceName = (source: string) => {
  const names = {
    apple_health: 'Apple Health',
    google_fit: 'Google Fit',
    fitbit: 'Fitbit',
    garmin: 'Garmin Connect',
    manual: 'Manual Upload'
  }
  return names[source as keyof typeof names] || source
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'MMM d, yyyy HH:mm')
}

const showErrors = (session: ImportSession) => {
  selectedSession.value = {
    ...session,
    error_log: [...session.error_log] // Convert readonly array to mutable
  }
}

const viewImportDetails = (session: ImportSession) => {
  detailsSession.value = {
    ...session,
    error_log: [...session.error_log] // Convert readonly array to mutable
  }
}

const viewImportedDocuments = (session: ImportSession) => {
  detailsSession.value = null
  // Navigate to health documents filtered by this import session
  router.push(`/health?import=${session.id}`)
}

const handleFileInputClick = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

// Watch for import progress updates
watch(() => vectorStore.importSessions, (sessions) => {
  if (currentImport.value) {
    const updated = sessions.find(s => s.id === currentImport.value?.id)
    if (updated) {
      currentImport.value = {
        ...updated,
        error_log: [...updated.error_log] // Convert readonly array to mutable
      }
      
      // Clear current import when completed or failed
      if (updated.status === 'completed' || updated.status === 'failed') {
        setTimeout(() => {
          currentImport.value = null
        }, 3000)
      }
    }
  }
}, { deep: true })

onMounted(async () => {
  await Promise.all([
    vectorStore.fetchImportSessions(),
    vectorStore.fetchDataSources()
  ])
})
</script>