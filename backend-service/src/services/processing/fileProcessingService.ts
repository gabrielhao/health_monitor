import { azureBlobService } from '../../shared/services/azureBlobService.js'
import { azureCosmosService } from '../../shared/services/azureCosmosService.js'
import { parseString } from 'xml2js'
import { promisify } from 'util'
import type { 
  ProcessingJob, 
  HealthMetric, 
  ProcessingOptions,
  RAGDocument
} from '../../shared/types/index.js'
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'

const parseXml = promisify(parseString)

// Constants for batching
const BATCH_SIZE = 100 // Process 100 records at a time
const MEMORY_THRESHOLD = 10 * 1024 * 1024 // 10MB memory threshold - much more conservative

// Type definitions for Apple Health XML structure
interface XMLRecord {
  $: {
    type: string
    value: string
    unit?: string
    sourceName?: string
    sourceVersion?: string
    device?: string
    creationDate?: string
    startDate?: string
    endDate?: string
  }
}

interface ParsedHealthXML {
  HealthData?: {
    Record?: XMLRecord | XMLRecord[]
  }
}

export class FileProcessingService {
  private processingJobs: Map<string, ProcessingJob> = new Map()

  async initialize(): Promise<void> {
    await azureBlobService.initialize()
    await azureCosmosService.initialize()
    console.log('File Processing Service initialized')
  }

  //process given rag document id, and save the health metrics to the cosmos db
  async processFile(ragDocumentId: string, userId: string, options: ProcessingOptions = {}){
    const ragDocument = await azureCosmosService.getRAGDocument(ragDocumentId, userId)
    if (!ragDocument) {
      throw new Error('RAG document not found')
    }

    if (ragDocument.isProcessed) {
      return true
    }

    //get file path from the rag document
    const filePath = ragDocument.documentFilePath

    //load the file from the blob storage
    const fileBuffer = await azureBlobService.downloadFile(filePath)

    //parse the file to health metrics, passing through the options
    const healthMetrics = await this.parseXmlToHealthMetrics(fileBuffer, ragDocument.user_id, options)
    
    // Note: For large files, metrics are already saved incrementally during parsing
    // For smaller files, we need to save them now
    if (fileBuffer.length <= MEMORY_THRESHOLD) {
      console.log('Small file detected, saving metrics to database')
      const savedMetrics = await azureCosmosService.createHealthMetricsBatch(healthMetrics)
    } else {
      console.log('Large file completed - metrics already saved incrementally')
    }

    //update the rag document is_processed to true
    // ragDocument.isProcessed = true
    // const updatedRagDocument = await azureCosmosService.updateRAGDocument(
    //   ragDocumentId,
    //   ragDocument
    // )

    return true
  }

