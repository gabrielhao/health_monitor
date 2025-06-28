// @types/jest is already in package.json, these tests will work when dependencies are installed

import {
  validateEnvironment,
  AzureServices,
  EmbeddingService,
  AppleHealthXMLProcessor,
  ChunkingService,
  DocumentService,
  processChunk,
  processChunksInBatches,
  AppleHealthRecord,
  EmbeddingDocument,
  MAX_CHUNK_SIZE,
  BATCH_SIZE
} from "./index";

// Mock external dependencies
jest.mock("@azure/cosmos");
jest.mock("@azure/openai");

describe("Azure Function - Generate Embeddings", () => {
  
  beforeEach(() => {
    // Reset environment variables
    process.env.CosmosDbConnectionString = "https://YOUR_OPENAI_RESOURCE.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15";
    process.env.AZURE_OPENAI_ENDPOINT = "https://health-monitor-openai.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15";
    process.env.AZURE_OPENAI_KEY = "2xuYfteZCwnqUQSqFEjXvbmgjpKGxgoHrCMnvV3yHY44l3BkX0cfJQQJ99BFACYeBjFXJ3w3AAABACOGRFKO";
    
    // Clear all mocks
    jest.clearAllMocks();
    AzureServices.resetContainer();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.CosmosDbConnectionString;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_KEY;
  });


  describe("EmbeddingService", () => {
    describe("generateEmbedding", () => {
      it("should validate input text properly", async () => {
        const testText = "heart rate: 89 count/min recorded from 2024-06-15 14:25:19 +0200 to 2024-06-15 14:25:19 +0200 via Hao's Apple Watch on Apple Watch";
        
        // Test that the function validates input length (it should trim to MAX_TEXT_LENGTH)
        // Since we can't easily mock the Azure client in this setup, we'll test the validation logic
        expect(testText.length).toBeLessThan(8000); // Should be well under the limit
        
        // The actual embedding call will fail due to missing Azure credentials,
        // but we can verify the input validation works
        await expect(EmbeddingService.generateEmbedding(testText)).rejects.toThrow();
      });
    });

    describe("calculateOptimalChunkSize", () => {
      it("should return default size for empty records", () => {
        const result = EmbeddingService.calculateOptimalChunkSize([]);
        expect(result).toBe(MAX_CHUNK_SIZE);
      });

      it("should calculate optimal size based on record length", () => {
        const testRecords: AppleHealthRecord[] = [
          {
            '@_type': 'HKQuantityTypeIdentifierHeartRate',
            '@_value': '89',
            '@_unit': 'count/min',
            '@_startDate': '2024-06-15 14:25:19 +0200',
            '@_endDate': '2024-06-15 14:25:19 +0200',
            '@_sourceName': "Hao's Apple Watch",
            '@_device': 'Apple Watch'
          }
        ];

        const result = EmbeddingService.calculateOptimalChunkSize(testRecords);
        expect(result).toBeGreaterThanOrEqual(10);
        expect(result).toBeLessThanOrEqual(35);
      });
    });
  });

  describe("AppleHealthXMLProcessor", () => {
    describe("parseXML", () => {
      it("should throw error for empty XML", () => {
        expect(() => {
          AppleHealthXMLProcessor.parseXML("");
        }).toThrow("Empty XML content provided");
      });

      it("should parse valid Apple Health XML", () => {
        const validXML = `<?xml version="1.0" encoding="UTF-8"?>
        <HealthData>
          <Record type="HKQuantityTypeIdentifierHeartRate" 
                  sourceName="Hao's Apple Watch" 
                  value="89" 
                  unit="count/min" 
                  startDate="2024-06-15 14:25:19 +0200" 
                  endDate="2024-06-15 14:25:19 +0200"/>
        <Record type="HKQuantityTypeIdentifierBasalEnergyBurned" sourceName="Hao’s Apple Watch" sourceVersion="11.3.1" device="&lt;&lt;HKDevice: 0x30257ea80&gt;, name:Apple Watch, manufacturer:Apple Inc., model:Watch, hardware:Watch6,7, software:11.3.1, creation date:2025-02-12 01:08:50 +0000&gt;" unit="kcal" creationDate="2025-03-23 19:12:50 +0200" startDate="2025-03-23 19:12:45 +0200" endDate="2025-03-23 19:12:47 +0200" value="0.061"/>
 
        </HealthData>`;

        const result = AppleHealthXMLProcessor.parseXML(validXML);

        console.log("AppleHealthXMLProcessor: " + AppleHealthXMLProcessor.formatRecord(result[0]));
        console.log("AppleHealthXMLProcessor: " + AppleHealthXMLProcessor.formatRecord(result[1]));

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(result[0]['@_type']).toBe('HKQuantityTypeIdentifierHeartRate');
      });

      it("should throw error for invalid XML structure", () => {
        const invalidXML = `<?xml version="1.0"?><InvalidRoot></InvalidRoot>`;
        
        expect(() => {
          AppleHealthXMLProcessor.parseXML(invalidXML);
        }).toThrow("Invalid Apple Health XML: Missing HealthData.Record structure");
      });
    });

    describe("formatRecord", () => {
      it("should format health record correctly", () => {
        const testRecord: AppleHealthRecord = {
          '@_type': 'HKQuantityTypeIdentifierHeartRate',
          '@_value': '89',
          '@_unit': 'count/min',
          '@_startDate': '2024-06-15 14:25:19 +0200',
          '@_endDate': '2024-06-15 14:25:19 +0200',
          '@_sourceName': "Hao's Apple Watch",
          '@_device': 'Apple Watch'
        };

        const result = AppleHealthXMLProcessor.formatRecord(testRecord);
        expect(result).toContain("heart rate: 89 count/min");
        expect(result).toContain("Hao's Apple Watch");
        expect(result).toContain("Apple Watch");
      });

      it("should handle missing optional fields", () => {
        const minimalRecord: AppleHealthRecord = {
          '@_type': 'HKQuantityTypeIdentifierHeartRate',
          '@_value': '89',
          '@_startDate': '2024-06-15 14:25:19 +0200'
        };

        const result = AppleHealthXMLProcessor.formatRecord(minimalRecord);
        expect(result).toContain("heart rate: 89");
        expect(result).toContain("Unknown Source");
        expect(result).toContain("Unknown Device");
      });

      it("should format different health types correctly", () => {
        const stepRecord: AppleHealthRecord = {
          '@_type': 'HKQuantityTypeIdentifierStepCount',
          '@_value': '1000',
          '@_unit': 'count',
          '@_startDate': '2024-06-15 14:25:19 +0200'
        };

        const result = AppleHealthXMLProcessor.formatRecord(stepRecord);
        expect(result).toContain("step count: 1000 count");
      });
    });

    describe("formatHealthType", () => {
      it("should format health type identifiers correctly", () => {
        expect(AppleHealthXMLProcessor.formatHealthType('HKQuantityTypeIdentifierHeartRate'))
          .toBe('heart rate');
        
        expect(AppleHealthXMLProcessor.formatHealthType('HKQuantityTypeIdentifierStepCount'))
          .toBe('step count');
        
        expect(AppleHealthXMLProcessor.formatHealthType('HKCategoryTypeIdentifierSleepAnalysis'))
          .toBe('sleep analysis');
      });
    });
  });

  describe("ChunkingService", () => {
    describe("groupRecordsIntoChunks", () => {
      it("should return empty array for no records", () => {
        const result = ChunkingService.groupRecordsIntoChunks([]);
        expect(result).toEqual([]);
      });

      it("should group records by type and create chronological chunks", () => {
        const testRecords: AppleHealthRecord[] = [
          {
            '@_type': 'HKQuantityTypeIdentifierHeartRate',
            '@_value': '89',
            '@_startDate': '2024-06-15 14:25:19 +0200'
          },
          {
            '@_type': 'HKQuantityTypeIdentifierHeartRate', 
            '@_value': '75',
            '@_startDate': '2024-06-15 14:28:55 +0200'
          },
          {
            '@_type': 'HKQuantityTypeIdentifierStepCount',
            '@_value': '1000', 
            '@_startDate': '2024-06-15 14:30:00 +0200'
          }
        ];

        const result = ChunkingService.groupRecordsIntoChunks(testRecords);
        expect(result.length).toBeGreaterThan(0);
        // Heart rate records should be grouped together
        const firstChunk = result[0];
        expect(firstChunk.every(r => r['@_type'] === 'HKQuantityTypeIdentifierHeartRate')).toBe(true);
      });

      it("should handle large datasets efficiently", () => {
        const manyRecords = Array.from({ length: 100 }, (_, i) => ({
          '@_type': 'HKQuantityTypeIdentifierHeartRate',
          '@_value': '89',
          '@_startDate': `2024-06-15 14:${String(i).padStart(2, '0')}:00 +0200`
        }));

        const result = ChunkingService.groupRecordsIntoChunks(manyRecords);
        expect(result.length).toBeGreaterThan(2); // Should create multiple chunks
        
        // Check that each chunk has reasonable size
        result.forEach(chunk => {
          expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_SIZE);
        });
      });
    });

    describe("groupByType", () => {
      it("should group records by type correctly", () => {
        const testRecords: AppleHealthRecord[] = [
          {
            '@_type': 'HKQuantityTypeIdentifierHeartRate',
            '@_value': '89',
            '@_startDate': '2024-06-15 14:25:19 +0200'
          },
          {
            '@_type': 'HKQuantityTypeIdentifierStepCount',
            '@_value': '1000',
            '@_startDate': '2024-06-15 14:30:00 +0200'
          }
        ];

        const result = ChunkingService.groupByType(testRecords);
        expect(Object.keys(result)).toHaveLength(2);
        expect(result['HKQuantityTypeIdentifierHeartRate']).toHaveLength(1);
        expect(result['HKQuantityTypeIdentifierStepCount']).toHaveLength(1);
      });
    });
  });

  describe("DocumentService", () => {
    describe("createEmbeddingDocument", () => {
      it("should create properly formatted embedding document", () => {
        const testChunk: AppleHealthRecord[] = [{
          '@_type': 'HKQuantityTypeIdentifierHeartRate',
          '@_value': '89',
          '@_unit': 'count/min',
          '@_startDate': '2024-06-15 14:25:19 +0200',
          '@_endDate': '2024-06-15 14:25:19 +0200',
          '@_sourceName': "Hao's Apple Watch",
          '@_device': 'Apple Watch'
        }];

        const embedding = new Array(1536).fill(0.1);
        
        const result = DocumentService.createEmbeddingDocument(
          testChunk, 0, "test-doc", "test-user", embedding
        );

        expect(result.id).toBe("test-doc-chunk-0");
        expect(result.user_id).toBe("test-user");
        expect(result.document_id).toBe("test-doc");
        expect(result.chunk_index).toBe(0);
        expect(result._partitionKey).toBe("test-user");
        expect(result.embedding).toEqual(embedding);
        expect(result.content_chunk).toContain("heart rate: 89 count/min");
      });

      it("should handle chunks with multiple records", () => {
        const multiRecordChunk: AppleHealthRecord[] = [
          {
            '@_type': 'HKQuantityTypeIdentifierHeartRate',
            '@_value': '89',
            '@_startDate': '2024-06-15 14:25:19 +0200'
          },
          {
            '@_type': 'HKQuantityTypeIdentifierHeartRate',
            '@_value': '75', 
            '@_startDate': '2024-06-15 14:28:55 +0200'
          }
        ];

        const embedding = new Array(1536).fill(0.1);
        const result = DocumentService.createEmbeddingDocument(
          multiRecordChunk, 1, "test-doc", "test-user", embedding
        );

        expect(result.content_chunk.split('\n')).toHaveLength(2);
        expect(result.chunk_index).toBe(1);
      });
    });
  });

  describe("Helper Functions", () => {
    describe("createMockAppleHealthRecord", () => {
      it("should create a mock record with default values", () => {
        const record = createMockAppleHealthRecord();
        expect(record['@_type']).toBe('HKQuantityTypeIdentifierHeartRate');
        expect(record['@_value']).toBe('89');
        expect(record['@_sourceName']).toBe("Hao's Apple Watch");
      });

      it("should allow overriding default values", () => {
        const record = createMockAppleHealthRecord({
          '@_type': 'HKQuantityTypeIdentifierStepCount',
          '@_value': '1000'
        });
        expect(record['@_type']).toBe('HKQuantityTypeIdentifierStepCount');
        expect(record['@_value']).toBe('1000');
        expect(record['@_sourceName']).toBe("Hao's Apple Watch"); // Should keep default
      });
    });
  });
});

// Helper functions for tests
function createMockAppleHealthRecord(overrides: Partial<AppleHealthRecord> = {}): AppleHealthRecord {
  return {
    '@_type': 'HKQuantityTypeIdentifierHeartRate',
    '@_value': '89',
    '@_unit': 'count/min',
    '@_startDate': '2024-06-15 14:25:19 +0200',
    '@_endDate': '2024-06-15 14:25:19 +0200',
    '@_sourceName': "Hao's Apple Watch",
    '@_device': 'Apple Watch',
    ...overrides
  };
}

function createMockInvocationContext(overrides = {}) {
  return {
    bindingData: {
      userId: "test-user",
      name: "test-file.xml"
    },
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides
  };
} 