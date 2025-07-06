<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-neutral-900">Health Data Import</h1>
      <p class="text-neutral-600 mt-1">
        Import and manage health data from various sources
      </p>
    </div>

    <!-- Data Sources Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div
        v-for="source in supportedSources"
        :key="source.id"
        class="metric-card card"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div
              :class="`w-12 h-12 rounded-lg flex items-center justify-center ${source.bgColor}`"
            >
              <component
                :is="source.icon"
                :class="`w-6 h-6 ${source.iconColor}`"
              />
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
        <h2 class="text-xl font-semibold text-neutral-900 mb-6">
          Upload Health Documents
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">
              Data Source
            </label>
            <select
              v-model="uploadForm.source"
              class="input-field bg-neutral-50/50"
            >
              <option value="">Select source</option>
              <option value="apple_health">Apple Health Export</option>
              <option value="google_fit">Google Fit Export</option>
              <option value="fitbit">Fitbit Export</option>
              <option value="garmin">Garmin Connect</option>
              <option value="manual">Manual Upload</option>
            </select>
          </div>

          <!-- File Upload Drop Zone -->
          <FileUploadDropZone
            :accepted-types="'.xml,.json,.csv,.zip'"
            accepted-types-text="Supports XML, JSON, CSV, ZIP files up to 5GB"
            :max-file-size="5 * 1024 * 1024 * 1024"
            :max-files="1"
            :allow-multiple="false"
            help-text="✓ Large files automatically use chunked upload with resume capability"
            @files-selected="handleFilesSelected"
            @validation-error="handleValidationError"
            ref="fileUploadRef"
          />

          <div v-if="selectedFiles.length > 0">
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
          <div
            v-if="selectedFiles.length > 0 && selectedFiles[0].size > 100 * 1024 * 1024"
            class="space-y-3"
          >
            <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h4 class="font-medium text-blue-900 mb-2">
                Large File Upload Options
              </h4>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input
                    type="radio"
                    v-model="uploadForm.chunkSize"
                    :value="5 * 1024 * 1024"
                    class="mr-2"
                  />
                  <span class="text-sm text-blue-800">
                    <strong>Standard Chunks (5MB)</strong> - Recommended for
                    most connections
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
                    <strong>Large Chunks (10MB)</strong> - For fast, stable
                    connections
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
                    <strong>Small Chunks (2MB)</strong> - For slower or unstable
                    connections
                  </span>
                </label>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <div
            v-if="uploadError"
            class="bg-error-50 border border-error-200 rounded-lg p-4"
          >
            <div class="flex">
              <div class="flex-shrink-0">
                <ExclamationCircleIcon class="h-5 w-5 text-error-400" />
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-error-800">
                  Upload Failed
                </h3>
                <p class="text-sm text-error-700 mt-1">{{ uploadError }}</p>
                <div v-if="uploadErrorDetails" class="mt-2">
                  <details class="text-xs text-error-600">
                    <summary class="cursor-pointer hover:text-error-800">
                      Show technical details
                    </summary>
                    <pre class="mt-2 whitespace-pre-wrap">{{
                      uploadErrorDetails
                    }}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>

          <button
            @click="handleUpload"
            :disabled="
              !uploadForm.source ||
              selectedFiles.length === 0 ||
              healthStore.processing
            "
            class="btn-primary w-full"
          >
            <div
              v-if="healthStore.processing"
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
            ></div>
            {{ getUploadButtonText() }}
          </button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card">
        <h2 class="text-xl font-semibold text-neutral-900 mb-6">
          Quick Actions
        </h2>

        <div class="space-y-4">
          <button
            class="w-full btn-outline text-left flex items-center bg-neutral-50/50"
          >
            <DevicePhoneMobileIcon class="w-5 h-5 mr-3 text-neutral-500" />
            <div>
              <p class="font-medium">Connect Apple Health</p>
              <p class="text-sm text-neutral-500">
                Sync data from iPhone Health app
              </p>
            </div>
          </button>

          <button
            class="w-full btn-outline text-left flex items-center bg-neutral-50/50"
          >
            <CloudIcon class="w-5 h-5 mr-3 text-neutral-500" />
            <div>
              <p class="font-medium">Google Fit Integration</p>
              <p class="text-sm text-neutral-500">
                Connect your Google Fit account
              </p>
            </div>
          </button>

          <button
            class="w-full btn-outline text-left flex items-center bg-neutral-50/50"
          >
            <ClockIcon class="w-5 h-5 mr-3 text-neutral-500" />
            <div>
              <p class="font-medium">Wearable Devices</p>
              <p class="text-sm text-neutral-500">Connect fitness trackers</p>
            </div>
          </button>

          <button
            @click="showSampleData = true"
            class="w-full btn-outline text-left flex items-center bg-neutral-50/50"
          >
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
    <UploadProgressList
      v-if="healthStore.uploadProgress.length > 0"
      :progress-items="progressItems"
      title="Processing Progress"
      @clear-progress="healthStore.clearProgress"
      class="mb-8"
    />

    <!-- Processing Progress -->
    <div v-if="currentImport" class="card mb-8">
      <h2 class="text-xl font-semibold text-neutral-900 mb-4">
        Processing Progress
      </h2>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-neutral-700"
            >Processing {{ currentImport.source_app }} data...</span
          >
          <span class="text-sm text-neutral-500"
            >{{ currentImport.processed_records }} /
            {{ currentImport.total_records }}</span
          >
        </div>
        <div class="w-full bg-neutral-200 rounded-full h-2">
          <div
            class="bg-primary-600 h-2 rounded-full transition-all duration-300"
            :style="{
              width: `${(currentImport.processed_records / currentImport.total_records) * 100}%`,
            }"
          ></div>
        </div>
        <div
          v-if="currentImport.status === 'completed'"
          class="text-sm text-success-600"
        >
          ✓ Processing completed successfully
        </div>
        <div
          v-if="currentImport.status === 'failed'"
          class="text-sm text-error-600"
        >
          ✗ Processing failed
        </div>
      </div>
    </div>

    <!-- Document Library -->
    <DocumentLibrary
      :documents="[...healthStore.documents]"
      :loading="healthStore.loading"
      title="Health Documents"
      empty-title="No health documents yet"
      empty-message="Upload your first health data to get started."
      :get-title="getDocumentTitle"
      :get-size="getDocumentSize"
      :get-date="getDocumentDate"
      :get-status="getDocumentStatus"
      :get-file-icon="getDocumentIcon"
      @refresh="healthStore.fetchDocuments"
      class="mb-8"
    />

    <!-- Import History - COMMENTED OUT -->
    <!--
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-neutral-900">Import History</h2>
        <button
          @click="healthStore.fetchImportSessions()"
          class="text-sm text-primary-600 hover:text-primary-500"
        >
          Refresh
        </button>
      </div>

      <div v-if="healthStore.loading" class="animate-pulse">
        <div v-for="i in 3" :key="i" class="flex items-center space-x-4 mb-4">
          <div class="w-10 h-10 bg-neutral-200 rounded-lg"></div>
          <div class="flex-1">
            <div class="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
            <div class="h-3 bg-neutral-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>

      <div
        v-else-if="healthStore.importSessions.length === 0"
        class="text-center py-8"
      >
        <CloudArrowUpIcon class="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <p class="text-neutral-500">No import history yet</p>
        <p class="text-sm text-neutral-400">
          Your data imports will appear here
        </p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="session in healthStore.importSessions"
          :key="session.id"
          class="flex items-center justify-between p-4 bg-neutral-50/50 rounded-lg"
        >
          <div class="flex items-center space-x-4">
            <div
              :class="`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(session.status).bg}`"
            >
              <component
                :is="getStatusIcon(session.status)"
                :class="`w-5 h-5 ${getStatusColor(session.status).text}`"
              />
            </div>
            <div>
              <p class="font-medium text-neutral-900">
                {{ formatSourceName(session.source_app) }}
              </p>
              <p class="text-sm text-neutral-500">
                {{ session.processed_records }} of
                {{ session.total_records }} records processed
              </p>
              <p class="text-xs text-neutral-400">
                {{ formatDate(session.started_at) }}
              </p>
            </div>
          </div>

          <div class="flex items-center space-x-3">
            <span
              :class="`px-2 py-1 rounded-full text-xs ${getStatusColor(session.status).badge}`"
            >
              {{ session.status }}
            </span>
            <button
              v-if="session.error_log.length > 0"
              @click="showErrors(session)"
              class="text-sm text-error-600 hover:text-error-500"
            >
              View Errors
            </button>
            <button
              @click="viewImportDetails(session)"
              class="text-sm text-primary-600 hover:text-primary-500"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
    -->

    <!-- Sample Data Modal -->
    <div
      v-if="showSampleData"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">
          Import Sample Data
        </h3>
        <p class="text-neutral-600 mb-6">
          This will import sample health data to help you explore the features
          of Aivital.
        </p>
        <div class="flex space-x-3">
          <button
            @click="importSampleData"
            :disabled="healthStore.processing"
            class="btn-primary flex-1"
          >
            Import Sample Data
          </button>
          <button @click="showSampleData = false" class="btn-outline flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Error Details Modal - COMMENTED OUT -->
    <!--
    <div
      v-if="selectedSession"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">
          Import Errors
        </h3>
        <div class="max-h-64 overflow-y-auto space-y-2">
          <div
            v-for="(error, index) in selectedSession.error_log"
            :key="index"
            class="p-3 bg-error-50 rounded-lg"
          >
            <p class="text-sm font-medium text-error-900">
              {{ error.item || 'Unknown item' }}
            </p>
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

    <!-- Import Details Modal - COMMENTED OUT -->
    <div
      v-if="detailsSession"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white rounded-xl shadow-lg max-w-4xl w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">
          Import Details
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 class="font-medium text-neutral-900 mb-2">
              Import Information
            </h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-neutral-600">Source:</span>
                <span class="font-medium">{{
                  formatSourceName(detailsSession.source_app)
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Status:</span>
                <span
                  :class="`font-medium ${getStatusColor(detailsSession.status).text}`"
                  >{{ detailsSession.status }}</span
                >
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Started:</span>
                <span>{{ formatDate(detailsSession.started_at) }}</span>
              </div>
              <div
                v-if="detailsSession.completed_at"
                class="flex justify-between"
              >
                <span class="text-neutral-600">Completed:</span>
                <span>{{ formatDate(detailsSession.completed_at) }}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="font-medium text-neutral-900 mb-2">
              Processing Summary
            </h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-neutral-600">Total Records:</span>
                <span class="font-medium">{{
                  detailsSession.total_records
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Processed:</span>
                <span class="font-medium text-success-600">{{
                  detailsSession.processed_records
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Failed:</span>
                <span class="font-medium text-error-600">{{
                  detailsSession.failed_records
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-neutral-600">Success Rate:</span>
                <span class="font-medium"
                  >{{
                    Math.round(
                      (detailsSession.processed_records /
                        detailsSession.total_records) *
                        100
                    )
                  }}%</span
                >
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="
            detailsSession.metadata &&
            Object.keys(detailsSession.metadata).length > 0
          "
          class="mb-6"
        >
          <h4 class="font-medium text-neutral-900 mb-2">Metadata</h4>
          <div class="bg-neutral-50/50 rounded-lg p-3">
            <pre class="text-sm text-neutral-700">{{
              JSON.stringify(detailsSession.metadata, null, 2)
            }}</pre>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button
            @click="viewImportedDocuments(detailsSession)"
            class="btn-outline"
          >
            View Imported Data
          </button>
          <button @click="detailsSession = null" class="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
    -->
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useHealthStore } from '@/stores/health';
import { useExternalFileUpload } from '@/composables/useExternalFileUpload';
import { format } from 'date-fns';
import FileUploadDropZone from '@/components/shared/FileUploadDropZone.vue';
import UploadProgressList from '@/components/shared/UploadProgressList.vue';
import DocumentLibrary from '@/components/shared/DocumentLibrary.vue';
import type { HealthImportSession, HealthDocument } from '@/types/health';
import type { UploadProgressItem } from '@/composables/useUploadProgress';
import {
  // CloudArrowUpIcon, // Removed unused icon
  DevicePhoneMobileIcon,
  CloudIcon,
  BeakerIcon,
  ExclamationCircleIcon,
  ClockIcon,
} from '@heroicons/vue/24/outline';

const healthStore = useHealthStore();
// const router = useRouter(); // Removed unused router
const fileUpload = useExternalFileUpload();
// const { getFileIcon } = useFileValidation(); // Removed unused function

const showSampleData = ref(false);
// Import history related refs - COMMENTED OUT
// const selectedSession = ref<HealthImportSession | null>(null);
const detailsSession = ref<HealthImportSession | null>(null);
const currentImport = ref<HealthImportSession | null>(null);
const fileUploadRef = ref();
const uploadError = ref('');
const uploadErrorDetails = ref('');
const selectedFiles = ref<File[]>([]);

const uploadForm = reactive({
  source: '',
  notes: '',
  chunkSize: 5 * 1024 * 1024, // Default 5MB chunks
});

const supportedSources = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    description: 'iPhone Health app data',
    icon: DevicePhoneMobileIcon,
    bgColor: 'bg-primary-100',
    iconColor: 'text-primary-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800',
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    description: 'Google fitness tracking',
    icon: CloudIcon,
    bgColor: 'bg-success-100',
    iconColor: 'text-success-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Fitbit device data',
    icon: ClockIcon,
    bgColor: 'bg-secondary-100',
    iconColor: 'text-secondary-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800',
  },
  {
    id: 'garmin',
    name: 'Garmin',
    description: 'Garmin Connect data',
    icon: ClockIcon,
    bgColor: 'bg-accent-100',
    iconColor: 'text-accent-600',
    connected: false,
    statusColor: 'bg-neutral-100 text-neutral-800',
  },
];

// Transform health store progress to match component interface
const progressItems = computed((): UploadProgressItem[] => {
  return healthStore.uploadProgress.map(item => ({
    filename: item.filename,
    size: item.size,
    status: item.status,
    progress: item.progress,
    error: item.error,
    speed: item.speed,
    eta: item.eta
  }));
});

const handleFilesSelected = (files: File[]) => {
  selectedFiles.value = files;
  uploadError.value = '';
  uploadErrorDetails.value = '';
};

const handleValidationError = (errors: any[]) => {
  uploadError.value = errors.map(e => e.reason).join(', ');
};

const getUploadButtonText = () => {
  if (healthStore.processing) {
    return 'Processing...';
  }
  if (selectedFiles.value.length > 0 && selectedFiles.value[0].size > 100 * 1024 * 1024) {
    return 'Upload Large File';
  }
  return 'Import Data';
};

const handleUpload = async () => {
  if (!uploadForm.source || selectedFiles.value.length === 0) return;

  uploadError.value = '';
  uploadErrorDetails.value = '';

  try {
    const file = selectedFiles.value[0];
    
    // Initialize current import with proper typing
    currentImport.value = {
      id: `import-${Date.now()}`,
      user_id: '', // Will be set by store
      source_app: uploadForm.source,
      status: 'processing',
      total_records: 0,
      processed_records: 0,
      failed_records: 0,
      error_log: [],
      metadata: {
        filename: file.name,
        filesize: file.size,
        notes: uploadForm.notes,
        chunk_size: uploadForm.chunkSize,
      },
      started_at: new Date().toISOString(),
      _partitionKey: '', // Will be set by store
    };

    // Process file using existing upload service
    await fileUpload.uploadFile(file, {
      onProgress: (progress) => {
        console.log(`Processing progress: ${progress}%`);
        if (currentImport.value) {
          currentImport.value.processed_records = Math.round(
            (Number(progress) / 100) * (currentImport.value.total_records || 1)
          );
        }
      },
    });

    // Clear form
    uploadForm.source = '';
    uploadForm.notes = '';
    selectedFiles.value = [];
    fileUploadRef.value?.clearFiles();

    // Refresh import sessions - COMMENTED OUT
    // await healthStore.fetchImportSessions();
  } catch (error: any) {
    console.error('Processing failed:', error);
    uploadError.value = error.message || 'Processing failed. Please try again.';
    uploadErrorDetails.value = error.stack || error.toString();

    if (currentImport.value) {
      currentImport.value.status = 'failed';
      currentImport.value.error_log = [
        ...currentImport.value.error_log,
        {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      ];
    }
  }
};

const importSampleData = async () => {
  try {
    const sampleData = generateSampleAppleHealthData();

    const importSession = await healthStore.importHealthData({
      source: 'apple_health',
      data: sampleData,
      metadata: {
        type: 'sample_data',
        generated_at: new Date().toISOString(),
        description: 'Sample Apple Health data for demonstration',
      },
      _partitionKey: '', // Will be set by store
    });

    currentImport.value = importSession;
    showSampleData.value = false;

    // await healthStore.fetchImportSessions(); // COMMENTED OUT - import history removed
  } catch (error) {
    console.error('Sample data import failed:', error);
    uploadError.value = 'Failed to import sample data';
  }
};

const generateSampleAppleHealthData = () => {
  const now = new Date();
  const data = [];

  // Generate sample data for the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // Heart rate data
    data.push({
      type: 'HKQuantityTypeIdentifierHeartRate',
      value: 65 + Math.random() * 20,
      unit: 'count/min',
      startDate: date.toISOString(),
      endDate: date.toISOString(),
      sourceName: 'Apple Watch',
      device: 'Apple Watch Series 8',
    });

    // Step count
    data.push({
      type: 'HKQuantityTypeIdentifierStepCount',
      value: Math.floor(8000 + Math.random() * 4000),
      unit: 'count',
      startDate: date.toISOString(),
      endDate: date.toISOString(),
      sourceName: 'iPhone',
      device: 'iPhone 14 Pro',
    });

    // Weight (weekly)
    if (i % 7 === 0) {
      data.push({
        type: 'HKQuantityTypeIdentifierBodyMass',
        value: Math.round((70 + Math.random() * 2 - 1) * 10) / 10,
        unit: 'kg',
        startDate: date.toISOString(),
        endDate: date.toISOString(),
        sourceName: 'Health App',
        device: 'iPhone',
      });
    }

    // Sleep data
    if (Math.random() > 0.3) {
      const sleepStart = new Date(date);
      sleepStart.setHours(22, 30, 0, 0);
      const sleepEnd = new Date(sleepStart);
      sleepEnd.setHours(sleepEnd.getHours() + 7 + Math.random() * 2);

      data.push({
        type: 'HKCategoryTypeIdentifierSleepAnalysis',
        value: 'HKCategoryValueSleepAnalysisAsleep',
        unit: '',
        startDate: sleepStart.toISOString(),
        endDate: sleepEnd.toISOString(),
        sourceName: 'Apple Watch',
        device: 'Apple Watch Series 8',
      });
    }
  }

  return data;
};

// Document library helper functions
const getDocumentTitle = (doc: HealthDocument) => {
  return doc.title || doc.document_type || 'Untitled Document';
};

const getDocumentSize = (doc: HealthDocument) => {
  return doc.metadata?.filesize || 0;
};

const getDocumentDate = (doc: HealthDocument) => {
  return doc.created_at;
};

const getDocumentStatus = (doc: HealthDocument) => {
  return doc.processed_at ? 'completed' : 'processing';
};

const getDocumentIcon = (doc: HealthDocument) => {
  const type = doc.document_type || '';
  if (type.includes('xml')) return '📋';
  if (type.includes('json')) return '🔧';
  if (type.includes('csv')) return '📊';
  return '📄';
};

// Utility functions
const connectSource = (source: any) => {
  console.log('Connecting to', source.name);
  alert(
    `Connecting to ${source.name} would require OAuth integration in a real implementation.`
  );
};

const getSourceStatus = (_sourceId: string) => {
  return 'Not Connected';
};


const getStatusColor = (status: string) => {
  const colors = {
    pending: {
      bg: 'bg-warning-100',
      text: 'text-warning-600',
      badge: 'bg-warning-100 text-warning-800',
    },
    processing: {
      bg: 'bg-primary-100',
      text: 'text-primary-600',
      badge: 'bg-primary-100 text-primary-800',
    },
    completed: {
      bg: 'bg-success-100',
      text: 'text-success-600',
      badge: 'bg-success-100 text-success-800',
    },
    failed: {
      bg: 'bg-error-100',
      text: 'text-error-600',
      badge: 'bg-error-100 text-error-800',
    },
  };
  return colors[status as keyof typeof colors] || colors.pending;
};

const formatSourceName = (source: string) => {
  const names = {
    apple_health: 'Apple Health',
    google_fit: 'Google Fit',
    fitbit: 'Fitbit',
    garmin: 'Garmin Connect',
    manual: 'Manual Upload',
  };
  return names[source as keyof typeof names] || source;
};

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'MMM d, yyyy HH:mm');
};

// Import history functions


const viewImportedDocuments = (session: HealthImportSession) => {
  detailsSession.value = null;
  // router.push(`/health?import=${session.id}`); // Router not available
  console.log('View imported documents for session:', session.id);
};

onMounted(async () => {
  await Promise.all([
    // healthStore.fetchImportSessions(), // COMMENTED OUT - import history removed
    healthStore.fetchDocuments(),
  ]);
});
</script>

<style scoped>
.card {
  background: rgba(255, 255, 255, 0.45);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-radius: 1rem;
  border-style: none;
  padding: 1.5rem;
  backdrop-filter: blur(2px);
}
</style>
