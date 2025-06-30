#!/bin/bash

# Health Monitor Azure Container Apps Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Health Monitor Azure Container Apps Deployment${NC}"
echo "================================================="

# Configuration
IMAGE_NAME="health-monitor"
CONTAINER_REGISTRY="aivital-bdaghdbefgg7eafv.azurecr.io"
RESOURCE_GROUP="rg-health-monitor"
CONTAINER_APP_NAME="health-monitor-app"
CONTAINER_ENV_NAME="health-monitor-env"
LOCATION="eastus"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Function to generate random secrets
generate_secret() {
    openssl rand -base64 32
}

# Function to check Azure login
check_azure_login() {
    if ! az account show &>/dev/null; then
        echo -e "${YELLOW}Not logged into Azure. Please login:${NC}"
        az login
    fi
    echo -e "${GREEN}Azure CLI logged in successfully${NC}"
}

# Function to load configuration
load_config() {
    if [ -f "azure-config.env" ]; then
        source azure-config.env
        echo -e "${GREEN}Loaded configuration from azure-config.env${NC}"
    else
        echo -e "${YELLOW}azure-config.env not found. Creating from template...${NC}"
        create_azure_config
    fi
    
    # Validate required variables
    if [ -z "$CONTAINER_REGISTRY" ] || [ -z "$RESOURCE_GROUP" ]; then
        echo -e "${RED}Error: CONTAINER_REGISTRY and RESOURCE_GROUP must be set in azure-config.env${NC}"
        exit 1
    fi
}

# Function to create Azure configuration
create_azure_config() {
    cat > azure-config.env << EOF
# Azure Container Apps Configuration
CONTAINER_REGISTRY=your-registry.azurecr.io
RESOURCE_GROUP=health-monitor-rg
CONTAINER_APP_NAME=health-monitor-app
CONTAINER_ENV_NAME=health-monitor-env
LOCATION=eastus

# Optional: Subscription ID (uses default if not set)
# SUBSCRIPTION_ID=your-subscription-id
EOF
    echo -e "${GREEN}Created azure-config.env. Please update with your Azure settings.${NC}"
    exit 1
}

# Function to setup environment files
setup_env_files() {
    # Setup local environment for testing
    if [ ! -f ".env.local" ]; then
        echo -e "${YELLOW}Creating .env.local for local testing...${NC}"
        if [ -f "env.production.example" ]; then
            cp env.production.example .env.local
            
            # Generate random secrets for local testing
            JWT_SECRET=$(generate_secret)
            ENCRYPTION_KEY=$(generate_secret)
            
            sed -i.bak "s/your-jwt-secret-key-here-make-it-long-and-random/$JWT_SECRET/" .env.local
            sed -i.bak "s/your-encryption-key-for-sensitive-data/$ENCRYPTION_KEY/" .env.local
            sed -i.bak "s/NODE_ENV=production/NODE_ENV=development/" .env.local
            
            echo -e "${GREEN}Created .env.local for local testing${NC}"
        fi
    fi
    
    # Setup production environment for Azure
    if [ ! -f ".env.production" ]; then
        echo -e "${YELLOW}Creating .env.production for Azure deployment...${NC}"
        if [ -f "env.production.example" ]; then
            cp env.production.example .env.production
            
            # Generate random secrets for production
            JWT_SECRET=$(generate_secret)
            ENCRYPTION_KEY=$(generate_secret)
            
            sed -i.bak "s/your-jwt-secret-key-here-make-it-long-and-random/$JWT_SECRET/" .env.production
            sed -i.bak "s/your-encryption-key-for-sensitive-data/$ENCRYPTION_KEY/" .env.production
            
            echo -e "${GREEN}Created .env.production with generated secrets${NC}"
            echo -e "${YELLOW}Please update .env.production with your actual Azure credentials${NC}"
        fi
    fi
}

# Function to build Docker image
build_image() {
    echo -e "${GREEN}Building Docker image: $IMAGE_NAME${NC}"
    docker build -t $IMAGE_NAME:latest .
    echo -e "${GREEN}Docker image built successfully${NC}"
}

