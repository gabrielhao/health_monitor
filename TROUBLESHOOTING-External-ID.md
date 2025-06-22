# Troubleshooting Microsoft Entra External ID Authentication

## Error: "endpoints_resolution_error: Endpoints cannot be resolved"

This error indicates that the MSAL library cannot resolve the authority endpoints for your External ID tenant. Here are the steps to fix it:

### Step 1: Verify Your Environment Variables

Check your `.env.local` file and ensure you have the correct format:

```env
# Microsoft Entra External ID Configuration
VITE_AZURE_CLIENT_ID=your-actual-client-id
VITE_AZURE_TENANT_ID=your-actual-tenant-id
VITE_AZURE_EXTERNAL_ID_DOMAIN=yourtenant.ciamlogin.com
VITE_AZURE_KNOWN_AUTHORITIES=yourtenant.ciamlogin.com
```

### Step 2: Find Your Correct External ID Domain

1. **Go to Microsoft Entra Admin Center**: https://entra.microsoft.com
2. **Switch to your External ID tenant**
3. **Navigate to**: Identity > Overview > Properties
4. **Look for**: Primary domain - this should be something like `yourtenant.ciamlogin.com`

### Step 3: Get Your Tenant ID

1. In the same Properties page, copy the **Tenant ID** (GUID format)
2. Make sure this matches your `VITE_AZURE_TENANT_ID` value

### Step 4: Verify Your App Registration

1. **Go to**: Applications > App registrations
2. **Select your app**
3. **Copy the Application (client) ID**
4. **Verify this matches your `VITE_AZURE_CLIENT_ID`**

### Step 5: Check Redirect URIs

1. In your app registration, go to **Authentication**
2. Under **Single-page application**, ensure you have:
   - `http://localhost:5173` (for development)
   - Your production URL (if deploying)
3. **Important**: URLs must match exactly (including http/https)

### Step 6: Alternative Configuration

If the domain-based configuration doesn't work, try the direct authority approach:

```env
# Alternative configuration - use AUTHORITY instead of DOMAIN
VITE_AZURE_CLIENT_ID=your-actual-client-id
VITE_AZURE_TENANT_ID=your-actual-tenant-id
VITE_AZURE_AUTHORITY=https://yourtenant.ciamlogin.com/your-tenant-id
VITE_AZURE_KNOWN_AUTHORITIES=yourtenant.ciamlogin.com
```

### Step 7: Check Browser Console

1. Open your browser's developer tools
2. Look for console logs starting with "Initializing Azure Auth with config:"
3. Verify the authority URL is being constructed correctly

### Example of Correct Values

Here's what your values should look like (replace with your actual values):

```env
VITE_AZURE_CLIENT_ID=12345678-1234-1234-1234-123456789012
VITE_AZURE_TENANT_ID=87654321-4321-4321-4321-210987654321
VITE_AZURE_EXTERNAL_ID_DOMAIN=healthmonitor.ciamlogin.com
VITE_AZURE_KNOWN_AUTHORITIES=healthmonitor.ciamlogin.com
```

### Step 8: Clear Browser Cache

1. Clear your browser cache and cookies
2. Clear sessionStorage and localStorage
3. Restart your development server

### Step 9: Test with a Simple Sign-in First

Before testing sign-up, try a simple sign-in flow to ensure the basic configuration works:

```javascript
// Test this in browser console after your app loads
const testAuth = async () => {
  try {
    const result = await azureAuth.signIn();
    console.log('Auth test successful:', result);
  } catch (error) {
    console.error('Auth test failed:', error);
  }
};
testAuth();
```

### Common Mistakes

1. **Wrong Domain Format**: 
   - ❌ `https://yourtenant.ciamlogin.com`
   - ✅ `yourtenant.ciamlogin.com`

2. **Wrong Authority Format**:
   - ❌ `https://yourtenant.ciamlogin.com/yourtenant.onmicrosoft.com`
   - ✅ `https://yourtenant.ciamlogin.com/your-tenant-id`

3. **Missing Environment Variables**:
   - Make sure your `.env.local` file is in the root directory
   - Restart your development server after changing environment variables

4. **Wrong Tenant Context**:
   - Make sure you're in your External ID tenant, not your main Azure AD tenant

### Still Having Issues?

If you're still getting the error:

1. **Check the exact error message** in browser console
2. **Verify your External ID tenant is properly created**
3. **Make sure your app registration is in the External ID tenant, not regular Azure AD**
4. **Try creating a new app registration** if the current one was created incorrectly

### Debug Configuration

Add this to your component to debug the configuration:

```javascript
console.log('Auth Configuration Debug:', {
  clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
  tenantId: import.meta.env.VITE_AZURE_TENANT_ID,
  domain: import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN,
  knownAuthorities: import.meta.env.VITE_AZURE_KNOWN_AUTHORITIES,
  authority: import.meta.env.VITE_AZURE_AUTHORITY
});
```

This should help you identify any configuration issues. 