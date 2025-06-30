export interface StreamingParserOptions {
  chunkSize?: number
  onRecord?: (record: any) => void
  onProgress?: (progress: number) => void
  onError?: (error: Error) => void
}

export class StreamingXMLParser {
  private buffer = ''
  private recordCount = 0
  private totalSize = 0
  private processedSize = 0
  
  constructor(private options: StreamingParserOptions = {}) {}

  async parseStream(stream: ReadableStream<Uint8Array>): Promise<any[]> {
    const records: any[] = []
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        this.buffer += chunk
        this.processedSize += chunk.length
        
        // Extract complete records from buffer
        const extractedRecords = this.extractRecords()
        records.push(...extractedRecords)
        
        // Progress callback
        if (this.totalSize > 0) {
          const progress = (this.processedSize / this.totalSize) * 100
          this.options.onProgress?.(progress)
        }
      }
      
      // Process any remaining buffer
      const finalRecords = this.extractRecords(true)
      records.push(...finalRecords)
      
      return records
    } finally {
      reader.releaseLock()
    }
  }

  private extractRecords(_final = false): any[] {
    const records: any[] = []
    
    // Look for complete Record elements
    const recordPattern = /<Record[^>]*>.*?<\/Record>/g
    let match
    
    while ((match = recordPattern.exec(this.buffer)) !== null) {
      try {
        const recordXML = match[0]
        const record = this.parseRecordXML(recordXML)
        
        if (record) {
          records.push(record)
          this.recordCount++
          this.options.onRecord?.(record)
        }
      } catch (error) {
        this.options.onError?.(error as Error)
      }
    }
    
    if (records.length > 0) {
      // Remove processed records from buffer
      const lastMatch = records.length > 0 ? recordPattern.lastIndex : 0
      this.buffer = this.buffer.substring(lastMatch)
    }
    
    return records
  }

  private parseRecordXML(recordXML: string): any | null {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(`<root>${recordXML}</root>`, 'text/xml')
      const record = xmlDoc.getElementsByTagName('Record')[0]
      
      if (!record) return null
      
      const result: any = {}
      
      // Extract attributes
      for (let i = 0; i < record.attributes.length; i++) {
        const attr = record.attributes[i]
        let value: any = attr.value
        
        // Try to convert numeric values
        if (attr.name === 'value' && !isNaN(Number(value))) {
          value = Number(value)
        }
        
        result[attr.name] = value
      }
      
      return result
    } catch (error) {
      console.warn('Failed to parse record XML:', error)
      return null
    }
  }

  setTotalSize(size: number): void {
    this.totalSize = size
  }

  getRecordCount(): number {
    return this.recordCount
  }
}

export class StreamingJSONParser {
  private buffer = ''
  private depth = 0
  private recordCount = 0
  
  constructor(private options: StreamingParserOptions = {}) {}

  async parseStream(stream: ReadableStream<Uint8Array>): Promise<any[]> {
    const records: any[] = []
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        this.buffer += chunk
        
        // Extract complete JSON objects
        const extractedRecords = this.extractJSONObjects()
        records.push(...extractedRecords)
      }
      
      return records
    } finally {
      reader.releaseLock()
    }
  }

  private extractJSONObjects(): any[] {
    const records: any[] = []
    let startIndex = 0
    
    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i]
      
      if (char === '{') {
        if (this.depth === 0) {
          startIndex = i
        }
        this.depth++
      } else if (char === '}') {
        this.depth--
        
        if (this.depth === 0) {
          // Complete object found
          const objectStr = this.buffer.substring(startIndex, i + 1)
          
          try {
            const obj = JSON.parse(objectStr)
            records.push(obj)
            this.recordCount++
            this.options.onRecord?.(obj)
          } catch (error) {
            this.options.onError?.(error as Error)
          }
        }
      }
    }
    
    // Remove processed objects from buffer
    if (records.length > 0 && this.depth === 0) {
      const lastObjectEnd = this.buffer.lastIndexOf('}') + 1
      this.buffer = this.buffer.substring(lastObjectEnd)
    }
    
    return records
  }
}