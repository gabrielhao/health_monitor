import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import DataImportPage from '@/pages/DataImportPage.vue'
import { useVectorStore } from '@/stores/vector'
import { useAuthStore } from '@/stores/auth'
import { createMockFile } from '../mocks/supabase'

// Mock the composables and stores
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

vi.mock('@/services/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}))

describe('DataImportPage', () => {
  let wrapper: any
  let router: any
  let pinia: any

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/import', component: DataImportPage }
      ]
    })

    // Mock stores
    const authStore = useAuthStore()
    authStore.user = { id: 'test-user-id' }

    const vectorStore = useVectorStore()
    vectorStore.importSessions = []
    vectorStore.dataSources = []

    wrapper = mount(DataImportPage, {
      global: {
        plugins: [router, pinia],
        stubs: {
          FileUploadProgress: true
        }
      }
    })

    await router.isReady()
  })

  describe('Component Rendering', () => {
    it('should render the page title and description', () => {
      expect(wrapper.find('h1').text()).toBe('Health Data Import')
      expect(wrapper.text()).toContain('Import and manage health data from various sources')
    })

    it('should render supported data sources', () => {
      const sources = ['Apple Health', 'Google Fit', 'Fitbit', 'Garmin']
      sources.forEach(source => {
        expect(wrapper.text()).toContain(source)
      })
    })

    it('should render file upload section', () => {
      expect(wrapper.text()).toContain('Upload Health Data')
      expect(wrapper.text()).toContain('Data Source')
      expect(wrapper.text()).toContain('Upload File')
    })

    it('should render import history section', () => {
      expect(wrapper.text()).toContain('Import History')
    })
  })

  describe('File Upload', () => {
    it('should show file input and drag-drop area', () => {
      const uploadArea = wrapper.find('[data-testid="upload-area"]')
      expect(uploadArea.exists()).toBe(true)
      expect(wrapper.text()).toContain('Click to upload')
      expect(wrapper.text()).toContain('or drag and drop')
    })

    it('should validate file selection', async () => {
      const fileInput = wrapper.find('input[type="file"]')
      const mockFile = createMockFile({
        name: 'test.xml',
        size: 1024 * 1024 // 1MB
      })

      // Simulate file selection
      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      await fileInput.trigger('change')

      expect(wrapper.text()).toContain('test.xml')
    })

    it('should reject oversized files', async () => {
      const fileInput = wrapper.find('input[type="file"]')
      const oversizedFile = createMockFile({
        name: 'huge-file.xml',
        size: 6 * 1024 * 1024 * 1024 // 6GB
      })

      // Mock the validateFile method to simulate oversized file rejection
      const component = wrapper.vm
      component.uploadForm.file = oversizedFile
      component.validateFile(oversizedFile)

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('File size must be less than 5GB')
    })

    it('should show large file options for files > 100MB', async () => {
      const largeFile = createMockFile({
        name: 'large-file.xml',
        size: 200 * 1024 * 1024 // 200MB
      })

      const component = wrapper.vm
      component.uploadForm.file = largeFile

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Large File Upload Options')
      expect(wrapper.text()).toContain('Standard Chunks (5MB)')
      expect(wrapper.text()).toContain('Large Chunks (10MB)')
      expect(wrapper.text()).toContain('Small Chunks (2MB)')
    })

    it('should disable upload button when required fields missing', () => {
      const uploadButton = wrapper.find('button[type="submit"]')
      expect(uploadButton.attributes('disabled')).toBeDefined()
    })

    it('should enable upload button when file and source selected', async () => {
      const component = wrapper.vm
      component.uploadForm.source = 'apple_health'
      component.uploadForm.file = createMockFile()

      await wrapper.vm.$nextTick()

      const uploadButton = wrapper.find('.btn-primary')
      expect(uploadButton.attributes('disabled')).toBeUndefined()
    })
  })

  describe('File Validation', () => {
    it('should accept valid file types', () => {
      const validFiles = [
        createMockFile({ name: 'data.xml', type: 'text/xml' }),
        createMockFile({ name: 'data.json', type: 'application/json' }),
        createMockFile({ name: 'data.csv', type: 'text/csv' }),
        createMockFile({ name: 'data.zip', type: 'application/zip' })
      ]

      const component = wrapper.vm

      validFiles.forEach(file => {
        const isValid = component.validateFile(file)
        expect(isValid).toBe(true)
      })
    })

    it('should reject invalid file types', () => {
      const invalidFile = createMockFile({ 
        name: 'document.pdf', 
        type: 'application/pdf' 
      })

      const component = wrapper.vm
      const isValid = component.validateFile(invalidFile)

      expect(isValid).toBe(false)
      expect(component.uploadError).toContain('File type not supported')
    })
  })

  describe('Sample Data Import', () => {
    it('should show sample data modal when button clicked', async () => {
      const sampleDataButton = wrapper.find('button:contains("Import Sample Data")')
      await sampleDataButton.trigger('click')

      expect(wrapper.text()).toContain('Import Sample Data')
      expect(wrapper.text()).toContain('This will import sample health data')
    })

    it('should generate sample Apple Health data', () => {
      const component = wrapper.vm
      const sampleData = component.generateSampleAppleHealthData()

      expect(Array.isArray(sampleData)).toBe(true)
      expect(sampleData.length).toBeGreaterThan(0)
      
      // Check data structure
      const firstRecord = sampleData[0]
      expect(firstRecord).toHaveProperty('type')
      expect(firstRecord).toHaveProperty('value')
      expect(firstRecord).toHaveProperty('startDate')
      expect(firstRecord).toHaveProperty('endDate')
    })
  })

  describe('Import History', () => {
    it('should show empty state when no imports', () => {
      expect(wrapper.text()).toContain('No import history yet')
    })

    it('should display import sessions when available', async () => {
      const vectorStore = useVectorStore()
      vectorStore.importSessions = [
        {
          id: '1',
          source_app: 'apple_health',
          status: 'completed',
          total_records: 100,
          processed_records: 95,
          failed_records: 5,
          started_at: '2024-01-01T10:00:00Z',
          error_log: []
        }
      ]

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Apple Health')
      expect(wrapper.text()).toContain('95 of 100 records processed')
      expect(wrapper.text()).toContain('completed')
    })

    it('should format source names correctly', () => {
      const component = wrapper.vm
      
      expect(component.formatSourceName('apple_health')).toBe('Apple Health')
      expect(component.formatSourceName('google_fit')).toBe('Google Fit')
      expect(component.formatSourceName('fitbit')).toBe('Fitbit')
      expect(component.formatSourceName('unknown')).toBe('unknown')
    })

    it('should show error details modal when errors exist', async () => {
      const vectorStore = useVectorStore()
      vectorStore.importSessions = [
        {
          id: '1',
          source_app: 'apple_health',
          status: 'completed',
          total_records: 100,
          processed_records: 95,
          failed_records: 5,
          started_at: '2024-01-01T10:00:00Z',
          error_log: [
            { item: 'Record 1', error: 'Invalid format' },
            { item: 'Record 2', error: 'Missing required field' }
          ]
        }
      ]

      await wrapper.vm.$nextTick()

      const viewErrorsButton = wrapper.find('button:contains("View Errors")')
      await viewErrorsButton.trigger('click')

      expect(wrapper.text()).toContain('Import Errors')
      expect(wrapper.text()).toContain('Invalid format')
      expect(wrapper.text()).toContain('Missing required field')
    })
  })

  describe('Error Handling', () => {
    it('should display upload errors', async () => {
      const component = wrapper.vm
      component.uploadError = 'Network connection failed'

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Upload Failed')
      expect(wrapper.text()).toContain('Network connection failed')
    })

    it('should show technical error details when available', async () => {
      const component = wrapper.vm
      component.uploadError = 'Upload failed'
      component.uploadErrorDetails = 'Error: Connection timeout at line 123'

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Show technical details')
    })

    it('should clear errors when new file selected', async () => {
      const component = wrapper.vm
      component.uploadError = 'Previous error'

      const fileInput = wrapper.find('input[type="file"]')
      await fileInput.trigger('change')

      expect(component.uploadError).toBe('')
    })
  })

  describe('File Size Formatting', () => {
    it('should format file sizes correctly', () => {
      const component = wrapper.vm

      expect(component.formatFileSize(0)).toBe('0 Bytes')
      expect(component.formatFileSize(1024)).toBe('1 KB')
      expect(component.formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(component.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
      expect(component.formatFileSize(1536)).toBe('1.5 KB')
    })
  })

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      const component = wrapper.vm
      const testDate = '2024-01-15T14:30:00Z'
      
      const formatted = component.formatDate(testDate)
      expect(formatted).toMatch(/Jan 15, 2024 \d{2}:\d{2}/)
    })
  })

  describe('Status Colors and Icons', () => {
    it('should return correct status colors', () => {
      const component = wrapper.vm

      const pendingColor = component.getStatusColor('pending')
      expect(pendingColor.badge).toContain('warning')

      const completedColor = component.getStatusColor('completed')
      expect(completedColor.badge).toContain('success')

      const failedColor = component.getStatusColor('failed')
      expect(failedColor.badge).toContain('error')
    })

    it('should return correct status icons', () => {
      const component = wrapper.vm

      expect(component.getStatusIcon('pending')).toBeDefined()
      expect(component.getStatusIcon('processing')).toBeDefined()
      expect(component.getStatusIcon('completed')).toBeDefined()
      expect(component.getStatusIcon('failed')).toBeDefined()
    })
  })
})