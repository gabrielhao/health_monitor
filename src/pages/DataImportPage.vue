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
                <button @click="$refs.fileInput?.click()" class="text-primary-600 hover:text-primary-500">
                  Click to upload
                </button>
                or drag and drop
              </p>
              <p class="text-sm text-neutral-500">
                Supports XML, JSON, CSV, ZIP files up to 5GB
              </p>
              <p class="text-xs text-warning-600 mt-2">
                ⚠️ Large files (>100MB) may take several minutes to process
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
              
              <!-- Large file warning -->
              <div v-if="uploadForm.file.size > 100 * 1024 * 1024" class="mt-2 p-2 bg-warning-50 border border-warning-200 rounded">
                <p class="text-xs text-warning-700">
                  <strong>Large File Detected:</strong> This file is {{ formatFileSize(uploadForm.file.size) }}. 
                  Processing may take 5-15 minutes depending on file complexity.
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

          <!-- Processing Options for Large Files -->
          <div v-if="uploadForm.file && uploadForm.file.size > 100 * 1024 * 1024" class="space-y-3">
            <div class="border border-warning-200 rounded-lg p-4 bg-warning-50">
              <h4 class="font-medium text-warning-900 mb-2">Large File Processing Options</h4>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input 
                    type="radio" 
                    v-model="uploadForm.processingMode" 
                    value="streaming" 
                    class="mr-2"
                  />
                  <span class="text-sm text-warning-800">
                    <strong>Streaming Mode (Recommended)</strong> - Process file in chunks to avoid memory issues
                  </span>
                </label>
                <label class="flex items-center">
                  <input 
                    type="radio" 
                    v-model="uploadForm.processingMode" 
                    value="full" 
                    class="mr-2"
                  />
                  <span class="text-sm text-warning-800">
                    <strong>Full Load</strong> - Load entire file into memory (may fail for very large files)
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
                <h3 class="text-sm font-medium text-error-800">Import Failed</h3>
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

          <!-- Processing Progress -->
          <div v-if="processingProgress.active" class="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-primary-900">{{ processingProgress.stage }}</span>
              <span class="text-sm text-primary-700">{{ processingProgress.percentage }}%</span>
            </div>
            <div class="w-full bg-primary-200 rounded-full h-2">
              <div 
                class="bg-primary-600 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${processingProgress.percentage}%` }"
              ></div>
            </div>
            <p class="text-xs text-primary-700 mt-2">{{ processingProgress.message }}</p>
          </div>

          <button
            @click="handleUpload"
            :disabled="!uploadForm.source || !uploadForm.file || vectorStore.importing || processingProgress.active"
            class="btn-primary w-full"
          >
            <div v-if="vectorStore.importing || processingProgress.active" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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

    <!-- Import Progress -->
    <div v-if="currentImport" class="card mb-8">
      <h2 class="text-xl font-semibold text-neutral-900 mb-4">Import Progress</h2>
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
          ✓ Import completed successfully
        </div>
        <div v-if="currentImport.status === 'failed'" class="text-sm text-error-600">
          ✗ Import failed
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
            <button v-if="session.error_log.length > 0" @click="showErrors(session)" class="text-sm text-error-600 hover:text-error-500">
              View Errors
            </button>
            <button @click="viewImportDetails(session)" class="text-sm text-primary-600 hover:text-primary-500">
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
import { format } from 'date-fns'
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

const showSampleData = ref(false)
const selectedSession = ref<ImportSession | null>(null)
const detailsSession = ref<ImportSession | null>(null)
const currentImport = ref<ImportSession | null>(null)
const fileInput = ref<HTMLInputElement>()
const uploadError = ref('')
const uploadErrorDetails = ref('')

const processingProgress = reactive({
  active: false,
  stage: '',
  percentage: 0,
  message: ''
})

