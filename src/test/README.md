# Test Suite Documentation

This directory contains comprehensive unit tests and integration tests for the Aivital health monitoring application.

## Test Structure

```
src/test/
├── components/           # Component tests
├── composables/         # Composable function tests
├── integration/         # Integration tests
├── mocks/              # Mock utilities and data
├── services/           # Service layer tests
├── stores/             # Pinia store tests
├── utils/              # Test helper utilities
├── setup.ts            # Global test setup
└── README.md           # This file
```

## Test Categories

### Unit Tests
- **Components**: Vue component rendering, props, events, and user interactions
- **Composables**: Business logic, state management, and side effects
- **Services**: API calls, data processing, and external integrations
- **Stores**: Pinia store actions, mutations, and computed properties

### Integration Tests
- **File Upload Flow**: End-to-end file upload with chunking and processing
- **Health Data Management**: Complete CRUD operations for health metrics
- **Authentication Flow**: Sign up, sign in, profile management

## Coverage Requirements

- **Minimum Coverage**: 80% across all metrics (lines, functions, branches, statements)
- **Critical Components**: 85-90% coverage for core services and stores
- **Test Reports**: Generated in HTML, JSON, and LCOV formats

## Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Run tests with UI
npm run test:ui
```

## Test Patterns

### Arrange-Act-Assert Pattern
All tests follow the AAA pattern:

```typescript
it('should handle successful file upload', async () => {
  // Arrange
  const mockFile = createMockFile({ size: 1024 * 1024 })
  const mockUploadService = vi.fn().mockResolvedValue('file-path')
  
  // Act
  const result = await uploadFile(mockFile)
  
  // Assert
  expect(result).toBe('file-path')
  expect(mockUploadService).toHaveBeenCalledWith(mockFile)
})
```

### Mock Strategy
- **External Dependencies**: All external services (Supabase, APIs) are mocked
- **Browser APIs**: FileReader, crypto, DOMParser are mocked for consistency
- **Store Dependencies**: Pinia stores are mocked in component tests

### Test Data
- **Mock Factories**: Consistent mock data creation using factory functions
- **Realistic Data**: Mock data reflects real-world scenarios and edge cases
- **Boundary Testing**: Tests include minimum, maximum, and invalid values

## Key Test Scenarios

### File Upload Tests
- ✅ Small file upload (< 100MB)
- ✅ Large file upload with chunking (> 100MB)
- ✅ File size validation (5GB limit)
- ✅ File type validation (XML, JSON, CSV, ZIP)
- ✅ Upload progress tracking
- ✅ Error handling and retry logic
- ✅ Network failure scenarios
- ✅ Authentication requirements

### Health Data Tests
- ✅ CRUD operations for health metrics
- ✅ Data validation and constraints
- ✅ Metric type filtering
- ✅ Date range queries
- ✅ Real-time updates
- ✅ Error handling
- ✅ Authentication requirements

### Authentication Tests
- ✅ Sign up with email confirmation
- ✅ Sign in with credentials
- ✅ Password reset flow
- ✅ Profile management
- ✅ Session handling
- ✅ Error scenarios (invalid credentials, network issues)
- ✅ Security validations

### Memory and Performance Tests
- ✅ Large dataset handling (1000+ metrics)
- ✅ Memory leak prevention
- ✅ Component cleanup
- ✅ Efficient rendering
- ✅ Background processing

## Mock Utilities

### File Mocks
```typescript
const mockFile = createMockFile({
  name: 'health-data.xml',
  size: 10 * 1024 * 1024, // 10MB
  type: 'text/xml'
})
```

### User Mocks
```typescript
const mockUser = createMockUser({
  email: 'test@example.com'
})

const mockProfile = createMockProfile({
  full_name: 'Test User'
})
```

### Health Data Mocks
```typescript
const metrics = generateMetricSeries('heart_rate', 30) // 30 days of data
const bloodPressure = createMockBloodPressureMetric({
  systolic: 120,
  diastolic: 80
})
```

## Edge Cases Tested

### File Upload Edge Cases
- Empty files (0 bytes)
- Maximum size files (5GB)
- Invalid file types
- Corrupted files
- Network interruptions
- Server errors
- Authentication failures

### Data Validation Edge Cases
- Missing required fields
- Invalid data types
- Out-of-range values
- SQL injection attempts
- XSS prevention
- Unicode handling

### Performance Edge Cases
- Large datasets (1000+ records)
- Concurrent operations
- Memory constraints
- Slow network conditions
- Browser compatibility

## Continuous Integration

Tests are automatically run on:
- Pull request creation
- Code commits to main branch
- Scheduled daily runs
- Release builds

### CI Requirements
- All tests must pass
- Coverage must meet minimum thresholds
- No console errors or warnings
- Performance benchmarks must be met

## Debugging Tests

### Common Issues
1. **Async Test Failures**: Ensure proper `await` usage and promise handling
2. **Mock Leakage**: Clear mocks between tests using `vi.clearAllMocks()`
3. **DOM Cleanup**: Unmount components after tests to prevent memory leaks
4. **Timing Issues**: Use `vi.useFakeTimers()` for time-dependent tests

### Debug Commands
```bash
# Run specific test file
npm run test -- src/test/services/chunkUploadService.test.ts

# Run tests matching pattern
npm run test -- --grep "file upload"

# Debug with browser
npm run test:ui
```

## Contributing to Tests

### Adding New Tests
1. Follow existing file naming conventions
2. Use appropriate test categories (unit vs integration)
3. Include both happy path and error scenarios
4. Maintain minimum coverage requirements
5. Add documentation for complex test scenarios

### Test Review Checklist
- [ ] Tests follow AAA pattern
- [ ] All edge cases are covered
- [ ] Mocks are properly configured
- [ ] Async operations are handled correctly
- [ ] Tests are deterministic and reliable
- [ ] Coverage thresholds are met
- [ ] Performance implications are considered

## Test Data Management

### Sensitive Data
- No real user data in tests
- Use mock data generators
- Sanitize any production data samples
- Follow GDPR compliance in test data

### Test Database
- Tests use mocked Supabase client
- No real database connections
- Isolated test environment
- Consistent test data state

## Performance Testing

### Metrics Tracked
- Test execution time
- Memory usage during tests
- Component render performance
- File processing speed
- Network request efficiency

### Benchmarks
- Unit tests: < 100ms per test
- Integration tests: < 5s per test
- Total test suite: < 2 minutes
- Memory usage: < 512MB peak

This comprehensive test suite ensures the reliability, performance, and maintainability of the Aivital application while providing confidence in new feature development and refactoring efforts.