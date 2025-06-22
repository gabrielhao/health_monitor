import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { azureCosmos } from '../../src/services/azureCosmos'
import { azureBlob } from '../../src/services/azureBlob'
import { azureEmbedding } from '../../src/services/azureEmbedding'
import { verifyJWT } from '../../src/services/azureAuth'
import { XMLParser } from 'fast-xml-parser'
import { streamingParser } from '../../src/services/streamingParser'
import type { 
  HealthDocument, 
  HealthEmbedding, 
  ImportSession 
} from '../../src/services/azureConfig'

interface ProcessFileRequest {
  filePath: string
  source: string
  metadata: Record<string, any>
}

interface AppleHealthRecord {
  type: string
  value: string | number
  unit?: string
  startDate: string
  endDate: string
  sourceName?: string
  sourceVersion?: string
  device?: string
  [key: string]: any
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  // Set CORS headers
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json'
    }
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    context.res.status = 200
    return
  }

  try {
    // Initialize services
    await azureCosmos.initialize()
    await azureBlob.initialize()

    // Verify JWT token
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      context.res.status = 401
      context.res.body = { error: 'No authorization header' }
      return
    }

    const token = authHeader.replace('Bearer ', '')
    const user = await verifyJWT(token)

    if (!user) {
      context.res.status = 401
      context.res.body = { error: 'Authentication failed' }
      return
    }

    // Parse request body
    const { filePath, source, metadata }: ProcessFileRequest = req.body

    context.log(`Processing file: ${filePath} for user: ${user.id}`)
    context.log(`File size from metadata: ${metadata.filesize} bytes (${(metadata.filesize / (1024 * 1024 * 1024)).toFixed(2)} GB)`)

    // Validate file size (5GB limit)
    const maxFileSize = 5 * 1024 * 1024 * 1024 // 5GB
    if (metadata.filesize > maxFileSize) {
      context.res.status = 400
      context.res.body = { error: `File size ${metadata.filesize} bytes exceeds 5GB limit` }
      return
    }

    // Create import session
    const importSession = await azureCosmos.createImportSession({
      user_id: user.id,
      source_app: source,
      status: 'processing',
      total_records: 0,
      processed_records: 0,
      failed_records: 0,
      error_log: [],
      metadata: {
        file_name: filePath.split('/').pop() || '',
        file_type: source,
        file_url: filePath,
        processing_start: new Date().toISOString()
      },
      _partitionKey: user.id
    })

    try {
      // Download file from blob storage
      context.log('Downloading file from blob storage...')
      const fileContent = await azureBlob.downloadFile(filePath)
      context.log(`File downloaded, size: ${fileContent.length} characters`)

      // Parse file based on type
      let parsedData: any[] = []
      const fileName = filePath.split('/').pop() || ''
      const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase()

      context.log(`Parsing ${fileExtension} file...`)

      switch (fileExtension) {
        case '.xml':
          parsedData = parseXMLFile(fileContent, source)
          break
        case '.json':
          parsedData = parseJSONFile(fileContent)
          break
        case '.csv':
          parsedData = parseCSVFile(fileContent)
          break
        default:
          throw new Error(`Unsupported file format: ${fileExtension}`)
      }

      context.log(`Parsed ${parsedData.length} records`)

      // Update session with total records
      await azureCosmos.updateImportSession(importSession.id, user.id, {
        total_records: parsedData.length
      })

      // Process and import data
      let processedCount = 0
      let failedCount = 0
      const errors: string[] = []

      // Process data based on source
      const processedHealthData = processHealthData(parsedData, source)

      context.log(`Processing ${processedHealthData.length} health records...`)

      // Import in batches to avoid memory issues
      const batchSize = 100
      for (let i = 0; i < processedHealthData.length; i += batchSize) {
        const batch = processedHealthData.slice(i, i + batchSize)
        
        for (const item of batch) {
          try {
            // Create health document
            const document = await azureCosmos.createHealthDocument({
              user_id: user.id,
              source_app: source,
              document_type: item.document_type,
              title: item.title,
              content: JSON.stringify(item),
              metadata: {
                import_session_id: importSession.id,
                original_index: i,
                source_file: fileName
              },
              file_path: filePath,
              import_session_id: importSession.id,
              processed_at: new Date(),
              _partitionKey: user.id
            })

            // Generate embedding for searchability
            const contentForEmbedding = `${item.title || ''} ${JSON.stringify(item)}`.trim()
            
            if (contentForEmbedding.length > 0) {
              const embedding = await azureEmbedding.generateEmbedding(contentForEmbedding)
              
              await azureCosmos.createEmbedding({
                user_id: user.id,
                document_id: document.id,
                content_chunk: contentForEmbedding,
                embedding,
                chunk_index: 0,
                metadata: {
                  record_type: item.document_type,
                  import_session_id: importSession.id
                },
                _partitionKey: user.id
              })
            }

            processedCount++
          } catch (error) {
            failedCount++
            const errorMessage = `Failed to import item: ${item.title} - ${error instanceof Error ? error.message : 'Unknown error'}`
            errors.push(errorMessage)
            context.log.error(errorMessage)
          }
        }

        // Update progress
        await azureCosmos.updateImportSession(importSession.id, user.id, {
          processed_records: processedCount,
          failed_records: failedCount
        })
      }

      // Update final session status
      await azureCosmos.updateImportSession(importSession.id, user.id, {
        status: failedCount === 0 ? 'completed' : 'failed',
        processed_records: processedCount,
        failed_records: failedCount,
        error_log: errors,
        completed_at: new Date(),
        metadata: {
          ...importSession.metadata,
          processing_end: new Date().toISOString(),
          total_processed: processedCount,
          total_failed: failedCount
        }
      })

      context.res.status = 200
      context.res.body = {
        success: true,
        session_id: importSession.id,
        processed_count: processedCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined
      }

    } catch (error) {
      context.log.error('Processing failed:', error)
      
      // Update session with error
      await azureCosmos.updateImportSession(importSession.id, user.id, {
        status: 'failed',
        error_log: [error instanceof Error ? error.message : 'Processing failed'],
        completed_at: new Date()
      })

      context.res.status = 500
      context.res.body = {
        error: error instanceof Error ? error.message : 'Processing failed',
        session_id: importSession.id
      }
    }

  } catch (error) {
    context.log.error('Request failed:', error)
    context.res.status = 500
    context.res.body = {
      error: error instanceof Error ? error.message : 'Internal server error'
    }
  }
}

