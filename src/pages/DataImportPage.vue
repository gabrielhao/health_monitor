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
            <div class="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors duration-200">
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
                Supports XML, JSON, CSV, ZIP files up to 50MB
              </p>
            </div>
            
            <div v-if="uploadForm.file" class="mt-3 p-3 bg-primary-50 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <DocumentIcon class="w-5 h-5 text-primary-600" />
                  <span class="text-sm font-medium text-primary-900">{{ uploadForm.file.name }}</span>
                  <span class="text-xs text-primary-600">({{ formatFileSize(uploadForm.file.size) }})</span>
                </div>
                <button @click="uploadForm.file = null" class="text-primary-600 hover:text-primary-800">
                  <XMarkIcon class="w-4 h-4" />
                </button>
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

          <button
            @click="handleUpload"
            :disabled="!uploadForm.source || !uploadForm.file || vectorStore.importing"
            class="btn-primary w-full"
          >
            <div v-if="vectorStore.importing" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            {{ vectorStore.importing ? 'Processing...' : 'Import Data' }}
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
            <WatchIcon class="w-5 h-5 mr-3 text-neutral-500" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useVectorStore } from '@/stores/vector'
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
import { WatchIcon } from '@heroicons/vue/24/solid'
import type { ImportSession } from '@/types/vector'

const vectorStore = useVectorStore()

const showSampleData = ref(false)
const selectedSession = ref<ImportSession | null>(null)
const fileInput = ref<HTMLInputElement>()

const uploadForm = reactive({
  source: '',
  file: null as File | null,
  notes: ''
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
    icon: WatchIcon,
    bgColor: 'bg-secondary-100',
    iconColor: 'text-secondary-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800'
  },
  {
    id: 'garmin',
    name: 'Garmin',
    description: 'Garmin Connect data',
    icon: WatchIcon,
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
  }
}

const handleUpload = async () => {
  if (!uploadForm.source || !uploadForm.file) return

  try {
    // For demo purposes, we'll create sample data based on file type
    const sampleData = generateSampleDataFromFile(uploadForm.file, uploadForm.source)
    
    await vectorStore.importHealthData({
      source: uploadForm.source,
      data: sampleData,
      metadata: {
        filename: uploadForm.file.name,
        filesize: uploadForm.file.size,
        notes: uploadForm.notes
      }
    })

    // Reset form
    uploadForm.source = ''
    uploadForm.file = null
    uploadForm.notes = ''
    
  } catch (error) {
    console.error('Upload failed:', error)
  }
}

const importSampleData = async () => {
  try {
    const sampleData = generateSampleAppleHealthData()
    
    await vectorStore.importHealthData({
      source: 'apple_health',
      data: sampleData,
      metadata: {
        type: 'sample_data',
        generated_at: new Date().toISOString()
      }
    })
    
    showSampleData.value = false
  } catch (error) {
    console.error('Sample data import failed:', error)
  }
}

const generateSampleDataFromFile = (file: File, source: string) => {
  // In a real implementation, you would parse the actual file
  // For demo purposes, generate sample data
  return generateSampleAppleHealthData()
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
      value: 8000 + Math.random() * 4000,
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
        value: 70 + Math.random() * 2 - 1,
        unit: 'kg',
        startDate: date.toISOString(),
        endDate: date.toISOString(),
        sourceName: 'Health App',
        device: 'iPhone'
      })
    }
  }
  
  return data
}

const connectSource = (source: any) => {
  // In a real implementation, this would handle OAuth or API connections
  console.log('Connecting to', source.name)
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

onMounted(async () => {
  await Promise.all([
    vectorStore.fetchImportSessions(),
    vectorStore.fetchDataSources()
  ])
})
</script>