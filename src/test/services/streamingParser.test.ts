import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StreamingXMLParser, StreamingJSONParser } from '@/services/streamingParser'

describe('StreamingXMLParser', () => {
  let parser: StreamingXMLParser
  let mockOnRecord: ReturnType<typeof vi.fn>
  let mockOnProgress: ReturnType<typeof vi.fn>
  let mockOnError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnRecord = vi.fn()
    mockOnProgress = vi.fn()
    mockOnError = vi.fn()
    
    parser = new StreamingXMLParser({
      onRecord: mockOnRecord,
      onProgress: mockOnProgress,
      onError: mockOnError
    })
  })

  describe('parseStream', () => {
    it('should parse complete XML records from stream', async () => {
      // Arrange
      const xmlData = `
        <Record type="HKQuantityTypeIdentifierHeartRate" value="72" unit="count/min" startDate="2024-01-01T10:00:00Z" endDate="2024-01-01T10:00:00Z" />
        <Record type="HKQuantityTypeIdentifierStepCount" value="1000" unit="count" startDate="2024-01-01T10:00:00Z" endDate="2024-01-01T10:00:00Z" />
      `
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(xmlData))
          controller.close()
        }
      })

      // Act
      const records = await parser.parseStream(stream)

      // Assert
      expect(records).toHaveLength(2)
      expect(records[0]).toEqual({
        type: 'HKQuantityTypeIdentifierHeartRate',
        value: 72,
        unit: 'count/min',
        startDate: '2024-01-01T10:00:00Z',
        endDate: '2024-01-01T10:00:00Z'
      })
      expect(mockOnRecord).toHaveBeenCalledTimes(2)
    })

    it('should handle chunked XML data correctly', async () => {
      // Arrange
      const xmlPart1 = '<Record type="HKQuantityTypeIdentifierHeartRate" value="72" '
      const xmlPart2 = 'unit="count/min" startDate="2024-01-01T10:00:00Z" endDate="2024-01-01T10:00:00Z" />'
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(xmlPart1))
          controller.enqueue(encoder.encode(xmlPart2))
          controller.close()
        }
      })

      // Act
      const records = await parser.parseStream(stream)

      // Assert
      expect(records).toHaveLength(1)
      expect(records[0].type).toBe('HKQuantityTypeIdentifierHeartRate')
      expect(records[0].value).toBe(72)
    })

    it('should handle malformed XML gracefully', async () => {
      // Arrange
      const malformedXML = '<Record type="invalid" value="test" unclosed'
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(malformedXML))
          controller.close()
        }
      })

      // Act
      const records = await parser.parseStream(stream)

      // Assert
      expect(records).toHaveLength(0)
      expect(mockOnError).toHaveBeenCalled()
    })

    it('should report progress during parsing', async () => {
      // Arrange
      const xmlData = '<Record type="test" value="1" />'
      parser.setTotalSize(xmlData.length)
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(xmlData))
          controller.close()
        }
      })

      // Act
      await parser.parseStream(stream)

      // Assert
      expect(mockOnProgress).toHaveBeenCalledWith(100)
    })

    it('should convert numeric values correctly', async () => {
      // Arrange
      const xmlData = `
        <Record type="test" value="72.5" intValue="100" stringValue="text" />
      `
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(xmlData))
          controller.close()
        }
      })

      // Act
      const records = await parser.parseStream(stream)

      // Assert
      expect(records[0].value).toBe(72.5)
      expect(records[0].intValue).toBe('100') // Non-value attributes stay as strings
      expect(records[0].stringValue).toBe('text')
    })
  })

  describe('getRecordCount', () => {
    it('should return correct record count', async () => {
      // Arrange
      const xmlData = `
        <Record type="test1" value="1" />
        <Record type="test2" value="2" />
        <Record type="test3" value="3" />
      `
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(xmlData))
          controller.close()
        }
      })

      // Act
      await parser.parseStream(stream)

      // Assert
      expect(parser.getRecordCount()).toBe(3)
    })
  })
})

describe('StreamingJSONParser', () => {
  let parser: StreamingJSONParser
  let mockOnRecord: ReturnType<typeof vi.fn>
  let mockOnError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnRecord = vi.fn()
    mockOnError = vi.fn()
    
    parser = new StreamingJSONParser({
      onRecord: mockOnRecord,
      onError: mockOnError
    })
  })

  describe('parseStream', () => {
    it('should parse complete JSON objects from stream', async () => {
      // Arrange
      const jsonData = '{"type":"heartRate","value":72}{"type":"steps","value":1000}'
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(jsonData))
          controller.close()
        }
      })

      // Act
      const records = await parser.parseStream(stream)

      // Assert
      expect(records).toHaveLength(2)
      expect(records[0]).toEqual({ type: 'heartRate', value: 72 })
      expect(records[1]).toEqual({ type: 'steps', value: 1000 })
      expect(mockOnRecord).toHaveBeenCalledTimes(2)
    })

    it('should handle chunked JSON data correctly', async () => {
      // Arrange
      const jsonPart1 = '{"type":"heartRate",'
      const jsonPart2 = '"value":72}'
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(jsonPart1))
          controller.enqueue(encoder.encode(jsonPart2))
          controller.close()
        }
      })

      // Act
      const records = await parser.parseStream(stream)

      // Assert
      expect(records).toHaveLength(1)
      expect(records[0]).toEqual({ type: 'heartRate', value: 72 })
    })

    it('should handle nested JSON objects', async () => {
      // Arrange
      const nestedJson = '{"user":{"id":1,"profile":{"name":"test"}},"data":[1,2,3]}'
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(nestedJson))
          controller.close()
        }
      })

      // Act
      const records = await parser.parseStream(stream)

      // Assert
      expect(records).toHaveLength(1)
      expect(records[0]).toEqual({
        user: { id: 1, profile: { name: 'test' } },
        data: [1, 2, 3]
      })
    })

    it('should handle malformed JSON gracefully', async () => {
      // Arrange
      const malformedJson = '{"type":"test","value":}'
      
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(malformedJson))
          controller.close()
        }
      })

      // Act
      const records = await parser.parseStream(stream)

      // Assert
      expect(records).toHaveLength(0)
      expect(mockOnError).toHaveBeenCalled()
    })
  })
})