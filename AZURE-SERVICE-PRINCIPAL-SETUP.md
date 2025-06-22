# Azure Service Principal Setup Guide

This guide will help you create a service principal in Azure and obtain the required credentials for service-to-service authentication.

## Prerequisites

- Azure subscription with appropriate permissions
- Azure CLI installed (optional but recommended)
- Access to Azure Portal

## Step 1: Create a Service Principal

### Option A: Using Azure Portal (Recommended for beginners)

1. **Navigate to Azure Active Directory**
   - Go to [Azure Portal](https://portal.azure.com)
   - Search for "Azure Active Directory" or "Microsoft Entra ID"
   - Click on "Azure Active Directory"

2. **Create App Registration**
   - In the left sidebar, click "App registrations"
   - Click "+ New registration"
   - Fill in the details:
     - **Name**: `health-monitor-service` (or your preferred name)
     - **Supported account types**: Select "Accounts in this organizational directory only"
     - **Redirect URI**: Leave blank (not needed for service principal)
   - Click "Register"

3. **Get Client ID and Tenant ID**
   - After registration, you'll see the "Overview" page
   - Copy the **Application (client) ID** → This is your `VITE_AZURE_SERVICE_CLIENT_ID`
   - Copy the **Directory (tenant) ID** → This is your `VITE_AZURE_SERVICE_TENANT_ID`

4. **Create Client Secret**
   - In the left sidebar, click "Certificates & secrets"
   - Click "Client secrets" tab
   - Click "+ New client secret"
   - Add description: `health-monitor-app-secret`
   - Choose expiration (recommended: 24 months)
   - Click "Add"
   - **IMPORTANT**: Copy the **Value** immediately → This is your `VITE_AZURE_SERVICE_CLIENT_SECRET`
   - ⚠️ **Warning**: You cannot retrieve this value later, only create a new one

### Option B: Using Azure CLI

```bash
# Login to Azure
az login

# Create service principal
az ad sp create-for-rbac --name "health-monitor-service" --role contributor --scopes /subscriptions/{subscription-id}

# This will output:
# {
#   "appId": "your-client-id",           # → VITE_AZURE_SERVICE_CLIENT_ID
#   "displayName": "health-monitor-service",
#   "password": "your-client-secret",    # → VITE_AZURE_SERVICE_CLIENT_SECRET
#   "tenant": "your-tenant-id"           # → VITE_AZURE_SERVICE_TENANT_ID
# }
```

## Step 2: Assign Required Permissions

### For Azure Blob Storage

1. **Navigate to your Storage Account**
   - Go to Azure Portal → Storage accounts → Select your storage account
   - In the left sidebar, click "Access Control (IAM)"
   - Click "+ Add" → "Add role assignment"
   - **Role**: "Storage Blob Data Contributor"
   - **Assign access to**: "User, group, or service principal"
   - **Select**: Search for your service principal name (`health-monitor-service`)
   - Click "Review + assign"

### For Azure Cosmos DB

1. **Navigate to your Cosmos DB Account**
   - Go to Azure Portal → Azure Cosmos DB → Select your database account
   - In the left sidebar, click "Access Control (IAM)"
   - Click "+ Add" → "Add role assignment"
   - **Role**: "Cosmos DB Account Reader Role" or "DocumentDB Account Contributor"
   - **Assign access to**: "User, group, or service principal"
   - **Select**: Search for your service principal name
   - Click "Review + assign"

### For Azure Key Vault

1. **Navigate to your Key Vault**
   - Go to Azure Portal → Key vaults → Select your key vault
   - In the left sidebar, click "Access Control (IAM)"
   - Click "+ Add" → "Add role assignment"
   - **Role**: "Key Vault Secrets User" or "Key Vault Contributor"
   - **Assign access to**: "User, group, or service principal"
   - **Select**: Search for your service principal name
   - Click "Review + assign"

## Step 3: Update Environment Variables

Add these values to your `.env` file:

```env
# Service Principal Credentials (for Azure services)
VITE_AZURE_SERVICE_CLIENT_ID=your-application-client-id
VITE_AZURE_SERVICE_TENANT_ID=your-directory-tenant-id
VITE_AZURE_SERVICE_CLIENT_SECRET=your-client-secret-value

# Keep your existing user auth credentials
VITE_AZURE_CLIENT_ID=your-user-app-client-id
VITE_AZURE_TENANT_ID=your-user-tenant-id
```

## Step 4: Verify Setup

### Test with Azure CLI

```bash
# Test service principal login
az login --service-principal -u {client-id} -p {client-secret} --tenant {tenant-id}

# Test access to resources
az storage account list  # Should list your storage accounts
az cosmosdb list        # Should list your Cosmos DB accounts
```

### Test in Your Application

The service principal credentials will now be used automatically when you call:
- `createBlobServiceClient()`
- `createKeyVaultClient()`

## Security Best Practices

### ⚠️ Important Security Notes

1. **Client Secret Exposure**: The current implementation exposes the client secret in the browser, which is **not secure for production**.

2. **Recommended Production Architecture**:
   ```
   Frontend (Browser) → Backend API → Azure Services
   ```
   - Move service principal authentication to a backend service
   - Frontend authenticates users with MSAL
   - Backend uses service principal for Azure services
   - Frontend calls backend APIs instead of Azure services directly

3. **Alternative Secure Approaches**:
   - Use Azure Functions with managed identity
   - Implement token exchange in a secure backend
   - Use Azure Static Web Apps with API functions

### Development vs Production

**Development** (Current setup):
- ✅ Quick to set up and test
- ❌ Client secret exposed in browser
- ❌ Not secure for production

**Production** (Recommended):
- ✅ Secrets stored securely on server
- ✅ Principle of least privilege
- ✅ Better audit and monitoring
- ❌ More complex architecture

## Troubleshooting

### Common Issues

1. **"Insufficient privileges" error**
   - Ensure the service principal has the correct role assignments
   - Check that permissions have propagated (can take 5-10 minutes)

2. **"Authentication failed" error**
   - Verify client ID, tenant ID, and secret are correct
   - Ensure the service principal is not disabled

3. **"Access denied" to specific resources**
   - Check role assignments on each resource
   - Verify the service principal has the minimum required permissions

### Verify Permissions

```bash
# Check role assignments for your service principal
az role assignment list --assignee {client-id} --output table
```

## Next Steps

1. **Test the implementation** with your new service principal credentials
2. **Plan migration to secure architecture** for production deployment
3. **Consider using Azure Functions** for a more secure server-side approach
4. **Implement proper error handling** and logging for authentication issues 