function parseXMLFile(content: string, source: string): any[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
  })

  const parsedXML = parser.parse(content)

  if (source === 'apple_health') {
    return parseAppleHealthXML(parsedXML)
  }

  return extractXMLData(parsedXML)
}

function parseAppleHealthXML(parsedXML: any): AppleHealthRecord[] {
  const records: AppleHealthRecord[] = []
  
  if (parsedXML.HealthData && parsedXML.HealthData.Record) {
    const xmlRecords = Array.isArray(parsedXML.HealthData.Record) 
      ? parsedXML.HealthData.Record 
      : [parsedXML.HealthData.Record]

    for (const record of xmlRecords) {
      const attributes = record['@_'] || {}
      
      records.push({
        type: attributes.type || '',
        value: attributes.value || '',
        unit: attributes.unit,
        startDate: attributes.startDate || '',
        endDate: attributes.endDate || '',
        sourceName: attributes.sourceName || '',
        sourceVersion: attributes.sourceVersion,
        device: attributes.device
      })
    }
  }

  return records
}

function parseJSONFile(content: string): any[] {
  try {
    const data = JSON.parse(content)
    return Array.isArray(data) ? data : [data]
  } catch (error) {
    throw new Error('Invalid JSON format')
  }
}

function parseCSVFile(content: string): any[] {
  const lines = content.split('\n').filter(line => line.trim())
  
  if (lines.length < 2) {
    throw new Error('CSV file must have headers and at least one data row')
  }

  const headers = lines[0].split(',').map(h => h.trim())
  const records: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    
    if (values.length !== headers.length) {
      continue // Skip malformed rows
    }

    const record: any = {}
    headers.forEach((header, index) => {
      record[header] = values[index]
    })
    
    records.push(record)
  }

  return records
}

