# Docker Architecture - Separate Frontend and Backend Services

This document describes the Docker architecture with separate frontend and backend Dockerfiles for better organization and maintainability.

## Architecture Overview

The application is split into two separate Docker services with dedicated Dockerfiles:

1. **Frontend Service** - Vue.js application served on port 5173 (`Dockerfile.frontend`)
2. **Backend Service** - Node.js API service running internally on port 3001 (`Dockerfile.backend`)

## Dockerfile Structure

### Frontend Dockerfile (`Dockerfile.frontend`)
- **Build Stage**: Compiles Vue.js application with Vite
- **Production Stage**: Serves the built application using Vite preview
- **Port**: 5173 (exposed externally)
- **Purpose**: Serves the Vue.js frontend application

### Backend Dockerfile (`Dockerfile.backend`)
- **Build Stage**: Compiles TypeScript backend code
- **Production Stage**: Runs the Node.js API service
- **Port**: 3001 (internal only, not exposed)
- **Purpose**: Provides API endpoints for the application

## Benefits of This Architecture

- **Security**: Backend API is not exposed externally, only accessible through internal Docker network
- **Scalability**: Frontend and backend can be scaled independently
- **Maintenance**: Easier to update and maintain each service separately
- **Development**: Better separation of concerns
- **Build Optimization**: Each service has its own optimized build process
- **Deployment Flexibility**: Can deploy frontend and backend to different environments

## Running the Application

### Using Docker Compose (Recommended)

```bash
# Start both services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Building Services Individually

```bash
# Build frontend only
docker build -f Dockerfile.frontend -t health-monitor-frontend .

# Build backend only
docker build -f Dockerfile.backend -t health-monitor-backend .

# Run frontend container
docker run -d -p 5173:5173 --name frontend health-monitor-frontend

# Run backend container (internal only)
docker run -d --name backend health-monitor-backend
```

### Development Mode

```bash
# Start development service (frontend only with hot reload)
docker-compose --profile dev up health-monitor-dev
```

## Network Communication

The frontend service communicates with the backend service using the Docker network:

- **Frontend → Backend**: `http://backend:3001/api`
- **External → Frontend**: `http://localhost:5173`
- **Backend**: Not accessible from outside the Docker network

## Environment Variables

### Frontend Service
```env
NODE_ENV=production
PORT=5173
VITE_BACKEND_SERVICE_URL=http://backend:3001/api
```

### Backend Service
```env
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://frontend:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Health Checks

Both services include health checks:

- **Frontend**: Checks if the application is responding on port 5173
- **Backend**: Checks the `/health` endpoint on port 3001

## Security Considerations

1. **Backend Isolation**: The backend service is not exposed externally
2. **CORS Configuration**: Backend only accepts requests from allowed origins
3. **Non-root User**: Both services run as non-root users for security
4. **Rate Limiting**: Backend includes rate limiting to prevent abuse

## File Structure

```
health_monitor/
├── Dockerfile.frontend          # Frontend service Dockerfile
├── Dockerfile.backend           # Backend service Dockerfile
├── Dockerfile.combined          # Legacy combined Dockerfile (for reference)
├── docker-compose.yml           # Docker Compose configuration
├── package.json                 # Frontend dependencies
├── backend-service/
│   ├── package.json            # Backend dependencies
│   └── src/                    # Backend source code
└── src/                        # Frontend source code
```

## Troubleshooting

### Frontend Can't Connect to Backend
- Ensure both services are running: `docker-compose ps`
- Check backend logs: `docker-compose logs backend`
- Verify network connectivity: `docker-compose exec frontend ping backend`

### Port Conflicts
- Frontend port 5173 must be available on the host
- Backend port 3001 is internal only and won't conflict

### Environment Variables
- Ensure `.env` file is present for backend configuration
- Check that `VITE_BACKEND_SERVICE_URL` is set correctly in frontend service

### Build Issues
- Clear Docker cache: `docker system prune -a`
- Rebuild specific service: `docker-compose build --no-cache frontend`

## Migration from Combined Dockerfile

If you're migrating from the previous combined Dockerfile:

1. The original `Dockerfile` has been renamed to `Dockerfile.combined` for reference
2. Use `Dockerfile.frontend` and `Dockerfile.backend` for new deployments
3. Update your CI/CD pipelines to use the appropriate Dockerfile for each service
4. The frontend will now communicate with backend via `http://backend:3001/api`
5. Access the application via `http://localhost:5173` instead of port 3001

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Build Frontend
  run: docker build -f Dockerfile.frontend -t frontend:${{ github.sha }} .

- name: Build Backend
  run: docker build -f Dockerfile.backend -t backend:${{ github.sha }} .
```

### Docker Hub Example
```bash
# Tag and push frontend
docker tag health-monitor-frontend your-registry/frontend:latest
docker push your-registry/frontend:latest

# Tag and push backend
docker tag health-monitor-backend your-registry/backend:latest
docker push your-registry/backend:latest
``` 