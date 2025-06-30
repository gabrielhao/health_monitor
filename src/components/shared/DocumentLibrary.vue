<template>
  <div class="card">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold text-neutral-900">{{ title }}</h2>
      <div class="flex items-center space-x-4">
        <div class="text-sm text-neutral-600">
          {{ documents.length }} documents | {{ completedCount }} processed
        </div>
        <button @click="$emit('refresh')" class="text-sm text-primary-600 hover:text-primary-500">
          Refresh
        </button>
      </div>
    </div>



    <!-- Documents List -->
    <div v-if="loading" class="animate-pulse">
      <div v-for="i in 3" :key="i" class="flex items-center space-x-4 mb-4">
        <div class="w-10 h-10 bg-neutral-200 rounded-lg"></div>
        <div class="flex-1">
          <div class="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-neutral-200 rounded w-1/2"></div>
        </div>
      </div>
    </div>
    
    <div v-else-if="documents.length === 0" class="text-center py-12">
      <DocumentIcon class="w-16 h-16 text-neutral-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-neutral-900 mb-2">{{ emptyTitle }}</h3>
      <p class="text-neutral-500">{{ emptyMessage }}</p>
    </div>
    
    <div v-else class="space-y-4">
      <div 
        v-for="document in documents" 
        :key="document.id"
        class="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50"
      >
        <div class="flex items-center space-x-4">
          <span class="text-2xl">{{ getFileIcon(document) }}</span>
          <div>
            <h3 class="font-medium text-neutral-900">{{ getTitle(document) }}</h3>
            <div class="flex items-center space-x-4 text-sm text-neutral-500">
              <span>{{ formatFileSize(getSize(document)) }}</span>
              <span>{{ formatDate(getDate(document)) }}</span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <span :class="`px-2 py-1 rounded-full text-xs ${getStatusColor(getStatus(document))}`">
            {{ getStatus(document) }}
          </span>
          <button 
            @click="$emit('delete', document.id)"
            class="text-neutral-400 hover:text-red-600"
          >
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { format } from 'date-fns'
import {
  DocumentIcon,
  // CheckCircleIcon, // Removed unused icons
  // ClockIcon,
  // XCircleIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'

interface Props {
  documents: any[]
  loading?: boolean
  title?: string
  emptyTitle?: string
  emptyMessage?: string
  getTitle: (doc: any) => string
  getSize: (doc: any) => number
  getDate: (doc: any) => string | Date
  getStatus: (doc: any) => string
  getFileIcon?: (doc: any) => string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  title: 'Document Library',
  emptyTitle: 'No documents yet',
  emptyMessage: 'Upload your first documents to get started.'
})

defineEmits<{
  refresh: []
  delete: [id: string]
}>()

const completedCount = computed(() => 
  props.documents.filter(doc => props.getStatus(doc) === 'completed').length
)

const getFileIcon = (document: any) => {
  if (props.getFileIcon) {
    return props.getFileIcon(document)
  }
  return '📄'
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'MMM d, yyyy HH:mm')
}

const getStatusColor = (status: string) => {
  const colors = {
    processing: 'bg-warning-100 text-warning-800',
    completed: 'bg-success-100 text-success-800',
    failed: 'bg-error-100 text-error-800'
  }
  return colors[status as keyof typeof colors] || 'bg-neutral-100 text-neutral-800'
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