function extractXMLData(xmlDoc: any): any[] {
  // Generic XML data extraction
  const extractElement = (element: any): any => {
    if (typeof element === 'string' || typeof element === 'number') {
      return element
    }

    if (Array.isArray(element)) {
      return element.map(extractElement)
    }

    if (typeof element === 'object' && element !== null) {
      const result: any = {}
      
      for (const [key, value] of Object.entries(element)) {
        if (key.startsWith('@_')) {
          // Attribute
          result[key.substring(2)] = value
        } else if (key === '#text') {
          // Text content
          return value
        } else {
          // Child element
          result[key] = extractElement(value)
        }
      }
      
      return result
    }

    return element
  }

  const extracted = extractElement(xmlDoc)
  return Array.isArray(extracted) ? extracted : [extracted]
}

function processHealthData(data: any[], source: string): any[] {
  if (source === 'apple_health') {
    return processAppleHealthData(data as AppleHealthRecord[])
  }

  // Generic processing for other sources
  return data.map((item, index) => ({
    title: `${source} record ${index + 1}`,
    content: typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item),
    document_type: 'other',
    metadata: item
  }))
}

function processAppleHealthData(appleData: AppleHealthRecord[]): any[] {
  return appleData.map(item => ({
    title: `${item.type} - ${new Date(item.startDate).toLocaleDateString()}`,
    content: formatAppleHealthContent(item),
    document_type: mapAppleHealthType(item.type),
    metadata: {
      original_type: item.type,
      value: item.value,
      unit: item.unit,
      start_date: item.startDate,
      end_date: item.endDate,
      source_name: item.sourceName,
      source_version: item.sourceVersion,
      device: item.device
    }
  }))
}

function formatAppleHealthContent(item: AppleHealthRecord): string {
  const date = new Date(item.startDate).toLocaleDateString()
  const time = new Date(item.startDate).toLocaleTimeString()
  
  let content = `Health data recorded on ${date} at ${time}.\n`
  content += `Type: ${item.type}\n`
  content += `Value: ${item.value}`
  
  if (item.unit) {
    content += ` ${item.unit}`
  }
  
  content += `\nSource: ${item.sourceName}`
  
  if (item.device) {
    content += ` (${item.device})`
  }

  if (item.endDate !== item.startDate) {
    const endDate = new Date(item.endDate).toLocaleDateString()
    const endTime = new Date(item.endDate).toLocaleTimeString()
    content += `\nEnd: ${endDate} at ${endTime}`
  }

  return content
}

function mapAppleHealthType(appleType: string): string {
  const typeMapping: Record<string, string> = {
    'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
    'HKQuantityTypeIdentifierStepCount': 'activity',
    'HKQuantityTypeIdentifierDistanceWalkingRunning': 'activity',
    'HKQuantityTypeIdentifierActiveEnergyBurned': 'activity',
    'HKCategoryTypeIdentifierSleepAnalysis': 'sleep',
    'HKQuantityTypeIdentifierBodyMass': 'vitals',
    'HKQuantityTypeIdentifierHeight': 'vitals',
    'HKQuantityTypeIdentifierBloodPressureSystolic': 'vitals',
    'HKQuantityTypeIdentifierBloodPressureDiastolic': 'vitals'
  }

  return typeMapping[appleType] || 'other'
}

export default httpTrigger 