import { supabase } from './supabase'
import type { 
  HealthDocument, 
  HealthEmbedding, 
  ImportSession, 
  DataSource, 
  SimilarContent,
  HealthDataImport,
  AppleHealthData,
  ProcessedHealthData
} from '@/types/vector'

export class VectorService {
  // Health Documents
  static async createHealthDocument(document: Omit<HealthDocument, 'id' | 'created_at'>): Promise<HealthDocument> {
    const { data, error } = await supabase
      .from('health_documents')
      .insert(document)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getHealthDocuments(userId: string, filters?: {
    source_app?: string
    document_type?: string
    limit?: number
  }): Promise<HealthDocument[]> {
    let query = supabase
      .from('health_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (filters?.source_app) {
      query = query.eq('source_app', filters.source_app)
    }

    if (filters?.document_type) {
      query = query.eq('document_type', filters.document_type)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  // Vector Embeddings
  static async createEmbedding(embedding: Omit<HealthEmbedding, 'id' | 'created_at'>): Promise<HealthEmbedding> {
    const { data, error } = await supabase
      .from('health_embeddings')
      .insert(embedding)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async searchSimilarContent(
    queryEmbedding: number[],
    userId: string,
    options?: {
      threshold?: number
      limit?: number
    }
  ): Promise<SimilarContent[]> {
    const { data, error } = await supabase.rpc('search_similar_health_content', {
      query_embedding: queryEmbedding,
      user_id_param: userId,
      match_threshold: options?.threshold || 0.8,
      match_count: options?.limit || 10
    })

    if (error) throw error
    return data || []
  }

  // Import Sessions
  static async createImportSession(session: Omit<ImportSession, 'id' | 'started_at'>): Promise<ImportSession> {
    const { data, error } = await supabase
      .from('import_sessions')
      .insert(session)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateImportSession(
    sessionId: string, 
    updates: Partial<ImportSession>
  ): Promise<ImportSession> {
    const { data, error } = await supabase
      .from('import_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getImportSessions(userId: string): Promise<ImportSession[]> {
    const { data, error } = await supabase
      .from('import_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Data Sources
  static async createDataSource(source: Omit<DataSource, 'id' | 'created_at' | 'updated_at'>): Promise<DataSource> {
    const { data, error } = await supabase
      .from('data_sources')
      .insert(source)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getDataSources(userId: string): Promise<DataSource[]> {
    const { data, error } = await supabase
      .from('data_sources')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async updateDataSource(
    sourceId: string, 
    updates: Partial<DataSource>
  ): Promise<DataSource> {
    const { data, error } = await supabase
      .from('data_sources')
      .update(updates)
      .eq('id', sourceId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Health Data Processing
  static processAppleHealthData(appleData: AppleHealthData[]): ProcessedHealthData[] {
    return appleData.map(item => ({
      title: `${item.type} - ${new Date(item.startDate).toLocaleDateString()}`,
      content: this.formatAppleHealthContent(item),
      document_type: this.mapAppleHealthType(item.type),
      metadata: {
        original_type: item.type,
        value: item.value,
        unit: item.unit,
        start_date: item.startDate,
        end_date: item.endDate,
        source_name: item.sourceName,
        source_version: item.sourceVersion,
        device: item.device,
        ...item.metadata
      }
    }))
  }

  private static formatAppleHealthContent(item: AppleHealthData): string {
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
      content += `\nDuration: ${item.startDate} to ${item.endDate}`
    }

    return content
  }

  private static mapAppleHealthType(appleType: string): string {
    const typeMapping: Record<string, string> = {
      'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
      'HKQuantityTypeIdentifierBloodPressureSystolic': 'blood_pressure',
      'HKQuantityTypeIdentifierBloodPressureDiastolic': 'blood_pressure',
      'HKQuantityTypeIdentifierBodyMass': 'weight',
      'HKQuantityTypeIdentifierHeight': 'height',
      'HKQuantityTypeIdentifierStepCount': 'steps',
      'HKQuantityTypeIdentifierDistanceWalkingRunning': 'exercise',
      'HKQuantityTypeIdentifierActiveEnergyBurned': 'exercise',
      'HKCategoryTypeIdentifierSleepAnalysis': 'sleep',
      'HKQuantityTypeIdentifierBloodGlucose': 'blood_sugar',
      'HKQuantityTypeIdentifierBodyTemperature': 'temperature',
      'HKQuantityTypeIdentifierOxygenSaturation': 'oxygen_saturation',
      'HKQuantityTypeIdentifierDietaryWater': 'water_intake'
    }

    return typeMapping[appleType] || 'general'
  }

  // Bulk Import
  static async importHealthData(
    userId: string,
    importData: HealthDataImport
  ): Promise<ImportSession> {
    // Create import session
    const session = await this.createImportSession({
      user_id: userId,
      source_app: importData.source,
      status: 'processing',
      total_records: importData.data.length,
      processed_records: 0,
      failed_records: 0,
      error_log: [],
      metadata: importData.metadata || {}
    })

    try {
      let processedCount = 0
      let failedCount = 0
      const errors: any[] = []

      // Process data based on source
      let processedData: ProcessedHealthData[] = []
      
      if (importData.source === 'apple_health') {
        processedData = this.processAppleHealthData(importData.data as AppleHealthData[])
      } else {
        // Add other source processors here
        processedData = importData.data.map(item => ({
          title: `${importData.source} data`,
          content: JSON.stringify(item),
          document_type: 'general',
          metadata: item
        }))
      }

      // Create health documents
      for (const item of processedData) {
        try {
          await this.createHealthDocument({
            user_id: userId,
            source_app: importData.source,
            document_type: item.document_type,
            title: item.title,
            content: item.content,
            metadata: item.metadata,
            import_session_id: session.id,
            processed_at: new Date().toISOString()
          })
          processedCount++
        } catch (error) {
          failedCount++
          errors.push({
            item: item.title,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Update session with results
      return await this.updateImportSession(session.id, {
        status: failedCount === 0 ? 'completed' : 'completed',
        processed_records: processedCount,
        failed_records: failedCount,
        error_log: errors,
        completed_at: new Date().toISOString()
      })

    } catch (error) {
      // Update session with failure
      await this.updateImportSession(session.id, {
        status: 'failed',
        error_log: [{
          error: error instanceof Error ? error.message : 'Import failed'
        }],
        completed_at: new Date().toISOString()
      })
      throw error
    }
  }
}