import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import DataImportPage from '@/pages/DataImportPage.vue'
import { useAuthStore } from '@/stores/auth'
import { useVectorStore } from '@/stores/vector'
import { createMockFile, mockSupabaseClient } from '../mocks/supabase'

// Mock all external dependencies
vi.mock('@/services/supabase', () => ({
  supabase: mockSupabaseClient
}))

vi.mock('@/services/chunkUploadService', () => ({
  chunkUploadService: {
    uploadFile: vi.fn()
  }
}))

vi.mock('@/composables/useFileUpload', () => ({
  useFileUpload: () => ({
    uploading: { value: false },
    progress: { 
      value: {
        percentage: 0,
        uploadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        currentChunk: 0,
        totalChunks: 0
      }
    },
    error: { value: '' },
    formattedSpeed: { value: '0 B/s' },
    formattedETA: { value: '--' },
    uploadFile: vi.fn(),
    cancelUpload: vi.fn(),
    resetProgress: vi.fn()
  })
}))

describe('File Upload Integration Flow', () => {
  let wrapper: any
  let router: any
  let pinia: any
  let authStore: any
  let vectorStore: any

  beforeEach(async () => {
    // Setup test environment
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/import', component: DataImportPage }
      ]
    })

    // Initialize stores
    authStore = useAuthStore()
    vectorStore = useVectorStore()

    // Mock authenticated user
    authStore.user = { id: 'test-user-id', email: 'test@example.com' }
    authStore.isAuthenticated = true

    // Clear all mocks
    vi.clearAllMocks()

    // Mount component
    wrapper = mount(DataImportPage, {
      global: {
        plugins: [router, pinia],
        stubs: {
          FileUploadProgress: {
            template: '<div data-testid="upload-progress">Upload Progress</div>',
            props: ['fileName', 'progress', 'uploading', 'error', 'formattedSpeed', 'formattedETA']
          }
        }
      }
    })

    await router.isReady()
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.restoreAllMocks()
  })

  describe('Complete File Upload Flow', () => {
    it('should handle successful small file upload end-to-end', async () => {
      // Arrange
      const mockFile = createMockFile({
        name: 'small-health-data.json',
        size: 1024 * 1024, // 1MB
        type: 'application/json'
      })

      const { useFileUpload } = await import('@/composables/useFileUpload')
      const fileUploadComposable = useFileUpload()
      
      // Mock successful upload
      fileUploadComposable.uploadFile.mockResolvedValue('uploaded-file-path')
      
      // Mock successful processing
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          importSession: {
            id: 'session-123',
            status: 'completed',
            processed_records: 100,
            failed_records: 0
          }
        },
        error: null
      })

      // Act - Select data source
      const sourceSelect = wrapper.find('select')
      await sourceSelect.setValue('apple_health')

      // Act - Upload file
      const fileInput = wrapper.find('input[type="file"]')
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })
      await fileInput.trigger('change')

      // Act - Submit upload
      const uploadButton = wrapper.find('.btn-primary')
      await uploadButton.trigger('click')

      // Assert - File upload was called
      expect(fileUploadComposable.uploadFile).toHaveBeenCalledWith(
        mockFile,
        expect.objectContaining({
          chunkSize: 5 * 1024 * 1024
        })
      )

      // Assert - Processing was triggered
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'process-health-file',
        expect.objectContaining({
          body: expect.objectContaining({
            filePath: 'uploaded-file-path',
            source: 'apple_health'
          })
        })
      )

      // Assert - Form was reset
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.uploadForm.source).toBe('')
      expect(wrapper.vm.uploadForm.file).toBe(null)
    })

    it('should handle large file upload with chunking', async () => {
      // Arrange
      const largeFile = createMockFile({
        name: 'large-health-export.xml',
        size: 500 * 1024 * 1024, // 500MB
        type: 'text/xml'
      })

      const { useFileUpload } = await import('@/composables/useFileUpload')
      const fileUploadComposable = useFileUpload()
      
      // Mock chunked upload with progress
      fileUploadComposable.uploadFile.mockImplementation((file, options) => {
        // Simulate progress updates
        options.onProgress?.(25)
        options.onProgress?.(50)
        options.onProgress?.(75)
        options.onProgress?.(100)
        
        // Simulate chunk completion
        options.onChunkComplete?.(0, 4)
        options.onChunkComplete?.(1, 4)
        options.onChunkComplete?.(2, 4)
        options.onChunkComplete?.(3, 4)
        
        return Promise.resolve('large-file-path')
      })

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { success: true, importSession: { id: 'session-456' } },
        error: null
      })

      // Act - Select file and source
      await wrapper.find('select').setValue('apple_health')
      
      const fileInput = wrapper.find('input[type="file"]')
      Object.defineProperty(fileInput.element, 'files', {
        value: [largeFile],
        writable: false
      })
      await fileInput.trigger('change')

      // Assert - Large file options are shown
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('Large File Upload Options')
      expect(wrapper.text()).toContain('Standard Chunks (5MB)')

      // Act - Select chunk size and upload
      const chunkSizeRadio = wrapper.find('input[value="10485760"]') // 10MB
      await chunkSizeRadio.setChecked()
      
      await wrapper.find('.btn-primary').trigger('click')

      // Assert - Upload called with correct chunk size
      expect(fileUploadComposable.uploadFile).toHaveBeenCalledWith(
        largeFile,
        expect.objectContaining({
          chunkSize: 10 * 1024 * 1024
        })
      )
    })

    it('should handle upload failure with retry mechanism', async () => {
      // Arrange
      const mockFile = createMockFile({
        name: 'test-data.csv',
        size: 2 * 1024 * 1024 // 2MB
      })

      const { useFileUpload } = await import('@/composables/useFileUpload')
      const fileUploadComposable = useFileUpload()
      
      // Mock upload failure
      const uploadError = new Error('Network connection failed')
      fileUploadComposable.uploadFile.mockRejectedValue(uploadError)

      // Act - Attempt upload
      await wrapper.find('select').setValue('manual')
      
      const fileInput = wrapper.find('input[type="file"]')
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })
      await fileInput.trigger('change')

      await wrapper.find('.btn-primary').trigger('click')

      // Assert - Error is displayed
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.uploadError).toBe('Network connection failed')
      expect(wrapper.text()).toContain('Upload Failed')
    })

    it('should validate file size limits', async () => {
      // Arrange
      const oversizedFile = createMockFile({
        name: 'huge-file.xml',
        size: 6 * 1024 * 1024 * 1024 // 6GB (exceeds 5GB limit)
      })

      // Act - Try to select oversized file
      const fileInput = wrapper.find('input[type="file"]')
      Object.defineProperty(fileInput.element, 'files', {
        value: [oversizedFile],
        writable: false
      })
      await fileInput.trigger('change')

      // Assert - File is rejected
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.uploadError).toContain('File size must be less than 5GB')
      expect(wrapper.vm.uploadForm.file).toBe(null)
    })

    it('should validate file types', async () => {
      // Arrange
      const invalidFile = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf'
      })

      // Act - Try to select invalid file type
      const fileInput = wrapper.find('input[type="file"]')
      Object.defineProperty(fileInput.element, 'files', {
        value: [invalidFile],
        writable: false
      })
      await fileInput.trigger('change')

      // Assert - File type is rejected
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.uploadError).toContain('File type not supported')
      expect(wrapper.vm.uploadForm.file).toBe(null)
    })
  })

  describe('Sample Data Import Flow', () => {
    it('should import sample data successfully', async () => {
      // Arrange
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          importSession: {
            id: 'sample-session',
            status: 'completed',
            processed_records: 50,
            failed_records: 0
          }
        },
        error: null
      })

      // Act - Open sample data modal
      const sampleDataButton = wrapper.find('button:contains("Import Sample Data")')
      await sampleDataButton.trigger('click')

      expect(wrapper.vm.showSampleData).toBe(true)

      // Act - Confirm sample data import
      const confirmButton = wrapper.find('.btn-primary:contains("Import Sample Data")')
      await confirmButton.trigger('click')

      // Assert - Sample data was generated and imported
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.showSampleData).toBe(false)
      expect(wrapper.vm.currentImport).toBeDefined()
    })
  })

  describe('Import History Management', () => {
    it('should display import history correctly', async () => {
      // Arrange
      const mockImportSessions = [
        {
          id: 'session-1',
          source_app: 'apple_health',
          status: 'completed',
          total_records: 100,
          processed_records: 95,
          failed_records: 5,
          started_at: '2024-01-01T10:00:00Z',
          error_log: [
            { item: 'Record 1', error: 'Invalid format' }
          ]
        },
        {
          id: 'session-2',
          source_app: 'google_fit',
          status: 'processing',
          total_records: 200,
          processed_records: 150,
          failed_records: 0,
          started_at: '2024-01-02T11:00:00Z',
          error_log: []
        }
      ]

      vectorStore.importSessions = mockImportSessions

      // Act - Component should display import history
      await wrapper.vm.$nextTick()

      // Assert - Import sessions are displayed
      expect(wrapper.text()).toContain('Apple Health')
      expect(wrapper.text()).toContain('Google Fit')
      expect(wrapper.text()).toContain('95 of 100 records processed')
      expect(wrapper.text()).toContain('150 of 200 records processed')
      expect(wrapper.text()).toContain('completed')
      expect(wrapper.text()).toContain('processing')
    })

    it('should show error details modal', async () => {
      // Arrange
      const sessionWithErrors = {
        id: 'error-session',
        source_app: 'fitbit',
        status: 'completed',
        total_records: 50,
        processed_records: 45,
        failed_records: 5,
        started_at: '2024-01-03T12:00:00Z',
        error_log: [
          { item: 'Record 1', error: 'Missing required field' },
          { item: 'Record 2', error: 'Invalid date format' }
        ]
      }

      vectorStore.importSessions = [sessionWithErrors]
      await wrapper.vm.$nextTick()

      // Act - Click view errors button
      const viewErrorsButton = wrapper.find('button:contains("View Errors")')
      await viewErrorsButton.trigger('click')

      // Assert - Error modal is shown
      expect(wrapper.vm.selectedSession).toBe(sessionWithErrors)
      expect(wrapper.text()).toContain('Import Errors')
      expect(wrapper.text()).toContain('Missing required field')
      expect(wrapper.text()).toContain('Invalid date format')
    })

    it('should show import details modal', async () => {
      // Arrange
      const detailedSession = {
        id: 'detailed-session',
        source_app: 'garmin',
        status: 'completed',
        total_records: 75,
        processed_records: 75,
        failed_records: 0,
        started_at: '2024-01-04T13:00:00Z',
        completed_at: '2024-01-04T13:05:00Z',
        metadata: {
          filename: 'garmin-export.json',
          filesize: 1024000,
          processing_mode: 'standard'
        },
        error_log: []
      }

      vectorStore.importSessions = [detailedSession]
      await wrapper.vm.$nextTick()

      // Act - Click details button
      const detailsButton = wrapper.find('button:contains("Details")')
      await detailsButton.trigger('click')

      // Assert - Details modal is shown
      expect(wrapper.vm.detailsSession).toBe(detailedSession)
      expect(wrapper.text()).toContain('Import Details')
      expect(wrapper.text()).toContain('Garmin')
      expect(wrapper.text()).toContain('75')
      expect(wrapper.text()).toContain('100%') // Success rate
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle authentication errors', async () => {
      // Arrange
      authStore.user = null
      authStore.isAuthenticated = false

      const { useFileUpload } = await import('@/composables/useFileUpload')
      const fileUploadComposable = useFileUpload()
      
      fileUploadComposable.uploadFile.mockRejectedValue(
        new Error('User not authenticated')
      )

      // Act - Try to upload without authentication
      const mockFile = createMockFile()
      await wrapper.find('select').setValue('apple_health')
      
      const fileInput = wrapper.find('input[type="file"]')
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })
      await fileInput.trigger('change')

      await wrapper.find('.btn-primary').trigger('click')

      // Assert - Authentication error is handled
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.uploadError).toContain('User not authenticated')
    })

    it('should handle server processing errors', async () => {
      // Arrange
      const mockFile = createMockFile()

      const { useFileUpload } = await import('@/composables/useFileUpload')
      const fileUploadComposable = useFileUpload()
      
      fileUploadComposable.uploadFile.mockResolvedValue('uploaded-file-path')
      
      // Mock server processing failure
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Server processing failed' }
      })

      // Act - Upload file
      await wrapper.find('select').setValue('apple_health')
      
      const fileInput = wrapper.find('input[type="file"]')
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })
      await fileInput.trigger('change')

      await wrapper.find('.btn-primary').trigger('click')

      // Assert - Server error is handled
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.uploadError).toContain('Processing failed: Server processing failed')
    })

    it('should handle drag and drop file selection', async () => {
      // Arrange
      const mockFile = createMockFile({
        name: 'dropped-file.xml',
        size: 2 * 1024 * 1024
      })

      const dropEvent = new Event('drop')
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [mockFile]
        }
      })

      // Act - Simulate drag and drop
      const dropZone = wrapper.find('[data-testid="upload-area"]')
      await dropZone.trigger('drop', { dataTransfer: { files: [mockFile] } })

      // Assert - File is selected via drag and drop
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.uploadForm.file).toBeDefined()
      expect(wrapper.text()).toContain('dropped-file.xml')
    })

    it('should clear file when clear button is clicked', async () => {
      // Arrange
      const mockFile = createMockFile()
      wrapper.vm.uploadForm.file = mockFile

      await wrapper.vm.$nextTick()

      // Act - Click clear file button
      const clearButton = wrapper.find('button:contains("×")')
      await clearButton.trigger('click')

      // Assert - File is cleared
      expect(wrapper.vm.uploadForm.file).toBe(null)
      expect(wrapper.vm.uploadError).toBe('')
    })
  })

  describe('Progress Tracking', () => {
    it('should track upload progress correctly', async () => {
      // Arrange
      const mockFile = createMockFile({
        size: 10 * 1024 * 1024 // 10MB
      })

      const { useFileUpload } = await import('@/composables/useFileUpload')
      const fileUploadComposable = useFileUpload()
      
      // Mock progress updates
      fileUploadComposable.progress.value = {
        percentage: 75,
        uploadedBytes: 7.5 * 1024 * 1024,
        totalBytes: 10 * 1024 * 1024,
        speed: 1024 * 1024, // 1MB/s
        eta: 2.5, // 2.5 seconds
        currentChunk: 3,
        totalChunks: 4
      }
      fileUploadComposable.uploading.value = true
      fileUploadComposable.formattedSpeed.value = '1.0 MB/s'
      fileUploadComposable.formattedETA.value = '3s'

      // Act - Start upload
      await wrapper.find('select').setValue('apple_health')
      
      const fileInput = wrapper.find('input[type="file"]')
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })
      await fileInput.trigger('change')

      // Assert - Progress is displayed
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('75%')
      expect(wrapper.text()).toContain('1.0 MB/s')
      expect(wrapper.text()).toContain('3s')
    })
  })
})