const uploadForm = reactive({
  source: '',
  file: null as File | null,
  notes: '',
  processingMode: 'streaming'
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
  
  // Set default processing mode based on file size
  if (file.size > 100 * 1024 * 1024) {
    uploadForm.processingMode = 'streaming'
  }
  
  return true
}

const getUploadButtonText = () => {
  if (processingProgress.active) {
    return 'Processing File...'
  }
  if (vectorStore.importing) {
    return 'Importing Data...'
  }
  if (uploadForm.file && uploadForm.file.size > 100 * 1024 * 1024) {
    return 'Import Large File'
  }
  return 'Import Data'
}

const updateProgress = (stage: string, percentage: number, message: string) => {
  processingProgress.active = true
  processingProgress.stage = stage
  processingProgress.percentage = percentage
  processingProgress.message = message
}

const clearProgress = () => {
  processingProgress.active = false
  processingProgress.stage = ''
  processingProgress.percentage = 0
  processingProgress.message = ''
}

const handleUpload = async () => {
  if (!uploadForm.source || !uploadForm.file) return

  uploadError.value = ''
  uploadErrorDetails.value = ''

  try {
    updateProgress('Preparing file...', 10, 'Validating file format and size')

    // For large files, use streaming approach
    if (uploadForm.file.size > 100 * 1024 * 1024 && uploadForm.processingMode === 'streaming') {
      await handleLargeFileUpload()
    } else {
      await handleStandardUpload()
    }

  } catch (error: any) {
    console.error('Upload failed:', error)
    uploadError.value = error.message || 'Upload failed. Please try again.'
    uploadErrorDetails.value = error.stack || error.toString()
  } finally {
    clearProgress()
  }
}

const handleStandardUpload = async () => {
  if (!uploadForm.file) return

  updateProgress('Reading file...', 20, 'Loading file content into memory')

  // Read file content
  const fileContent = await readFileContent(uploadForm.file)
  
  updateProgress('Parsing data...', 50, 'Extracting health records from file')

  // Parse data based on file type and source
  const parsedData = await parseFileData(fileContent, uploadForm.file, uploadForm.source)
  
  if (!parsedData || parsedData.length === 0) {
    throw new Error('No valid health data found in the file')
  }

  updateProgress('Importing to database...', 80, `Processing ${parsedData.length} health records`)

  const importSession = await vectorStore.importHealthData({
    source: uploadForm.source,
    data: parsedData,
    metadata: {
      filename: uploadForm.file.name,
      filesize: uploadForm.file.size,
      filetype: uploadForm.file.type,
      notes: uploadForm.notes,
      processing_mode: 'standard',
      uploaded_at: new Date().toISOString()
    }
  })

  currentImport.value = importSession

  // Reset form
  uploadForm.source = ''
  uploadForm.file = null
  uploadForm.notes = ''
  
  // Refresh import sessions
  await vectorStore.fetchImportSessions()
}

const handleLargeFileUpload = async () => {
  if (!uploadForm.file) return

  updateProgress('Streaming file...', 20, 'Reading file in chunks to avoid memory issues')

  try {
    // For very large files, we'll process them in chunks
    const chunkSize = 10 * 1024 * 1024 // 10MB chunks
    const totalChunks = Math.ceil(uploadForm.file.size / chunkSize)
    let processedChunks = 0
    let allData: any[] = []

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, uploadForm.file.size)
      const chunk = uploadForm.file.slice(start, end)
      
      updateProgress(
        'Processing chunks...', 
        20 + (processedChunks / totalChunks) * 40,
        `Processing chunk ${i + 1} of ${totalChunks}`
      )

      const chunkContent = await readFileContent(chunk)
      
      // For XML files, we need special handling to avoid breaking XML structure
      if (uploadForm.file.name.toLowerCase().endsWith('.xml')) {
        if (i === 0) {
          // First chunk - parse what we can
          const chunkData = await parseXMLChunk(chunkContent, true)
          allData.push(...chunkData)
        } else if (i === totalChunks - 1) {
          // Last chunk
          const chunkData = await parseXMLChunk(chunkContent, false, true)
          allData.push(...chunkData)
        } else {
          // Middle chunks - extract records
          const chunkData = await parseXMLChunk(chunkContent, false, false)
          allData.push(...chunkData)
        }
      } else {
        // For JSON/CSV, try to parse each chunk
        try {
          const chunkData = await parseFileData(chunkContent, chunk, uploadForm.source)
          if (chunkData && chunkData.length > 0) {
            allData.push(...chunkData)
          }
        } catch (error) {
          console.warn(`Failed to parse chunk ${i + 1}:`, error)
        }
      }

      processedChunks++
    }

    if (allData.length === 0) {
      throw new Error('No valid health data found in the file after chunk processing')
    }

    updateProgress('Importing to database...', 80, `Processing ${allData.length} health records`)

    const importSession = await vectorStore.importHealthData({
      source: uploadForm.source,
      data: allData,
      metadata: {
        filename: uploadForm.file.name,
        filesize: uploadForm.file.size,
        filetype: uploadForm.file.type,
        notes: uploadForm.notes,
        processing_mode: 'streaming',
        chunks_processed: totalChunks,
        uploaded_at: new Date().toISOString()
      }
    })

    currentImport.value = importSession

    // Reset form
    uploadForm.source = ''
    uploadForm.file = null
    uploadForm.notes = ''
    
    // Refresh import sessions
    await vectorStore.fetchImportSessions()

  } catch (error) {
    throw new Error(`Large file processing failed: ${error}`)
  }
}

