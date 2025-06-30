# Azure Container Apps Quick Start

Deploy your Health Monitor application to Azure Container Apps in minutes.

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- Docker installed
- Azure subscription

## 🚀 Quick Deployment

### 1. Setup Configuration
```bash
./deploy-azure.sh setup
```
This creates:
- `azure-config.env` - Azure resource configuration
- `.env.local` - Local testing environment
- `.env.production` - Production environment variables

### 2. Configure Azure Resources
Edit `azure-config.env`:
```bash
CONTAINER_REGISTRY=your-registry.azurecr.io
RESOURCE_GROUP=health-monitor-rg
CONTAINER_APP_NAME=health-monitor-app
CONTAINER_ENV_NAME=health-monitor-env
LOCATION=eastus
```

### 3. Configure Application Settings
Edit `.env.production` with your Azure credentials:
```bash
# Required Azure settings
AZURE_COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443/
AZURE_COSMOS_KEY=your-cosmos-key
AZURE_OPENAI_ENDPOINT=your-openai-endpoint
AZURE_OPENAI_KEY=your-openai-key
# ... other settings
```

### 4. Test Locally
```bash
./deploy-azure.sh test
```
- Builds Docker image
- Runs container locally on port 3001
- Tests health endpoint
- Interactive - press Enter to stop

### 5. Deploy to Azure
```bash
./deploy-azure.sh deploy
```
This will:
- Login to Azure (if needed)
- Create Azure Container Registry
- Build and push Docker image
- Create Container Apps environment
- Deploy your application
- Provide your application URL

## 📋 Common Commands

```bash
# View application status
./deploy-azure.sh status

# View live logs
./deploy-azure.sh logs

# Update environment variables
./deploy-azure.sh update-env

# Clean up local resources
./deploy-azure.sh clean
```

## 🌐 Accessing Your Application

After successful deployment, your application will be available at:
```
https://your-app-name.region.azurecontainerapps.io
```

The deployment script will display the exact URL at the end.

## 🔧 Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `AZURE_COSMOS_ENDPOINT` | Cosmos DB endpoint URL |
| `AZURE_COSMOS_KEY` | Cosmos DB primary key |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI service endpoint |
| `AZURE_OPENAI_KEY` | Azure OpenAI API key |
| `VITE_AZURE_CLIENT_ID` | Entra External ID client ID |
| `VITE_AZURE_TENANT_ID` | Entra External ID tenant ID |

### Auto-Generated Variables

These are automatically generated with secure random values:
- `JWT_SECRET` - JWT signing secret
- `ENCRYPTION_KEY` - Data encryption key

## 🔒 Security Features

✅ **Container Security**
- Non-root user execution
- Multi-stage build (no build dependencies in final image)
- Minimal Alpine Linux base image

✅ **Azure Security**
- Automatic HTTPS certificates
- Environment variables stored securely
- Container Registry with admin access
- Network isolation

✅ **Application Security**
- CORS protection
- Rate limiting
- Security headers (Helmet.js)
- Input validation

## 📊 Monitoring

Azure Container Apps provides built-in:
- **Health checks** - Automatic monitoring
- **Logs** - View with `./deploy-azure.sh logs`
- **Metrics** - CPU, memory, request count
- **Auto-scaling** - Based on traffic and resource usage

## 🔄 Updates

To update your application:
```bash
git pull
./deploy-azure.sh deploy
```

The script will:
1. Build new image with latest code
2. Push to registry
3. Update Container App with new image
4. Maintain zero downtime during deployment

## 🐛 Troubleshooting

### Deployment Issues
```bash
# Check Azure CLI login
az account show

# Verify resource group exists
az group show --name health-monitor-rg

# Check Container App status
./deploy-azure.sh status
```

### Application Issues
```bash
# View real-time logs
./deploy-azure.sh logs

# Test health endpoint
curl https://your-app.azurecontainerapps.io/health

# Check environment variables
az containerapp show --name health-monitor-app --resource-group health-monitor-rg
```

### Local Testing Issues
```bash
# Test locally first
./deploy-azure.sh test

# Check Docker logs
docker logs health-monitor-test

# Verify environment file
cat .env.local
```

## 💰 Cost Optimization

Azure Container Apps pricing is based on:
- **vCPU usage** - $0.000024 per vCPU second
- **Memory usage** - $0.0000025 per GiB second
- **Requests** - First 2 million free per month

For development/testing:
- Use minimum replicas (1)
- Set appropriate resource limits
- Use consumption pricing model

## 📚 Next Steps

1. **Custom Domain** - Configure your own domain
2. **CI/CD** - Set up GitHub Actions for automatic deployment
3. **Monitoring** - Configure Application Insights
4. **Scaling** - Adjust scaling rules based on usage
5. **Backup** - Configure Cosmos DB backup policies

## 🆘 Support

- **Azure Container Apps**: [Microsoft Documentation](https://docs.microsoft.com/en-us/azure/container-apps/)
- **Issues**: Check logs with `./deploy-azure.sh logs`
- **Configuration**: Verify `azure-config.env` and `.env.production` 