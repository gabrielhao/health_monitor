// Load environment variables first
import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

// Import services
import { initializeUploadService } from './services/upload/index.js'
import { initializeProcessingService } from './services/processing/index.js'
import { azureCosmosService } from './shared/services/azureCosmosService.js'

// Import routes
import uploadRoutes from './services/upload/routes/upload.js'
import processingRoutes from './services/processing/routes/processing.js'

const app = express()
const port = process.env.PORT || 3001

// Security middleware
app.use(helmet())

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'backend-service',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        upload: 'active',
        processing: 'active'
      }
    }
  })
})

// Service routes
app.use('/api/upload', uploadRoutes)
app.use('/api/processing', processingRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  })
})

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error)
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  })
})

// Initialize services and start server
async function startServer() {
  try {
    console.log('Initializing backend services...')
    
    // Initialize Cosmos DB service
    await azureCosmosService.initialize()
    console.log('Cosmos DB service initialized')
    
    // Initialize services
    initializeUploadService()
    await initializeProcessingService()
    
    console.log('All services initialized successfully')
    
    // Start server
    app.listen(port, () => {
      console.log(`Backend service running on port ${port}`)
      console.log(`Health check: http://localhost:${port}/health`)
      console.log(`Upload API: http://localhost:${port}/api/upload`)
      console.log(`Processing API: http://localhost:${port}/api/processing`)
    })
    
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  process.exit(0)
})

// Start the server
startServer() 