const parseXMLChunk = async (content: string, isFirst: boolean, isLast: boolean = false): Promise<any[]> => {
  try {
    // For Apple Health XML, look for Record elements
    const recordMatches = content.match(/<Record[^>]*>.*?<\/Record>/g)
    if (!recordMatches) return []

    const data = []
    for (const recordXML of recordMatches) {
      try {
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(`<root>${recordXML}</root>`, 'text/xml')
        const record = xmlDoc.getElementsByTagName('Record')[0]
        
        if (record) {
          const type = record.getAttribute('type') || ''
          const value = record.getAttribute('value') || ''
          const unit = record.getAttribute('unit') || ''
          const startDate = record.getAttribute('startDate') || ''
          const endDate = record.getAttribute('endDate') || ''
          const sourceName = record.getAttribute('sourceName') || ''
          const sourceVersion = record.getAttribute('sourceVersion') || ''
          const device = record.getAttribute('device') || ''
          
          data.push({
            type,
            value: isNaN(Number(value)) ? value : Number(value),
            unit,
            startDate,
            endDate,
            sourceName,
            sourceVersion,
            device
          })
        }
      } catch (error) {
        console.warn('Failed to parse individual record:', error)
      }
    }

    return data
  } catch (error) {
    console.warn('Failed to parse XML chunk:', error)
    return []
  }
}

const readFileContent = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

const parseFileData = async (content: string, file: File | Blob, source: string) => {
  const fileName = file instanceof File ? file.name : 'unknown'
  const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase()
  
  try {
    switch (fileExtension) {
      case '.json':
        return parseJSONData(content, source)
      case '.csv':
        return parseCSVData(content, source)
      case '.xml':
        return parseXMLData(content, source)
      default:
        throw new Error('Unsupported file format')
    }
  } catch (error) {
    throw new Error(`Failed to parse ${fileExtension} file: ${error}`)
  }
}

const parseJSONData = (content: string, source: string) => {
  const data = JSON.parse(content)
  
  if (Array.isArray(data)) {
    return data
  } else if (data.data && Array.isArray(data.data)) {
    return data.data
  } else {
    return [data]
  }
}

const parseCSVData = (content: string, source: string) => {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) throw new Error('CSV file must have at least a header and one data row')
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const data = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    const row: any = {}
    
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    
    data.push(row)
  }
  
  return data
}

const parseXMLData = (content: string, source: string) => {
  // Simple XML parsing for Apple Health exports
  if (source === 'apple_health') {
    return parseAppleHealthXML(content)
  }
  
  // For other XML formats, convert to JSON-like structure
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(content, 'text/xml')
  
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid XML format')
  }
  
  return extractXMLData(xmlDoc)
}

const parseAppleHealthXML = (content: string) => {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(content, 'text/xml')
  
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid Apple Health XML format')
  }
  
  const records = xmlDoc.getElementsByTagName('Record')
  const data = []
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const type = record.getAttribute('type') || ''
    const value = record.getAttribute('value') || ''
    const unit = record.getAttribute('unit') || ''
    const startDate = record.getAttribute('startDate') || ''
    const endDate = record.getAttribute('endDate') || ''
    const sourceName = record.getAttribute('sourceName') || ''
    const sourceVersion = record.getAttribute('sourceVersion') || ''
    const device = record.getAttribute('device') || ''
    
    data.push({
      type,
      value: isNaN(Number(value)) ? value : Number(value),
      unit,
      startDate,
      endDate,
      sourceName,
      sourceVersion,
      device
    })
  }
  
  return data
}

const extractXMLData = (xmlDoc: Document) => {
  // Generic XML to object conversion
  const data: any[] = []
  const rootElement = xmlDoc.documentElement
  
  const extractElement = (element: Element): any => {
    const obj: any = {}
    
    // Add attributes
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i]
      obj[attr.name] = attr.value
    }
    
    // Add child elements
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i]
      const childData = extractElement(child)
      
      if (obj[child.tagName]) {
        if (!Array.isArray(obj[child.tagName])) {
          obj[child.tagName] = [obj[child.tagName]]
        }
        obj[child.tagName].push(childData)
      } else {
        obj[child.tagName] = childData
      }
    }
    
    // Add text content if no children
    if (element.children.length === 0 && element.textContent?.trim()) {
      return element.textContent.trim()
    }
    
    return obj
  }
  
  if (rootElement.children.length > 0) {
    for (let i = 0; i < rootElement.children.length; i++) {
      data.push(extractElement(rootElement.children[i]))
    }
  } else {
    data.push(extractElement(rootElement))
  }
  
  return data
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
  selectedSession.value = session
}

const viewImportDetails = (session: ImportSession) => {
  detailsSession.value = session
}

const viewImportedDocuments = (session: ImportSession) => {
  detailsSession.value = null
  // Navigate to health documents filtered by this import session
  router.push(`/health?import=${session.id}`)
}

// Watch for import progress updates
watch(() => vectorStore.importSessions, (sessions) => {
  if (currentImport.value) {
    const updated = sessions.find(s => s.id === currentImport.value?.id)
    if (updated) {
      currentImport.value = updated
      
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