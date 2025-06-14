import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processXML, formatRecordToString, generateEmbedding, storeHealthData, processAndStoreXML } from './xmlProcessor';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 1. Move mock data to the very top of the file
const mockHealthData = {
  id: '123',
  user_id: 'user-123',
  document_id: 'doc-123',
  content_chunk: 'Distance Walking Running: "0.0171531" km recorded start at 2022-08-28 10:19:25 +0200 end at 2022-08-28 10:19:51 +0200 from source "Hao\'s Apple Watch"',
  embedding: Array(1536).fill(0.1),
  chunk_index: 0,
  metadata: {
    originalFormat: 'xml',
    contentLength: 150
  },
  created_at: '2024-03-15T12:00:00Z'
};

const mockXmlString = `
<Record 
  type="HKQuantityTypeIdentifierDistanceWalkingRunning" 
  sourceName="Hao's Apple Watch" 
  sourceVersion="8.4.2" 
  device="Apple Watch" 
  unit="km" 
  creationDate="2022-08-28 10:20:00 +0200" 
  startDate="2022-08-28 10:19:25 +0200" 
  endDate="2022-08-28 10:19:51 +0200" 
  value="0.0171531"
/>
`;

// 2. Then do your vi.mock calls
// vi.mock('@supabase/supabase-js', () => ({
//   createClient: vi.fn().mockReturnValue({
//     from: vi.fn().mockReturnValue({
//       insert: vi.fn().mockReturnValue({
//         select: vi.fn().mockReturnValue({
//           single: vi.fn().mockResolvedValue({
//             data: mockHealthData,
//             error: null
//           })
//         })
//       })
//     }),
//     // Add required SupabaseClient properties
//     supabaseUrl: 'mock-url',
//     supabaseKey: 'mock-key',
//     auth: {},
//     realtime: {},
//     rest: {},
//     storage: {},
//     rpc: vi.fn(),
//     schema: vi.fn(),
//     channel: vi.fn(),
//     removeChannel: vi.fn(),
//     removeAllChannels: vi.fn(),
//     getChannels: vi.fn(),
//     getSubscriptions: vi.fn()
//   })
// }));

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    embeddings: {
      create: vi.fn(() => Promise.resolve({
        data: [{
          embedding: Array(1536).fill(0.1)
        }]
      }))
    }
  }))
}));

// 3. Then import your code under test
import { processXML, formatRecordToString, generateEmbedding, storeHealthData, processAndStoreXML } from './xmlProcessor';

describe('XML Processor Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processXML', () => {
    it('should parse XML string into an object', async () => {
      const result = await processXML(mockXmlString);
      expect(result).toHaveProperty('Record');
      expect(result.Record).toHaveProperty('@_type', 'HKQuantityTypeIdentifierDistanceWalkingRunning');
      expect(result.Record).toHaveProperty('@_value', '0.0171531');
    });

    it('should throw error for invalid XML', async () => {
      await expect(processXML('<invalid>')).rejects.toThrow();
    });
  });

  describe.only('formatRecordToString', () => {
    it('should format record into readable string', () => {
      const record = {
        '@_type': 'HKQuantityTypeIdentifierDistanceWalkingRunning',
        '@_value': '0.0171531',
        '@_unit': 'km',
        '@_startDate': '2022-08-28 10:19:25 +0200',
        '@_endDate': '2022-08-28 10:19:51 +0200',
        '@_sourceName': 'Hao\'s Apple Watch'
      };

      const result = formatRecordToString(record);
      expect(result).toBe('Distance Walking Running: "0.0171531" km recorded start at 2022-08-28 10:19:25 +0200 end at 2022-08-28 10:19:51 +0200 from source "Hao\'s Apple Watch"');
    });

    it('should handle missing optional fields', () => {
      const record = {
        '@_type': 'HKQuantityTypeIdentifierDistanceWalkingRunning',
        '@_value': '0.0171531',
        '@_unit': 'km',
        '@_startDate': '2022-08-28 10:19:25 +0200',
        '@_endDate': '',
        '@_sourceName': ''
      };

      const result = formatRecordToString(record);
      expect(result).toContain('Distance Walking Running');
      expect(result).toContain('0.0171531');
      expect(result).toContain('km');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const text = 'Test text for embedding';
      const result = await generateEmbedding(text);
      expect(result).toHaveLength(1536);
      expect(result.every(val => typeof val === 'number')).toBe(true);
    });

    it('should throw error for empty text', async () => {
      await expect(generateEmbedding('')).rejects.toThrow();
    });
  });

  describe('storeHealthData', () => {
    it('should store health data in Supabase', async () => {
      const result = await storeHealthData(mockHealthData);
      expect(result).toEqual(mockHealthData);
    });

    it('should throw error when Supabase insert fails', async () => {
      const mockError = new Error('Insert failed');
      vi.mocked(createClient).mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: mockError
              })
            })
          })
        })
      }));

      await expect(storeHealthData(mockHealthData)).rejects.toThrow('Insert failed');
    });
  });

  describe('processAndStoreXML', () => {
    it('should process XML and store with embeddings', async () => {
      const result = await processAndStoreXML(
        mockXmlString,
        'user-123',
        'doc-123',
        { source: 'apple_health' }
      );

      expect(result).toHaveProperty('user_id', 'user-123');
      expect(result).toHaveProperty('document_id', 'doc-123');
      expect(result).toHaveProperty('embedding');
      expect(result.embedding).toHaveLength(1536);
      expect(result.metadata).toHaveProperty('source', 'apple_health');
    });

    it('should throw error for invalid XML', async () => {
      await expect(processAndStoreXML(
        '<invalid>',
        'user-123',
        'doc-123'
      )).rejects.toThrow();
    });
  });
}); 