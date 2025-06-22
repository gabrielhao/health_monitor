# Test User Profile Creation During Sign-up

## How to Verify Profile Creation

### 1. Browser Console Test

After a user signs up, check the browser console for these logs:

```
✅ "Starting sign-up process for email: user@example.com"
✅ "User authenticated successfully: user@example.com"
✅ "Creating new user profile in user_profile container with data: {...}"
✅ "Creating user profile in user_profile container for user ID: ..."
✅ "Profile data being inserted into user_profile container: {...}"
✅ "User profile successfully created in user_profile container with ID: ..."
✅ "User profile created successfully in Cosmos DB"
```

### 2. Check Cosmos DB Directly

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Cosmos DB account
3. Go to **Data Explorer**
4. Expand your database (e.g., `HealthMonitorDB`)
5. Expand the `user_profiles` container
6. Click **Items** to see all user profiles
7. Look for your newly created user profile

### 3. Profile Data Structure

Each user profile record should contain:

```json
{
  "id": "user-azure-id-guid",
  "email": "user@example.com",
  "full_name": "User Name",
  "privacy_settings": {
    "data_sharing": false,
    "analytics": true,
    "notifications": true
  },
  "medical_conditions": [],
  "medications": [],
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z",
  "_partitionKey": "user-azure-id-guid"
}
```

### 4. Manual Test Function

Add this to your browser console to test profile creation:

```javascript
// Test profile creation manually
const testProfileCreation = async () => {
  try {
    // Check if user is authenticated
    const authStore = window.$pinia?.state?.value?.auth;
    if (!authStore?.user) {
      console.error('No authenticated user found');
      return;
    }
    
    const userId = authStore.user.id;
    console.log('Testing profile for user ID:', userId);
    
    // Check if profile exists
    const profileExists = await authStore.verifyProfileExists(userId);
    console.log('Profile exists:', profileExists);
    
    if (profileExists) {
      console.log('✅ User profile successfully created in user_profile container');
    } else {
      console.log('❌ User profile NOT found in user_profile container');
    }
    
  } catch (error) {
    console.error('Profile test failed:', error);
  }
};

testProfileCreation();
```

### 5. Expected Sign-up Flow

1. **User fills sign-up form** → triggers `signUp()` function
2. **Azure authentication** → creates user in External ID
3. **Profile check** → checks if profile already exists
4. **Profile creation** → creates new profile in `user_profile` container
5. **Verification** → fetches profile to confirm creation
6. **Success** → user is signed up and profile is created

### 6. Common Issues to Check

**❌ Profile Not Created:**
- Check Cosmos DB connection string
- Verify `user_profile` container exists
- Check partition key configuration (`/id`)
- Look for error logs in console

**❌ Duplicate Profiles:**
- Profile creation should only happen for new users
- Existing users should use their existing profile

**❌ Missing Data:**
- Ensure all required fields are populated
- Check that email and user ID are properly passed

### 7. Success Indicators

✅ **Profile Created Successfully:**
- Console shows "User profile successfully created in user_profile container"
- User can access the app without errors
- Profile data appears in Cosmos DB Data Explorer
- `fetchProfile()` successfully retrieves the profile

### 8. Debug Commands

```javascript
// Check current user and profile state
console.log('Current user:', window.$pinia?.state?.value?.auth?.user);
console.log('Current profile:', window.$pinia?.state?.value?.auth?.profile);

// Check Cosmos DB configuration
console.log('Cosmos DB config:', {
  endpoint: import.meta.env.VITE_AZURE_COSMOS_ENDPOINT,
  database: import.meta.env.VITE_AZURE_COSMOS_DATABASE,
  hasKey: !!import.meta.env.VITE_AZURE_COSMOS_KEY
});
```

This test process will help you verify that user profiles are properly created in the `user_profile` container during the sign-up process. 