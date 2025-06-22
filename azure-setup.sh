#!/bin/bash

# Azure Health Monitor Setup Script
# This script will create all necessary Azure resources for the health monitor application

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
RESOURCE_GROUP="rg-health-monitor"
LOCATION="westeurope"
COSMOS_ACCOUNT_NAME="health-monitor-cosmos"
DATABASE_NAME="health-monitor-db"
STORAGE_ACCOUNT_NAME="healthmonitorst"
FUNCTION_APP_NAME="health-monitor-functions"
APP_NAME="health-monitor-app"
CONTAINER_NAME="health-files"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first:"
    echo "  brew install azure-cli"
    exit 1
fi

# Check if user is logged in
if ! az account show &> /dev/null; then
    print_warning "You are not logged into Azure. Please log in:"
    az login
fi

print_status "Starting Azure Health Monitor setup..."

# Register required Azure providers
print_status "Registering Azure providers..."
az provider register --namespace Microsoft.DocumentDB
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.OperationalInsights

print_status "Waiting for provider registration to complete..."
while [[ $(az provider show -n Microsoft.DocumentDB --query "registrationState" --output tsv) != "Registered" ]]; do
    sleep 10
    echo "  Waiting for Microsoft.DocumentDB registration..."
done
print_success "Azure providers registered successfully"

# Create resource group
print_status "Creating resource group: $RESOURCE_GROUP"
az group create \
    --name $RESOURCE_GROUP \
    --location $LOCATION \
    --output table

print_success "Resource group created successfully"

# Create Cosmos DB Account
print_status "Creating Azure Cosmos DB Account: $COSMOS_ACCOUNT_NAME"
az cosmosdb create \
    --name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=false \
    --kind GlobalDocumentDB \
    --default-consistency-level Session \
    --enable-automatic-failover true \
    --output table

print_success "Cosmos DB Account created successfully"

# Create Cosmos DB Database
print_status "Creating Cosmos DB Database: $DATABASE_NAME"
az cosmosdb sql database create \
    --account-name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --name $DATABASE_NAME \
    --output table

print_success "Cosmos DB Database created successfully"

# Create Cosmos DB Containers
print_status "Creating Cosmos DB containers..."

containers=(
    "health_documents:/user_id"
    "health_embeddings:/user_id"
    "import_sessions:/user_id"
    "data_sources:/user_id"
    "rag_documents:/user_id"
    "rag_chunks:/user_id"
    "rag_import_sessions:/user_id"
    "user_profiles:/id"
    "health_metrics:/user_id"
    "chat_messages:/user_id"
    "analytics_data:/user_id"
)

for container_info in "${containers[@]}"; do
    container_name="${container_info%%:*}"
    partition_key="${container_info##*:}"
    
    print_status "Creating container: $container_name with partition key: $partition_key"
    az cosmosdb sql container create \
        --account-name $COSMOS_ACCOUNT_NAME \
        --resource-group $RESOURCE_GROUP \
        --database-name $DATABASE_NAME \
        --name $container_name \
        --partition-key-path $partition_key \
        --throughput 400 \
        --output table
done

print_success "All Cosmos DB containers created successfully"

# Create Storage Account
print_status "Creating Azure Storage Account: $STORAGE_ACCOUNT_NAME"
az storage account create \
    --name $STORAGE_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku Standard_LRS \
    --output table

print_success "Storage Account created successfully"

# Create blob container
print_status "Creating blob container: $CONTAINER_NAME"
az storage container create \
    --name $CONTAINER_NAME \
    --account-name $STORAGE_ACCOUNT_NAME \
    --public-access off \
    --output table

print_success "Blob container created successfully"

# Create Function App
print_status "Creating Azure Function App: $FUNCTION_APP_NAME"
az functionapp create \
    --resource-group $RESOURCE_GROUP \
    --consumption-plan-location $LOCATION \
    --runtime node \
    --runtime-version 22 \
    --functions-version 4 \
    --name $FUNCTION_APP_NAME \
    --storage-account $STORAGE_ACCOUNT_NAME \
    --output table

print_success "Function App created successfully"

# Create Azure AD App Registration
print_status "Creating Azure AD App Registration"
AD_APP=$(az ad app create \
    --display-name "$APP_NAME" \
    --web-redirect-uris "http://localhost:5173" "https://$APP_NAME.azurewebsites.net" \
    --query "{appId:appId,tenantId:appId}" \
    --output json)

APP_ID=$(echo $AD_APP | jq -r '.appId')
TENANT_ID=$(az account show --query tenantId --output tsv)

print_success "Azure AD App Registration created"

# Get connection strings and keys
print_status "Retrieving connection strings and keys..."

COSMOS_ENDPOINT=$(az cosmosdb show \
    --name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --query documentEndpoint \
    --output tsv)

COSMOS_KEY=$(az cosmosdb keys list \
    --name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --query primaryMasterKey \
    --output tsv)

STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
    --name $STORAGE_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --query connectionString \
    --output tsv)

# Generate environment file
print_status "Generating environment configuration file..."
cat > .env.local << EOF
# Azure Configuration - Generated on $(date)

# Azure Active Directory Configuration
VITE_AZURE_CLIENT_ID=$APP_ID
VITE_AZURE_TENANT_ID=$TENANT_ID

# Azure Cosmos DB Configuration
VITE_AZURE_COSMOS_ENDPOINT=$COSMOS_ENDPOINT
VITE_AZURE_COSMOS_KEY=$COSMOS_KEY
VITE_AZURE_COSMOS_DATABASE=$DATABASE_NAME

# Azure Blob Storage Configuration
VITE_AZURE_STORAGE_ACCOUNT=$STORAGE_ACCOUNT_NAME
VITE_AZURE_STORAGE_CONTAINER=$CONTAINER_NAME
AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION_STRING"

# OpenAI API Configuration (You need to add your own key)
VITE_OPENAI_API_KEY=your-openai-api-key-here
VITE_OPENAI_MODEL=text-embedding-3-small
VITE_OPENAI_DIMENSIONS=1536

# Azure Functions Configuration
AZURE_FUNCTIONS_BASE_URL=https://$FUNCTION_APP_NAME.azurewebsites.net

# Application Configuration
VITE_APP_NAME=Health Monitor
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=development

# File Upload Limits
MAX_FILE_SIZE=5368709120
ALLOWED_FILE_TYPES=.xml,.json,.csv,.txt
EOF

print_success "Environment file created: .env.local"

# Summary
print_success "🎉 Azure Health Monitor setup completed!"
echo ""
echo "📋 Summary of created resources:"
echo "  • Resource Group: $RESOURCE_GROUP"
echo "  • Cosmos DB Account: $COSMOS_ACCOUNT_NAME"
echo "  • Database: $DATABASE_NAME"
echo "  • Storage Account: $STORAGE_ACCOUNT_NAME"
echo "  • Function App: $FUNCTION_APP_NAME"
echo "  • Azure AD App: $APP_ID"
echo ""
echo "📝 Next steps:"
echo "  1. Add your OpenAI API key to .env.local"
echo "  2. Deploy Azure Functions: func azure functionapp publish $FUNCTION_APP_NAME"
echo "  3. Build and deploy your application: npm run build"
echo ""
echo "💡 Important notes:"
echo "  • Your Cosmos DB endpoint: $COSMOS_ENDPOINT"
echo "  • Environment configuration saved to: .env.local"
echo "  • Review the README-Azure-Migration.md for detailed instructions"
echo ""
print_success "Setup complete! 🚀" 