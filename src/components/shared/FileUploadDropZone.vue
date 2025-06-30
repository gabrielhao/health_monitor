<template>
  <div class="space-y-4">
    <!-- File Drop Zone -->
    <div 
      @drop="handleDrop"
      @dragover.prevent
      @dragenter.prevent="isDragging = true"
      @dragleave="isDragging = false"
      :class="`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
        isDragging ? 'border-primary-400 bg-primary-50' : 'border-neutral-300 hover:border-primary-400'
      }`"
    >
      <input
        ref="fileInput"
        type="file"
        @change="handleFileSelect"
        :accept="acceptedTypes"
        :multiple="allowMultiple"
        class="hidden"
      />
      
      <div class="space-y-3">
        <CloudArrowUpIcon class="w-12 h-12 text-neutral-400 mx-auto" />
        <div>
          <button @click="fileInput?.click()" class="text-primary-600 hover:text-primary-500 font-medium">
            Click to upload {{ allowMultiple ? 'files' : 'file' }}
          </button>
          <span class="text-neutral-600"> or drag and drop</span>
        </div>
        <div class="text-sm text-neutral-500 space-y-1">
          <p>{{ acceptedTypesText }}</p>
          <p v-if="maxFileSize">Max file size: {{ formatFileSize(maxFileSize) }}</p>
          <p v-if="allowMultiple && maxFiles">Max files: {{ maxFiles }}</p>
        </div>
        <p v-if="helpText" class="text-xs text-primary-600 mt-2">{{ helpText }}</p>
      </div>
    </div>

    <!-- Selected Files -->
    <div v-if="selectedFiles.length > 0" class="space-y-2">
      <h3 class="font-medium text-neutral-900">
        Selected {{ allowMultiple ? `Files (${selectedFiles.length})` : 'File' }}
      </h3>
      <div class="max-h-40 overflow-y-auto space-y-2">
        <div 
          v-for="(file, index) in selectedFiles" 
          :key="index"
          class="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <span class="text-lg">{{ getFileIcon(file.type) }}</span>
            <div>
              <p class="text-sm font-medium text-neutral-900">{{ file.name }}</p>
              <p class="text-xs text-neutral-500">{{ formatFileSize(file.size) }}</p>
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
</template>

<script setup lang="ts">
import { ref, readonly } from 'vue'
import {
  CloudArrowUpIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

interface Props {
  acceptedTypes?: string
  acceptedTypesText?: string
  maxFileSize?: number
  maxFiles?: number
  allowMultiple?: boolean
  helpText?: string
  validateFile?: (file: File) => { valid: boolean; reason?: string }
}

interface InvalidFile {
  file: File
  reason: string
}

const props = withDefaults(defineProps<Props>(), {
  acceptedTypes: '.pdf,.docx,.txt,.csv,.json,.xml',
  acceptedTypesText: 'Supports: PDF, DOCX, TXT, CSV, JSON, XML',
  maxFileSize: 1024 * 1024 * 1024, // 1GB
  maxFiles: 50,
  allowMultiple: true,
  helpText: ''
})

const emit = defineEmits<{
  filesSelected: [files: File[]]
  fileRemoved: [file: File, index: number]
  validationError: [errors: InvalidFile[]]
}>()

const selectedFiles = ref<File[]>([])
const invalidFiles = ref<InvalidFile[]>([])
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement>()

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
  const newValidFiles: File[] = []
  const newInvalidFiles: InvalidFile[] = []

  Array.from(fileList).forEach(file => {
    // Check for duplicates
    if (selectedFiles.value.some(f => f.name === file.name && f.size === file.size)) {
      newInvalidFiles.push({ file, reason: 'File already selected' })
      return
    }

    // Check file count limit
    if (!props.allowMultiple && selectedFiles.value.length >= 1) {
      newInvalidFiles.push({ file, reason: 'Only one file allowed' })
      return
    }

    if (props.allowMultiple && selectedFiles.value.length + newValidFiles.length >= props.maxFiles) {
      newInvalidFiles.push({ file, reason: `Maximum ${props.maxFiles} files allowed` })
      return
    }

    // Check file size
    if (file.size > props.maxFileSize) {
      newInvalidFiles.push({ file, reason: `File size exceeds ${formatFileSize(props.maxFileSize)}` })
      return
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    const allowedTypes = props.acceptedTypes.split(',').map(t => t.trim().toLowerCase())
    if (!allowedTypes.includes(fileExtension)) {
      newInvalidFiles.push({ file, reason: 'File type not supported' })
      return
    }

    // Custom validation
    if (props.validateFile) {
      const validation = props.validateFile(file)
      if (!validation.valid) {
        newInvalidFiles.push({ file, reason: validation.reason || 'File validation failed' })
        return
      }
    }

    newValidFiles.push(file)
  })

  // Add valid files
  selectedFiles.value.push(...newValidFiles)
  
  // Show invalid files temporarily
  invalidFiles.value = newInvalidFiles
  if (newInvalidFiles.length > 0) {
    emit('validationError', newInvalidFiles)
    setTimeout(() => {
      invalidFiles.value = []
    }, 5000)
  }

  // Emit files selected
  if (newValidFiles.length > 0) {
    emit('filesSelected', [...selectedFiles.value])
  }
}

const removeFile = (index: number) => {
  const removedFile = selectedFiles.value[index]
  selectedFiles.value.splice(index, 1)
  emit('fileRemoved', removedFile, index)
  emit('filesSelected', [...selectedFiles.value])
}

const clearFiles = () => {
  selectedFiles.value = []
  invalidFiles.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  emit('filesSelected', [])
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('text')) return '📄'
  if (mimeType.includes('json')) return '🔧'
  if (mimeType.includes('xml')) return '📋'
  if (mimeType.includes('csv') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️'
  return '📄'
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Expose methods for parent components
defineExpose({
  clearFiles,
  selectedFiles: readonly(selectedFiles)
})
</script> 