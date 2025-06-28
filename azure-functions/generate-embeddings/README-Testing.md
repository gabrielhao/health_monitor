# Azure Function Testing Guide

This document explains how to run unit tests for the `generate-embeddings` Azure Function.

## Setup

1. **Install dependencies** (this will resolve the linter errors you see):
   ```bash
   npm install
   ```

2. **Azure Functions Core Tools** (optional, only needed for running the function locally):
   ```bash
   # Install globally using npm
   npm install -g azure-functions-core-tools@4 --unsafe-perm true
   
   # Or using Homebrew on macOS
   brew tap azure/functions
   brew install azure-functions-core-tools@4
   ```

3. **Environment Setup**: The tests use mock environments, so no real Azure credentials are needed for testing.

## Running Tests

### Basic test run:
```bash
npm test
```

### Watch mode (automatically re-runs tests when files change):
```bash
npm run test:watch
```

### Generate coverage report:
```bash
npm run test:coverage
```

## Test Structure

The test suite covers all major functions and classes:

### ✅ Core Services Tested:
- **`validateEnvironment()`** - Environment variable validation
- **`EmbeddingService`** - Text embedding generation and chunk size calculation
- **`AppleHealthXMLProcessor`** - XML parsing and record formatting
- **`ChunkingService`** - Record grouping and chunking logic
- **`DocumentService`** - Document creation for Cosmos DB
- **Helper functions** - Mock data creation utilities

### 🔧 Test Features:
- **Mocked Dependencies**: Azure Cosmos DB and OpenAI services are mocked
- **Edge Cases**: Empty inputs, malformed data, missing environment variables
- **Type Safety**: Full TypeScript support with proper interfaces
- **Isolated Tests**: Each test is independent with proper setup/teardown

## Test Files

- **`index.test.ts`** - Main test suite
- **`test-utils.ts`** - Exported functions for testing (mirrors index.ts structure)

## Sample Test Output

When you run `npm test`, you should see output like:

```
 PASS  ./index.test.ts
  Azure Function - Generate Embeddings
    validateEnvironment
      ✓ should pass when all required environment variables are set
      ✓ should throw error when CosmosDbConnectionString is missing
      ✓ should throw error when Azure OpenAI variables are missing
    EmbeddingService
      generateEmbedding
        ✓ should throw error for empty text
        ✓ should throw error for text that's too long
      calculateOptimalChunkSize
        ✓ should return default size for empty records
        ✓ should calculate optimal size based on record length
    AppleHealthXMLProcessor
      parseXML
        ✓ should throw error for empty XML
        ✓ should parse valid Apple Health XML
        ✓ should throw error for invalid XML structure
      formatRecord
        ✓ should format health record correctly
        ✓ should handle missing optional fields
        ✓ should format different health types correctly
      formatHealthType
        ✓ should format health type identifiers correctly
    ChunkingService
      groupRecordsIntoChunks
        ✓ should return empty array for no records
        ✓ should group records by type and create chronological chunks
        ✓ should handle large datasets efficiently
      groupByType
        ✓ should group records by type correctly
    DocumentService
      createEmbeddingDocument
        ✓ should create properly formatted embedding document
        ✓ should handle chunks with multiple records
    Helper Functions
      createMockAppleHealthRecord
        ✓ should create a mock record with default values
        ✓ should allow overriding default values

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
```

## Notes

- **Linter Errors**: The TypeScript linter shows errors before `npm install` because Jest types aren't installed yet. This is normal.
- **Azure Dependencies**: Tests run without requiring actual Azure services - everything is mocked.
- **Apple Health Data**: Tests use realistic sample data matching the XML structure from Apple Health exports.

## Adding New Tests

To add tests for new functions:

1. Export the function in `test-utils.ts`
2. Add test cases in `index.test.ts`
3. Follow the existing pattern of mocking external dependencies

Example:
```typescript
describe("NewFunction", () => {
  it("should handle expected input", () => {
    const result = MyNewFunction("test input");
    expect(result).toBe("expected output");
  });
});
``` 