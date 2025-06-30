<template>
  <div class="card">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-neutral-900">{{ title }}</h2>
      <button v-if="showClearButton" @click="$emit('clearProgress')" class="btn-outline">
        Clear Progress
      </button>
    </div>
    
    <div class="space-y-4">
      <div 
        v-for="(progress, index) in progressItems" 
        :key="index"
        class="border border-neutral-200 rounded-lg p-4"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-3">
            <span class="text-lg">{{ getFileIcon(progress.filename) }}</span>
            <div>
              <p class="font-medium text-neutral-900">{{ progress.filename }}</p>
              <p class="text-sm text-neutral-500">{{ formatFileSize(progress.size) }}</p>
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
        
        <!-- Additional progress info for chunked uploads -->
        <div v-if="progress.chunks" class="mt-2 text-xs text-neutral-500">
          Chunks: {{ progress.chunks.completed }}/{{ progress.chunks.total }}
          <span v-if="progress.speed" class="ml-2">Speed: {{ progress.speed }}</span>
          <span v-if="progress.eta" class="ml-2">ETA: {{ progress.eta }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ProgressItem {
  filename: string
  size: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
  chunks?: {
    completed: number
    total: number
  }
  speed?: string
  eta?: string
}

interface Props {
  progressItems: ProgressItem[]
  title?: string
  showClearButton?: boolean
}

withDefaults(defineProps<Props>(), {
  title: 'Processing Progress',
  showClearButton: true
})

defineEmits<{
  clearProgress: []
}>()

const getFileIcon = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'pdf': return '📄'
    case 'docx':
    case 'doc': return '📝'
    case 'txt': return '📄'
    case 'json': return '🔧'
    case 'xml': return '📋'
    case 'csv': return '📊'
    case 'zip': return '🗜️'
    default: return '📄'
  }
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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