# Function to test locally
test_local() {
    echo -e "${GREEN}Testing application locally...${NC}"
    
    # Stop any existing container
    docker stop health-monitor-test 2>/dev/null || true
    docker rm health-monitor-test 2>/dev/null || true
    
    # Run container for testing
    docker run -d \
        --name health-monitor-test \
        --env-file .env.local \
        -p 3001:3001 \
        $IMAGE_NAME:latest
    
    echo -e "${GREEN}Container started for testing${NC}"
    echo "Frontend: http://localhost:3001"
    echo "Backend API: http://localhost:3001/api"
    echo "Health Check: http://localhost:3001/health"
    
    # Wait for application to start
    echo -e "${YELLOW}Waiting for application to start...${NC}"
    sleep 10
    
    # Test health endpoint
    if curl -f http://localhost:3001/health &>/dev/null; then
        echo -e "${GREEN}✓ Health check passed${NC}"
    else
        echo -e "${RED}✗ Health check failed${NC}"
        echo "Check logs with: docker logs health-monitor-test"
        return 1
    fi
    
    echo -e "${GREEN}Local testing completed successfully${NC}"
}

# Function to stop local test
stop_local() {
    echo -e "${YELLOW}Stopping local test container...${NC}"
    docker stop health-monitor-test 2>/dev/null || true
    docker rm health-monitor-test 2>/dev/null || true
    echo -e "${GREEN}Local test container stopped${NC}"
}

# Function to setup Azure Container Registry
setup_acr() {
    echo -e "${GREEN}Setting up Azure Container Registry...${NC}"
    
    # Check if registry exists
    if ! az acr show --name $(echo $CONTAINER_REGISTRY | cut -d'.' -f1) --resource-group $RESOURCE_GROUP &>/dev/null; then
        echo -e "${YELLOW}Creating Container Registry...${NC}"
        az acr create \
            --name $(echo $CONTAINER_REGISTRY | cut -d'.' -f1) \
            --resource-group $RESOURCE_GROUP \
            --sku Basic \
            --admin-enabled true
    fi
    
    # Login to registry
    az acr login --name $(echo $CONTAINER_REGISTRY | cut -d'.' -f1)
    echo -e "${GREEN}Logged into Container Registry${NC}"
}

# Function to push image to Azure Container Registry
push_image() {
    echo -e "${GREEN}Pushing image to Azure Container Registry...${NC}"
    
    # Tag image for registry
    FULL_IMAGE_NAME="$CONTAINER_REGISTRY/$IMAGE_NAME:latest"
    docker tag $IMAGE_NAME:latest $FULL_IMAGE_NAME
    
    # Push image
    docker push $FULL_IMAGE_NAME
    echo -e "${GREEN}Image pushed successfully: $FULL_IMAGE_NAME${NC}"
}

# Function to create Azure Container App Environment
create_container_env() {
    echo -e "${GREEN}Creating Container Apps Environment...${NC}"
    
    # Check if environment exists
    if ! az containerapp env show --name $CONTAINER_ENV_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
        az containerapp env create \
            --name $CONTAINER_ENV_NAME \
            --resource-group $RESOURCE_GROUP \
            --location $LOCATION
        echo -e "${GREEN}Container Apps Environment created${NC}"
    else
        echo -e "${YELLOW}Container Apps Environment already exists${NC}"
    fi
}

# Function to deploy to Azure Container Apps
deploy_azure() {
    echo -e "${GREEN}Deploying to Azure Container Apps...${NC}"
    
    FULL_IMAGE_NAME="$CONTAINER_REGISTRY/$IMAGE_NAME:latest"
    
    # Get registry credentials
    REGISTRY_SERVER=$(echo $CONTAINER_REGISTRY)
    REGISTRY_USERNAME=$(az acr credential show --name $(echo $CONTAINER_REGISTRY | cut -d'.' -f1) --query username -o tsv)
    REGISTRY_PASSWORD=$(az acr credential show --name $(echo $CONTAINER_REGISTRY | cut -d'.' -f1) --query passwords[0].value -o tsv)
    
    # Create or update container app
    if az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
        echo -e "${YELLOW}Updating existing Container App...${NC}"
        az containerapp update \
            --name $CONTAINER_APP_NAME \
            --resource-group $RESOURCE_GROUP \
            --image $FULL_IMAGE_NAME
    else
        echo -e "${YELLOW}Creating new Container App...${NC}"
        az containerapp create \
            --name $CONTAINER_APP_NAME \
            --resource-group $RESOURCE_GROUP \
            --environment $CONTAINER_ENV_NAME \
            --image $FULL_IMAGE_NAME \
            --registry-server $REGISTRY_SERVER \
            --registry-username $REGISTRY_USERNAME \
            --registry-password $REGISTRY_PASSWORD \
            --target-port 3001 \
            --ingress external \
            --min-replicas 1 \
            --max-replicas 3 \
            --cpu 1.0 \
            --memory 2Gi \
            --env-vars NODE_ENV=production
    fi
    
    # Get the application URL
    APP_URL=$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
    echo -e "${GREEN}Deployment completed!${NC}"
    echo -e "${BLUE}Application URL: https://$APP_URL${NC}"
}

