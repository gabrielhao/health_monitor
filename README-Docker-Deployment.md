# Azure Container Apps Deployment Guide

This guide explains how to deploy the Health Monitor application to Azure Container Apps using a single Docker container that serves both the Vue.js frontend and Node.js backend.

## Overview

The Docker setup uses a multi-stage build approach:
1. **Frontend Build Stage**: Builds the Vue.js application using Vite
2. **Backend Build Stage**: Compiles the TypeScript backend to JavaScript
3. **Production Stage**: Combines both builds in a lightweight Node.js Alpine container

## Prerequisites

- Docker (version 20.10 or later)
- Azure CLI (version 2.37 or later)
- Azure subscription with Container Apps enabled
- OpenSSL (for generating secrets)

## Quick Start

1. **Clone and navigate to the project directory**
```bash
git clone <your-repo>
cd health_monitor
```

2. **Make the deployment script executable** (Linux/macOS)
```bash
chmod +x deploy-azure.sh
```

3. **Setup configuration**
```bash
./deploy-azure.sh setup
```

4. **Test locally**
```bash
./deploy-azure.sh test
```

5. **Deploy to Azure**
```bash
./deploy-azure.sh deploy
```

After deployment, your application will be available at your Azure Container Apps URL.

## Configuration

### Environment Variables

The application requires both backend and frontend environment variables. Copy the example file and configure your values:

```bash
cp env.production.example .env.production
```

#### Required Configuration Categories:

1. **Azure Storage** - For file uploads
2. **Azure Cosmos DB** - For data persistence
3. **Azure OpenAI** - For AI features
4. **Azure Entra ID** - For authentication
5. **Security Settings** - JWT secrets, encryption keys

#### Security Notes:

- The `.env.production` file is automatically excluded from Docker builds via `.dockerignore`
- JWT and encryption secrets are auto-generated if not provided
- All environment files are gitignored for security

### Frontend Environment Variables

Frontend variables must be prefixed with `VITE_` and are built into the application at build time:

```bash
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_BACKEND_SERVICE_URL=http://localhost:3001/api
```

### Backend Environment Variables

Backend variables are loaded at runtime:

```bash
AZURE_COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443/
AZURE_OPENAI_KEY=your-key
JWT_SECRET=your-generated-secret
```

## Deployment Commands

### Using the Azure Deploy Script

```bash
# Setup configuration and environment files
./deploy-azure.sh setup

# Build the Docker image
./deploy-azure.sh build

# Test locally before deploying
./deploy-azure.sh test

# Push image to Azure Container Registry
./deploy-azure.sh push

# Full deployment to Azure Container Apps
./deploy-azure.sh deploy

# Update environment variables
./deploy-azure.sh update-env

# Show Azure Container App logs
./deploy-azure.sh logs

# Show Azure Container App status
./deploy-azure.sh status

# Clean up local Docker resources
./deploy-azure.sh clean
```

### Manual Azure CLI Commands

**Build and push to Azure Container Registry:**
```bash
# Build image
docker build -t health-monitor:latest .

# Tag for registry
docker tag health-monitor:latest your-registry.azurecr.io/health-monitor:latest

# Push to registry
docker push your-registry.azurecr.io/health-monitor:latest
```

**Deploy to Azure Container Apps:**
```bash
# Create Container Apps environment
az containerapp env create \
  --name health-monitor-env \
  --resource-group health-monitor-rg \
  --location eastus

# Create Container App
az containerapp create \
  --name health-monitor-app \
  --resource-group health-monitor-rg \
  --environment health-monitor-env \
  --image your-registry.azurecr.io/health-monitor:latest \
  --target-port 3001 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3
```

## Architecture

### Container Structure

```
/app
├── dist/           # Compiled backend (Node.js)
├── public/         # Built frontend (static files)
├── logs/           # Application logs (mounted volume)
├── node_modules/   # Production dependencies only
└── package.json    # Backend package.json
```

### Port Configuration

- **Container Port**: 3001
- **Host Port**: 3001 (configurable)
- **Health Check**: Available at `/health`

### Static File Serving

The Express backend serves the Vue.js frontend:
- Static files served from `/app/public`
- SPA routing handled with catch-all route
- API routes under `/api/*` are preserved

