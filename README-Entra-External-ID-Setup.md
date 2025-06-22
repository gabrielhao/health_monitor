# Microsoft Entra External ID Setup Guide

This guide replaces the Azure AD B2C setup since Azure AD B2C is no longer available for new tenants as of May 1, 2025. Microsoft Entra External ID is the successor service for managing external identities.

## Prerequisites
- An Azure subscription
- Access to Microsoft Entra admin center

## Step 1: Create Microsoft Entra External ID Tenant

1. **Access Microsoft Entra Admin Center**
   - Go to [Microsoft Entra admin center](https://entra.microsoft.com)
   - Sign in with your Azure account

2. **Create External ID Tenant**
   - Navigate to **"Identity"** > **"External Identities"** > **"All external tenants"**
   - Click **"Create tenant"**
   - Select **"Microsoft Entra External ID"**

3. **Configure Tenant Details**
   - **Organization name**: Your app name (e.g., "Health Monitor")
   - **Initial domain name**: Choose unique subdomain (e.g., "healthmonitor")
   - **Country/Region**: Select your location
   - **Data location**: Choose data residency region
   - Click **"Review + create"** then **"Create"**

4. **Wait for Deployment**
   - Tenant creation takes 2-5 minutes
   - You'll receive a notification when complete

## Step 2: Enable Self-Service Sign-up

1. **Access Your External ID Tenant**
   - Switch to your newly created External ID tenant
   - Navigate to **"Identity"** > **"External Identities"** > **"All identity providers"**

2. **Configure Email One-time Passcode**
   - Click **"Email one-time passcode"**
   - Ensure it's **Enabled for guests**
   - This allows new users to sign up with email verification

3. **Enable Self-Service Sign-up**
   - Go to **"Identity"** > **"External Identities"** > **"Self-service sign up"**
   - **Enable self-service sign up via user flows**: **Yes**
   - Click **"Save"**

4. **Create User Flow (Optional but Recommended)**
   - Navigate to **"Identity"** > **"External Identities"** > **"User flows"**
   - Click **"+ New user flow"**
   - Select **"Sign up and sign in"** template
   - Choose **"Recommended"** version

5. **Configure User Flow Settings**
   - **Name**: `B2C_1_signupsignin` (or your preferred name)
   - **Identity providers**:
     - ✅ **Email with password** (for email sign-up)
     - ✅ **Email one-time passcode** (for guests)
     - Optionally add social providers (Google, Facebook, etc.)

4. **Set User Attributes**
   - **Collect attributes** (data gathered during sign-up):
     - ✅ **Email Address** (required)
     - ✅ **Display Name** (required)
     - ✅ **Given Name** (optional)
     - ✅ **Surname** (optional)
     - Add custom attributes if needed

5. **Configure Return Claims**
   - **Application claims** (data sent to your app):
     - ✅ **Email Addresses**
     - ✅ **Display Name**
     - ✅ **Given Name**
     - ✅ **Surname**
     - ✅ **User's Object ID**

6. **Security Settings**
   - **Multi-factor authentication**: Choose based on security needs
   - **Conditional access**: Configure if required
   - **Self-service password reset**: Enable for better UX

7. **Create the User Flow**
   - Review all settings
   - Click **"Create"**

## Step 3: Register Your Application

1. **Create App Registration**
   - Go to **"Applications"** > **"App registrations"**
   - Click **"+ New registration"**

2. **Configure Application**
   - **Name**: "Health Monitor App"
   - **Supported account types**: 
     - Select **"Accounts in this organizational directory only (External ID tenant - Single tenant)"**
   - **Redirect URI**:
     - Platform: **Single-page application (SPA)**
     - URI: `http://localhost:5173` (for development)

3. **Complete Registration**
   - Click **"Register"**
   - Note down the **Application (client) ID**

## Step 4: Configure Application Authentication

1. **Authentication Settings**
   - In your app registration, go to **"Authentication"**
   - Under **"Single-page application"** section:
     - Add all your redirect URIs:
       - `http://localhost:5173` (development)
       - `https://yourdomain.com` (production)
     - Enable **"Access tokens (used for implicit flows)"**
     - Enable **"ID tokens (used for implicit and hybrid flows)"**

2. **Advanced Settings**
   - **Allow public client flows**: No
   - **Supported account types**: Keep as "This organization only"

3. **API Permissions**
   - Default **"User.Read"** permission should be sufficient
   - Click **"Grant admin consent for [your tenant]"** if needed

## Step 5: Get Configuration Values

After setup, collect these values for your application:

### Required Values:
- **Client ID**: From your app registration overview page
- **Tenant ID**: Your External ID tenant ID
- **Authority URL**: `https://yourtenant.ciamlogin.com/yourtenant.onmicrosoft.com`
- **Known Authorities**: `yourtenant.ciamlogin.com`

### Finding Your Values:
1. **Client ID**: App registration > Overview > Application (client) ID
2. **Tenant ID**: External ID tenant > Overview > Tenant ID  
3. **Domain**: Your tenant domain (e.g., `healthmonitor.ciamlogin.com`)

## Step 6: Update Environment Variables

Create or update your `.env` file with External ID configuration:

```env
# Microsoft Entra External ID Configuration
VITE_AZURE_CLIENT_ID=your-client-id-here
VITE_AZURE_TENANT_ID=your-tenant-id-here

# Use your External ID domain (without https://)
VITE_AZURE_EXTERNAL_ID_DOMAIN=yourtenant.ciamlogin.com

# Known authorities for External ID
VITE_AZURE_KNOWN_AUTHORITIES=yourtenant.ciamlogin.com

# Other Azure services remain the same
VITE_AZURE_STORAGE_ACCOUNT=your-storage-account
VITE_AZURE_COSMOS_ENDPOINT=your-cosmos-endpoint
VITE_AZURE_COSMOS_KEY=your-cosmos-key
VITE_OPENAI_API_KEY=your-openai-key
```

## Step 7: Test the Configuration

1. **Test User Flow**
   - Go to **"User flows"** in your External ID tenant
   - Select your created user flow
   - Click **"Run user flow"**
   - Select your application
   - Click **"Run user flow"** to test

2. **Test Sign-up Process**
   - The test will open the sign-up page
   - Try creating a test account
   - Verify the process works end-to-end

## Step 8: Customize User Experience (Optional)

1. **Company Branding**
   - Go to **"User experiences"** > **"Company branding"**
   - Upload logo and customize colors
   - Set background images and layouts

2. **Custom Domains**
   - Go to **"Settings"** > **"Custom domain names"**
   - Add your custom domain (e.g., `login.yourdomain.com`)
   - Complete domain verification process

## Key Differences from Azure AD B2C

1. **Authority URL Format**: Uses `.ciamlogin.com` instead of `.b2clogin.com`
2. **Enhanced Security**: Built-in conditional access and risk detection
3. **Better Integration**: Native integration with Microsoft Graph
4. **Simplified Management**: Unified admin experience
5. **Modern Features**: Support for passkeys and modern authentication

## Troubleshooting

### Common Issues:

1. **CORS Errors**
   - Ensure all redirect URIs are configured in Authentication settings
   - Check that your domain matches exactly (including http/https)

2. **Authority URL Issues**
   - Verify the authority URL format: `https://yourtenant.ciamlogin.com/yourtenant.onmicrosoft.com`
   - Ensure known authorities includes your domain without https://

3. **Token Issues**
   - Verify scopes are configured correctly
   - Check that ID tokens are enabled in Authentication settings

4. **Sign-up Not Working**
   - Ensure user flow includes "sign up" option
   - Check that email verification is properly configured
   - Verify identity provider settings

### Support Resources:
- [Microsoft Entra External ID Documentation](https://docs.microsoft.com/en-us/azure/active-directory/external-identities/)
- [Migration Guide from B2C](https://docs.microsoft.com/en-us/azure/active-directory/external-identities/b2c-to-external-id-migration)
- [Troubleshooting Guide](https://docs.microsoft.com/en-us/azure/active-directory/external-identities/troubleshoot)

## Migration from Azure AD B2C

If you were previously using Azure AD B2C, Microsoft provides migration tools and guides to help you transition to External ID. The process is largely automated for user data and policies.

This setup provides a robust, modern authentication system that supports self-service user registration for your Health Monitor application. 