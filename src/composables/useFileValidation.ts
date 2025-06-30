export interface FileValidationOptions {
  allowedTypes: string[]
  maxFileSize: number
  maxFiles?: number
  customValidator?: (file: File) => { valid: boolean; reason?: string }
}

export interface ValidationResult {
  valid: File[]
  invalid: { file: File; reason: string }[]
}

export const useFileValidation = () => {
  const validateFiles = (
    fileList: FileList | File[],
    options: FileValidationOptions,
    existingFiles: File[] = []
  ): ValidationResult => {
    const files = Array.from(fileList)
    const valid: File[] = []
    const invalid: { file: File; reason: string }[] = []

    files.forEach((file) => {
      // Check for duplicates
      if (existingFiles.some(f => f.name === file.name && f.size === file.size)) {
        invalid.push({ file, reason: 'File already selected' })
        return
      }

      // Check file count limit
      if (options.maxFiles && existingFiles.length + valid.length >= options.maxFiles) {
        invalid.push({ file, reason: `Maximum ${options.maxFiles} files allowed` })
        return
      }

      // Check file size
      if (file.size > options.maxFileSize) {
        invalid.push({ 
          file, 
          reason: `File size exceeds ${formatFileSize(options.maxFileSize)}` 
        })
        return
      }

      // Check file type
      if (!isValidFileType(file, options.allowedTypes)) {
        invalid.push({ 
          file, 
          reason: `File type not supported. Allowed: ${options.allowedTypes.join(', ')}` 
        })
        return
      }

      // Custom validation
      if (options.customValidator) {
        const customResult = options.customValidator(file)
        if (!customResult.valid) {
          invalid.push({ 
            file, 
            reason: customResult.reason || 'File validation failed' 
          })
          return
        }
      }

      valid.push(file)
    })

    return { valid, invalid }
  }

  const isValidFileType = (file: File, allowedTypes: string[]): boolean => {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    return allowedTypes.some(type => 
      type.toLowerCase() === fileExtension || 
      file.type.includes(type.replace('.', ''))
    )
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (file: File): string => {
    const type = file.type.toLowerCase()
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (type.includes('pdf') || extension === 'pdf') return '📄'
    if (type.includes('word') || type.includes('document') || extension === 'docx' || extension === 'doc') return '📝'
    if (type.includes('text') || extension === 'txt') return '📄'
    if (type.includes('json') || extension === 'json') return '🔧'
    if (type.includes('xml') || extension === 'xml') return '📋'
    if (type.includes('csv') || type.includes('spreadsheet') || extension === 'csv') return '📊'
    if (type.includes('zip') || type.includes('compressed') || extension === 'zip') return '🗜️'
    
    return '📄'
  }

  // Predefined validation configurations
  const healthDataValidation: FileValidationOptions = {
    allowedTypes: ['.xml', '.json', '.csv', '.zip'],
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
    maxFiles: 1 // Health data typically single file uploads
  }

  const ragDocumentValidation: FileValidationOptions = {
    allowedTypes: ['.pdf', '.docx', '.txt', '.csv', '.json', '.xml'],
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    maxFiles: 50
  }

  return {
    validateFiles,
    isValidFileType,
    formatFileSize,
    getFileIcon,
    healthDataValidation,
    ragDocumentValidation
  }
} 