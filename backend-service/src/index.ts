// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

// Import services
import { initializeChatService } from './services/chat/index.js';
import { initializeEmbeddingService } from './services/embedding/index.js';
import { initializeHealthService } from './services/health/index.js';
import { initializeProcessingService } from './services/processing/index.js';
import { initializeUploadService } from './services/upload/index.js';
import { azureCosmosService } from './shared/services/azureCosmosService.js';

// Import routes
import chatRoutes from './services/chat/routes/chat.js';
import embeddingRoutes from './services/embedding/routes/embedding.js';
import healthRoutes from './services/health/routes/health.js';
import processingRoutes from './services/processing/routes/processing.js';
import uploadRoutes from './services/upload/routes/upload.js';

const app = express();
const port = process.env.PORT || 3001;

// Get current directory (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    }),
);

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
    },
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the frontend build
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

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
                processing: 'active',
                embedding: 'active',
                chat: 'active',
                health: 'active',
            },
        },
    });
});

// Service routes
app.use('/api/upload', uploadRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/embedding', embeddingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/health', healthRoutes);

// Catch-all handler: send back Vue.js frontend for any non-API routes
app.get('*', (req, res) => {
    // Only serve frontend for non-API routes
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(publicPath, 'index.html'));
    } else {
        res.status(404).json({
            success: false,
            error: 'API endpoint not found',
        });
    }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
});

// Initialize services and start server
async function startServer() {
    try {
        console.log('Initializing backend services...');

        // Initialize Cosmos DB service
        await azureCosmosService.initialize();
        console.log('Cosmos DB service initialized');

        // Initialize services
        initializeUploadService();
        await initializeProcessingService();
        await initializeEmbeddingService();
        await initializeChatService();
        initializeHealthService();

        console.log('All services initialized successfully');

        // Start server
        app.listen(port, () => {
            console.log(`Backend service running on port ${port}`);
            console.log(`Health check: http://localhost:${port}/health`);
            console.log(`Upload API: http://localhost:${port}/api/upload`);
            console.log(`Processing API: http://localhost:${port}/api/processing`);
            console.log(`Embedding API: http://localhost:${port}/api/embedding`);
            console.log(`Chat API: http://localhost:${port}/api/chat`);
            console.log(`Health Metrics API: http://localhost:${port}/api/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start the server
startServer();
