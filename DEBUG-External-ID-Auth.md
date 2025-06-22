# Debug Microsoft Entra External ID Authentication

## Quick Debug Steps

### 1. Check Your External ID Tenant Configuration

**Go to Microsoft Entra Admin Center:**
1. Navigate to https://entra.microsoft.com
2. Switch to your External ID tenant
3. Go to **Identity** > **External Identities** > **Self-service sign up**
4. **VERIFY**: "Enable self-service sign up via user flows" is set to **Yes**

### 2. Test with Browser Console

Open your browser's developer tools and run this in the console:

```javascript
// Test basic auth configuration
console.log('Auth Configuration:', {
  clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
  tenantId: import.meta.env.VITE_AZURE_TENANT_ID,
  domain: import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN,
  authority: import.meta.env.VITE_AZURE_AUTHORITY
});

// Test simple sign-in (which should work for both sign-in and sign-up)
const testSignIn = async () => {
  try {
    const result = await window.azureAuth?.signIn();
    console.log('Sign-in test successful:', result);
  } catch (error) {
    console.error('Sign-in test failed:', error);
  }
};

testSignIn();
```

### 3. Check Browser Network Tab

1. Open Network tab in Developer Tools
2. Try to sign up
3. Look for failed requests to Microsoft endpoints
4. Check if there are CORS errors or 4xx/5xx responses

### 4. Common Configuration Issues

**Wrong External ID Setup:**
- ❌ Using regular Azure AD instead of External ID
- ❌ App registration in wrong tenant
- ❌ Self-service sign-up not enabled

**Wrong Environment Variables:**
```bash
# Check your .env.local file has:
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_EXTERNAL_ID_DOMAIN=yourtenant.ciamlogin.com
```

### 5. Alternative Simple Configuration

Try this simpler configuration in your `.env.local`:

```bash
# Minimal External ID configuration
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_AUTHORITY=https://yourtenant.ciamlogin.com/your-tenant-id
VITE_AZURE_KNOWN_AUTHORITIES=yourtenant.ciamlogin.com
```

### 6. Test Steps in Order

1. **First**: Test if sign-in works (existing users)
2. **Second**: Try signing up with a new email
3. **Third**: Check if the user was created in External ID

### 7. Expected Behavior

When working correctly:
- User clicks "Sign Up"
- Popup opens to External ID sign-in page
- User can choose "Create one!" or "Sign up now" link
- User fills in email/password
- Email verification (if enabled)
- User gets redirected back to your app
- Profile gets created in Cosmos DB

### 8. Fallback Test

If sign-up still doesn't work, try making your sign-up button just call the sign-in function:

```javascript
// Temporary test - make sign-up use sign-in
const signUp = async (email, password, userData) => {
  return await signIn(); // This should work if External ID allows new users
};
```

### 9. Check External ID User Creation

After attempting sign-up:
1. Go to Microsoft Entra Admin Center
2. Navigate to **Identity** > **Users** > **All users**
3. Check if the new user was created
4. If user exists but sign-up "failed", it's a frontend integration issue

This debug guide should help identify where the issue is occurring in the authentication flow. 