# Function to update environment variables
update_env_vars() {
    echo -e "${GREEN}Updating environment variables...${NC}"
    
    if [ ! -f ".env.production" ]; then
        echo -e "${RED}Error: .env.production file not found${NC}"
        exit 1
    fi
    
    # Convert .env.production to Azure Container Apps format
    ENV_VARS=""
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ $key =~ ^[[:space:]]*# ]] || [[ -z $key ]]; then
            continue
        fi
        # Remove quotes from value
        value=$(echo $value | sed 's/^"//' | sed 's/"$//')
        ENV_VARS="$ENV_VARS $key=$value"
    done < .env.production
    
    # Update container app with environment variables
    az containerapp update \
        --name $CONTAINER_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --set-env-vars $ENV_VARS
    
    echo -e "${GREEN}Environment variables updated${NC}"
}

# Function to show logs
show_logs() {
    echo -e "${GREEN}Showing Azure Container App logs...${NC}"
    az containerapp logs show \
        --name $CONTAINER_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --follow
}

# Function to show status
show_status() {
    echo -e "${GREEN}Container App Status:${NC}"
    az containerapp show \
        --name $CONTAINER_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --query "{name:name,status:properties.runningStatus,url:properties.configuration.ingress.fqdn,replicas:properties.template.scale}" \
        --output table
}

# Main menu
case "$1" in
    "setup")
        load_config
        setup_env_files
        ;;
    "build")
        build_image
        ;;
    "test")
        build_image
        test_local
        echo -e "${YELLOW}Test container is running. Press Enter to stop and continue...${NC}"
        read
        stop_local
        ;;
    "push")
        load_config
        check_azure_login
        setup_acr
        push_image
        ;;
    "deploy")
        load_config
        check_azure_login
        build_image
        setup_acr
        push_image
        create_container_env
        deploy_azure
        ;;
    "update-env")
        load_config
        check_azure_login
        update_env_vars
        ;;
    "logs")
        load_config
        check_azure_login
        show_logs
        ;;
    "status")
        load_config
        check_azure_login
        show_status
        ;;
    "clean")
        echo -e "${YELLOW}Cleaning up local Docker resources...${NC}"
        stop_local
        docker image rm $IMAGE_NAME:latest 2>/dev/null || true
        docker system prune -f
        echo -e "${GREEN}Cleanup completed${NC}"
        ;;
    *)
        echo "Usage: $0 {setup|build|test|push|deploy|update-env|logs|status|clean}"
        echo ""
        echo "Commands:"
        echo "  setup      - Setup configuration and environment files"
        echo "  build      - Build the Docker image"
        echo "  test       - Build and test locally (interactive)"
        echo "  push       - Push image to Azure Container Registry"
        echo "  deploy     - Full deployment to Azure Container Apps"
        echo "  update-env - Update environment variables in Azure"
        echo "  logs       - Show Azure Container App logs"
        echo "  status     - Show Azure Container App status"
        echo "  clean      - Clean up local Docker resources"
        echo ""
        echo "Typical workflow:"
        echo "  1. ./deploy-azure.sh setup"
        echo "  2. Edit azure-config.env and .env.production"
        echo "  3. ./deploy-azure.sh test"
        echo "  4. ./deploy-azure.sh deploy"
        exit 1
        ;;
esac 