### Azure Container Apps Features

- **Automatic HTTPS**: Provided by Azure
- **Auto-scaling**: 1-3 replicas based on demand
- **Health checks**: Built-in monitoring
- **Log streaming**: Integrated with Azure Monitor

## Security Features

### Container Security

- **Non-root user**: Application runs as user `appuser` (UID 1001)
- **Minimal base image**: Alpine Linux for reduced attack surface
- **Read-only filesystem**: Configurable for enhanced security
- **No new privileges**: Security option enabled
- **Dumb-init**: Proper signal handling for graceful shutdowns

### Environment Security

- **Multi-stage builds**: Secrets not included in final image
- **Dockerignore**: Sensitive files excluded from build context
- **Generated secrets**: Auto-generated JWT and encryption keys
- **Production hardening**: Security headers via Helmet.js

### Network Security

- **CORS configuration**: Restricted origins
- **Rate limiting**: Configurable request limits
- **Helmet.js**: Security headers for common vulnerabilities

## Monitoring and Maintenance

### Health Checks

The container includes a built-in health check:
```bash
# Manual health check
curl http://localhost:3001/health
```

### Logs

View application logs:
```bash
# Follow logs
docker logs -f health-monitor

# Or using the script
./deploy.sh logs
```

### Updates

To update the application:
```bash
# Pull latest code
git pull

# Redeploy to Azure
./deploy-azure.sh deploy
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using port 3001
   lsof -i :3001
   
   # Stop conflicting services or change port in .env.production
   ```

2. **Environment variables not loaded**
   ```bash
   # Verify .env.production exists and has correct values
   cat .env.production
   
   # Update environment variables in Azure
   ./deploy-azure.sh update-env
   ```

3. **Azure Container App not starting**
   ```bash
   # Check Container App status
   ./deploy-azure.sh status
   
   # View logs
   ./deploy-azure.sh logs
   ```

4. **Database connection issues**
   ```bash
   # Check environment variables in Azure
   az containerapp show --name health-monitor-app --resource-group health-monitor-rg
   
   # Test health endpoint (replace with your Azure URL)
   curl https://your-app.azurecontainerapps.io/health
   ```

### Debug Mode

For local debugging:
```bash
# Test locally with debug output
docker run -it --rm \
  --env-file .env.local \
  -e DEBUG=* \
  -p 3001:3001 \
  health-monitor:latest
```

For Azure debugging:
```bash
# View real-time logs
./deploy-azure.sh logs

# Check Container App details
az containerapp show --name health-monitor-app --resource-group health-monitor-rg
```

## Production Considerations

### Custom Domain

Configure a custom domain for your Container App:

```bash
# Add custom domain
az containerapp hostname add \
  --name health-monitor-app \
  --resource-group health-monitor-rg \
  --hostname your-domain.com
```

### SSL/TLS

Azure Container Apps automatically provides:
- Automatic HTTPS certificates
- TLS termination
- HTTP to HTTPS redirects

### Scaling

Azure Container Apps automatically scales based on:
- HTTP traffic
- CPU usage
- Memory usage
- Custom metrics

Configure scaling rules:
```bash
az containerapp update \
  --name health-monitor-app \
  --resource-group health-monitor-rg \
  --min-replicas 2 \
  --max-replicas 10
```

### Backup

Important data to backup:
- Azure Cosmos DB data (handled by Azure)
- Application logs (if persistent storage required)
- Environment configuration files

## Support

For issues specific to Azure Container Apps deployment, check:
1. Container App logs: `./deploy-azure.sh logs`
2. Application status: `./deploy-azure.sh status`
3. Environment configuration: Verify `.env.production` and `azure-config.env`
4. Network connectivity: Test health endpoint at your Azure URL

### Useful Azure CLI Commands

```bash
# List all Container Apps
az containerapp list --resource-group health-monitor-rg --output table

# Get Container App URL
az containerapp show --name health-monitor-app --resource-group health-monitor-rg --query properties.configuration.ingress.fqdn

# View Container App metrics
az monitor metrics list --resource health-monitor-app --resource-group health-monitor-rg --resource-type Microsoft.App/containerApps

# Scale Container App manually
az containerapp replica list --name health-monitor-app --resource-group health-monitor-rg
``` 