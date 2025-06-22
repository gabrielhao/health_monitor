import { azureBlobService } from '../../shared/services/azureBlobService.js'
import { azureCosmosService } from '../../shared/services/azureCosmosService.js'
import { parseString } from 'xml2js'
import { promisify } from 'util'
import type { 
  ProcessingJob, 
  ProcessingResult, 
  HealthMetric, 
  ProcessingOptions,
  FileProcessingRequest 
} from '../../shared/types/index.js'

const parseXml = promisify(parseString)

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

    //get file path from the rag document
    const filePath = ragDocument.documentFilePath

    //load the file from the blob storage
    const fileBuffer = await azureBlobService.downloadFile(filePath)

    //parse the file to health metrics
    const healthMetrics = await this.parseXmlToHealthMetrics(fileBuffer, ragDocument.userId, options)
    
    //save health metrics to the cosmos db
    const savedMetrics = await azureCosmosService.createHealthMetricsBatch(healthMetrics)

    //update the rag document is_processed to true
    const updatedRagDocument = await azureCosmosService.updateRAGDocument(
      ragDocumentId,
      userId,
      { isProcessed: true }
    )

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
      const healthMetrics = await this.parseXmlToHealthMetrics(fileBuffer, userId, options)
      
      // Save to Cosmos DB
      await this.updateJobStatus(jobId, userId, 'processing', 80)
      const savedMetrics = await azureCosmosService.createHealthMetricsBatch(healthMetrics)
      
      // Update job status to completed
      await this.updateJobStatus(jobId, userId, 'completed', 100, {
        processedRecords: savedMetrics.length,
        failedRecords: 0,
        errors: []
      })

      console.log(`File processing completed for job ${jobId}: ${savedMetrics.length} metrics saved`)

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
   * Normalize Apple Health metric types to more readable format
   */
  private normalizeMetricType(hkType: string): string {
    const typeMap: Record<string, string> = {
      'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
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
      'HKCategoryTypeIdentifierSleepAnalysis': 'sleep_analysis',
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