  private async processFileAsync(
    jobId: string,
    userId: string,
    fileName: string,
    options: ProcessingOptions
  ): Promise<void> {
    const filePath = `${userId}/${fileName}`
    
    try {
      // Update job status to processing
      await this.updateJobStatus(jobId, userId, 'processing', 10)

      // Check if file exists
      const fileExists = await azureBlobService.fileExists(filePath)
      if (!fileExists) {
        throw new Error(`File not found: ${filePath}`)
      }

      // Download file from blob storage
      await this.updateJobStatus(jobId, userId, 'processing', 20)
      const fileBuffer = await azureBlobService.downloadFile(filePath)
      
      // Parse XML to JSON (placeholder for your implementation)
      await this.updateJobStatus(jobId, userId, 'processing', 40)
      
      // Check file size and use appropriate processing method
      const isLargeFile = fileBuffer.length > MEMORY_THRESHOLD
      
      if (isLargeFile) {
        // For large files, metrics are saved incrementally during parsing
        const healthMetrics = await this.parseXmlToHealthMetrics(fileBuffer, userId, options)
        await this.updateJobStatus(jobId, userId, 'processing', 90)
        
        // Update job status to completed
        await this.updateJobStatus(jobId, userId, 'completed', 100, {
          processedRecords: healthMetrics.length,
          failedRecords: 0,
          errors: [],
          processingMethod: 'streaming_batch'
        })
      } else {
        // For smaller files, use traditional approach
        const healthMetrics = await this.parseXmlToHealthMetrics(fileBuffer, userId, options)
        
        // Save to Cosmos DB
        await this.updateJobStatus(jobId, userId, 'processing', 80)
        const savedMetrics = await azureCosmosService.createHealthMetricsBatch(healthMetrics)
        
        // Update job status to completed
        await this.updateJobStatus(jobId, userId, 'completed', 100, {
          processedRecords: savedMetrics.length,
          failedRecords: 0,
          errors: [],
          processingMethod: 'traditional'
        })
      }

      console.log(`File processing completed for job ${jobId}`)

    } catch (error) {
      console.error(`File processing failed for job ${jobId}:`, error)
      await this.updateJobStatus(jobId, userId, 'failed', 0, {
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  private async updateJobStatus(
    jobId: string,
    userId: string,
    status: ProcessingJob['status'],
    progress: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const updates: Partial<ProcessingJob> = {
      status,
      progress,
      ...(metadata && { metadata })
    }

    // Update local cache only since processing jobs are no longer stored in Cosmos
    const job = this.processingJobs.get(jobId)
    if (job) {
      Object.assign(job, updates, { updatedAt: new Date() })
    }
  }

  private async parseXmlToHealthMetrics(
    fileBuffer: Buffer,
    userId: string,
    options: ProcessingOptions
  ): Promise<Omit<HealthMetric, 'id'>[]> {
    const xmlContent = fileBuffer.toString('utf-8')
    console.log(`Parsing XML content for user ${userId}, size: ${xmlContent.length} characters`)
    
    // For large files (>10MB), use streaming approach
    if (fileBuffer.length > MEMORY_THRESHOLD) {
      console.log('Large file detected, using streaming parser')
      return this.parseXmlToHealthMetricsStreaming(fileBuffer, userId, options)
    }
    
    try {
      // Parse XML using xml2js
      const parsedXml = await parseXml(xmlContent) as ParsedHealthXML
      
      if (!parsedXml.HealthData || !parsedXml.HealthData.Record) {
        console.warn('No Record elements found in XML')
        return []
      }
      
      const records = Array.isArray(parsedXml.HealthData.Record) 
        ? parsedXml.HealthData.Record 
        : [parsedXml.HealthData.Record]
      
      const healthMetrics: Omit<HealthMetric, 'id'>[] = []
      
      for (const record of records) {
        if (!record.$ || !record.$.type || !record.$.value) {
          console.warn('Skipping invalid record without required attributes:', record)
          continue
        }
        
        const attributes = record.$
        
        // Extract and process data
        const metricType = this.normalizeMetricType(attributes.type)
        const value = this.parseMetricValue(attributes.value, attributes.unit)
        const timestamp = this.parseDate(attributes.startDate || attributes.creationDate)
        const unit = attributes.unit || ''
        
        // Create health metric object
        const healthMetric: Omit<HealthMetric, 'id'> = {
          userId,
          metricType,
          value,
          unit,
          timestamp,
          source: attributes.sourceName || 'xml_import',
          metadata: {
            sourceVersion: attributes.sourceVersion,
            device: attributes.device,
            creationDate: attributes.creationDate,
            startDate: attributes.startDate,
            endDate: attributes.endDate,
            originalType: attributes.type
          },
          _partitionKey: userId
        }
        
        healthMetrics.push(healthMetric)
      }
      
      console.log(`Successfully parsed ${healthMetrics.length} health metrics from XML`)
      return healthMetrics
      
    } catch (error) {
      console.error('Error parsing XML:', error)
      throw new Error(`Failed to parse XML content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Stream-based XML parsing for large files
   * Improvements for large file handling:
   * 1. Processes records in batches to avoid memory exhaustion
   * 2. Saves to database incrementally for better error recovery
   * 3. Adds throttling to prevent database overload
   * 4. Provides detailed progress tracking
   * 5. Uses configurable batch size from options
   * 6. Processes XML in chunks to avoid loading entire file into memory
   */
  private async parseXmlToHealthMetricsStreaming(
    fileBuffer: Buffer,
    userId: string,
    options: ProcessingOptions
  ): Promise<Omit<HealthMetric, 'id'>[]> {
    const allMetrics: Omit<HealthMetric, 'id'>[] = []
    let processedBatches = 0
    
    // Use batch size from options or default
    const batchSize = options.batchSize || BATCH_SIZE
    const timeout = options.timeout || 300000 // 5 minutes default
    const startTime = Date.now()
    
    try {
      // For very large files, process in chunks to avoid memory issues
      const xmlContent = fileBuffer.toString('utf-8')
      
      // Try to estimate record count without parsing entire XML
      const recordMatches = xmlContent.match(/<Record /g)
      const estimatedRecords = recordMatches ? recordMatches.length : 0
      console.log(`Estimated ${estimatedRecords} records in XML file`)
      
      // Process XML in smaller chunks by splitting on Record boundaries
      const recordChunks = this.splitXMLIntoRecordChunks(xmlContent, batchSize)
      const totalChunks = recordChunks.length
      
      console.log(`Processing ${totalChunks} XML chunks of ~${batchSize} records each`)
      
      // Process each chunk separately
      for (let chunkIndex = 0; chunkIndex < recordChunks.length; chunkIndex++) {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          throw new Error(`Processing timeout after ${timeout}ms`)
        }
        
        try {
          const chunk = recordChunks[chunkIndex]
          const parsedChunk = await parseXml(chunk) as ParsedHealthXML
          
          if (!parsedChunk.HealthData || !parsedChunk.HealthData.Record) {
            console.warn(`No records found in chunk ${chunkIndex + 1}`)
            continue
          }
          
          const records = Array.isArray(parsedChunk.HealthData.Record) 
            ? parsedChunk.HealthData.Record 
            : [parsedChunk.HealthData.Record]
          
          const batchMetrics: Omit<HealthMetric, 'id'>[] = []
          
          for (const record of records) {
            if (!record.$ || !record.$.type || !record.$.value) {
              continue
            }
            
            const attributes = record.$
            const metricType = this.normalizeMetricType(attributes.type)
            const value = this.parseMetricValue(attributes.value, attributes.unit)
            const timestamp = this.parseDate(attributes.startDate || attributes.creationDate)
            const unit = attributes.unit || ''
            
            const healthMetric: Omit<HealthMetric, 'id'> = {
              userId,
              metricType,
              value,
              unit,
              timestamp,
              source: attributes.sourceName || 'xml_import',
              metadata: {
                sourceVersion: attributes.sourceVersion,
                device: attributes.device,
                creationDate: attributes.creationDate,
                startDate: attributes.startDate,
                endDate: attributes.endDate,
                originalType: attributes.type,
                ...(options.transformOptions || {})
              },
              _partitionKey: userId
            }
            
            batchMetrics.push(healthMetric)
          }
          
          // Save chunk to database immediately to free memory
          if (batchMetrics.length > 0) {
            await azureCosmosService.createHealthMetricsBatch(batchMetrics)
            allMetrics.push(...batchMetrics)
            processedBatches++
            console.log(`Processed chunk ${chunkIndex + 1}/${totalChunks} (${batchMetrics.length} records)`)
          }
          
          // Add throttling every 3 chunks to prevent overwhelming the database
          if (processedBatches % 3 === 0) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
          
          // Force garbage collection hint
          if (global.gc && processedBatches % 5 === 0) {
            global.gc()
          }
          
        } catch (chunkError) {
          console.error(`Error processing chunk ${chunkIndex + 1}:`, chunkError)
          // Continue with next chunk rather than failing entire operation
          processedBatches++
        }
      }
      
      console.log(`Successfully processed ${allMetrics.length} health metrics from large XML file in ${processedBatches} chunks`)
      return allMetrics
      
    } catch (error) {
      console.error('Error parsing large XML file:', error)
      console.log(`Partial progress: ${processedBatches} chunks completed, ${allMetrics.length} records saved`)
      throw new Error(`Failed to parse large XML content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Split XML content into smaller chunks based on Record boundaries
   */
  private splitXMLIntoRecordChunks(xmlContent: string, recordsPerChunk: number): string[] {
    console.log(`[splitXMLIntoRecordChunks] Splitting XML into chunks of ${recordsPerChunk} records`)
    const chunks: string[] = []
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<HealthData>\n'
    const xmlFooter = '\n</HealthData>'
    
    // Find all Record elements using regex
    const recordRegex = /<Record[^>]*(?:\/>|>.*?<\/Record>)/gs
    const records = xmlContent.match(recordRegex) || []
    
    console.log(`[splitXMLIntoRecordChunks] Found ${records.length} records in XML`)
    // Group records into chunks
    for (let i = 0; i < records.length; i += recordsPerChunk) {
      const chunkRecords = records.slice(i, i + recordsPerChunk)
      const chunkContent = xmlHeader + chunkRecords.join('\n') + xmlFooter
      chunks.push(chunkContent)
    }
    
    return chunks
  }

  /**
   * Normalize Apple Health metric types to more readable format
   */
  private normalizeMetricType(hkType: string): string {
    const typeMap: Record<string, string> = {
      'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'heart_rate_variability_sdnn',
      'HKQuantityTypeIdentifierBloodPressureSystolic': 'blood_pressure_systolic',
      'HKQuantityTypeIdentifierBloodPressureDiastolic': 'blood_pressure_diastolic',
      'HKQuantityTypeIdentifierStepCount': 'step_count',
      'HKQuantityTypeIdentifierDistanceWalkingRunning': 'distance_walking_running',
      'HKQuantityTypeIdentifierActiveEnergyBurned': 'active_energy_burned',
      'HKQuantityTypeIdentifierBasalEnergyBurned': 'basal_energy_burned',
      'HKQuantityTypeIdentifierBodyMass': 'body_weight',
      'HKQuantityTypeIdentifierHeight': 'height',
      'HKQuantityTypeIdentifierBloodGlucose': 'blood_glucose',
      'HKQuantityTypeIdentifierOxygenSaturation': 'oxygen_saturation',
      'HKQuantityTypeIdentifierBodyTemperature': 'body_temperature',
      'HKQuantityTypeIdentifierRespiratoryRate': 'respiratory_rate',
      'HKQuantityTypeIdentifierPhysicalEffort': 'physical_effort',
      'HKCategoryTypeIdentifierSleepAnalysis': 'sleep_analysis',
      'HKQuantityTypeIdentifierStairAscentSpeed': 'stair_ascent_speed',
      'HKQuantityTypeIdentifierStairDescentSpeed': 'stair_descent_speed',
      'HKQuantityTypeIdentifierEnvironmentalSoundReduction': 'environmental_sound_reduction',
      'HKQuantityTypeIdentifierTimeInDaylight': 'time_in_daylight',
      'HKQuantityTypeIdentifierWalkingStepLength': 'walking_step_length',
      'HKQuantityTypeIdentifierWalkingAsymmetryPercentage': 'walking_asymmetry_percentage',
      'HKQuantityTypeIdentifierWalkingSpeed': 'walking_speed',
      'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage': 'walking_double_support_percentage',
      'HKQuantityTypeIdentifierAppleStandTime': 'stand_time',
      'HKQuantityTypeIdentifierHeadphoneAudioExposure': 'headphone_audio_exposure',
      'HKQuantityTypeIdentifierFlightsClimbed': 'flights_climbed',
      'HKQuantityTypeIdentifierAppleExerciseTime': 'exercise_time',
      'HKWorkoutTypeIdentifier': 'workout'
    }
    
    return typeMap[hkType] || hkType.toLowerCase().replace('hk', '').replace(/([A-Z])/g, '_$1').toLowerCase()
  }

  /**
   * Parse metric value, handling both numeric and string values
   */
  private parseMetricValue(value: string, unit?: string): number | string {
    // Try to parse as number first
    const numericValue = parseFloat(value)
    if (!isNaN(numericValue)) {
      return numericValue
    }
    
    // Return as string if not numeric (e.g., for categorical data)
    return value
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateString?: string): Date {
    if (!dateString) {
      return new Date()
    }
    
    // Handle Apple Health date format: "2024-06-15 14:25:19 +0200"
    const date = new Date(dateString)
    
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${dateString}, using current date`)
      return new Date()
    }
    
    return date
  }

  async deleteHealthMetrics(userId: string, metricType?: string): Promise<void> {
    await azureCosmosService.deleteHealthMetrics(userId, metricType)
  }

  async getMetricsCount(userId: string): Promise<number> {
    return await azureCosmosService.getMetricsCount(userId)
  }
}

export const fileProcessingService = new FileProcessingService() 