<template>
  <div class="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-neutral-900">Upload Progress</h3>
      <button
        v-if="uploading"
        @click="$emit('cancel')"
        class="text-sm text-red-600 hover:text-red-700"
      >
        Cancel
      </button>
    </div>

    <!-- File Info -->
    <div class="mb-4">
      <div class="flex items-center space-x-3 mb-2">
        <DocumentIcon class="w-5 h-5 text-neutral-500" />
        <span class="text-sm font-medium text-neutral-900">{{ fileName }}</span>
        <span class="text-xs text-neutral-500">({{ formatBytes(progress.totalBytes) }})</span>
      </div>
      
      <div v-if="isLargeFile" class="text-xs text-warning-600 bg-warning-50 px-2 py-1 rounded">
        Large file detected - using chunked upload
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="mb-4">
      <div class="flex justify-between text-sm text-neutral-600 mb-2">
        <span>{{ Math.round(progress.percentage) }}% complete</span>
        <span>{{ formatBytes(progress.uploadedBytes) }} / {{ formatBytes(progress.totalBytes) }}</span>
      </div>
      
      <div class="w-full bg-neutral-200 rounded-full h-2">
        <div 
          class="bg-primary-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${progress.percentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Chunk Progress (for large files) -->
    <div v-if="isLargeFile && progress.totalChunks > 0" class="mb-4">
      <div class="flex justify-between text-xs text-neutral-500 mb-1">
        <span>Chunk {{ progress.currentChunk }} of {{ progress.totalChunks }}</span>
        <span>{{ formattedSpeed }}</span>
      </div>
      
      <div class="w-full bg-neutral-100 rounded-full h-1">
        <div 
          class="bg-secondary-500 h-1 rounded-full transition-all duration-300"
          :style="{ width: `${(progress.currentChunk / progress.totalChunks) * 100}%` }"
        ></div>
      </div>
    </div>

    <!-- Upload Stats -->
    <div class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span class="text-neutral-500">Speed:</span>
        <span class="font-medium text-neutral-900 ml-1">{{ formattedSpeed }}</span>
      </div>
      <div>
        <span class="text-neutral-500">ETA:</span>
        <span class="font-medium text-neutral-900 ml-1">{{ formattedETA }}</span>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="mt-4 bg-error-50 border border-error-200 rounded-lg p-3">
      <div class="flex">
        <ExclamationTriangleIcon class="w-5 h-5 text-error-400 mr-2" />
        <div>
          <h4 class="text-sm font-medium text-error-800">Upload Failed</h4>
          <p class="text-sm text-error-700 mt-1">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Success State -->
    <div v-if="!uploading && progress.percentage === 100 && !error" class="mt-4 bg-success-50 border border-success-200 rounded-lg p-3">
      <div class="flex">
        <CheckCircleIcon class="w-5 h-5 text-success-400 mr-2" />
        <div>
          <h4 class="text-sm font-medium text-success-800">Upload Complete</h4>
          <p class="text-sm text-success-700 mt-1">File uploaded successfully and ready for processing</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  DocumentIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline'
import type { UploadProgress } from '@/composables/useFileUpload'

interface Props {
  fileName: string
  progress: UploadProgress
  uploading: boolean
  error: string
  formattedSpeed: string
  formattedETA: string
}

const props = defineProps<Props>()

defineEmits<{
  cancel: []
}>()

const isLargeFile = computed(() => props.progress.totalBytes > 100 * 1024 * 1024)

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>