import { azureAuth, type AuthUser } from '@/services/azureAuth';
import { azureCosmos } from '@/services/azureCosmos';
import type { UserProfile } from '@/types';
import { defineStore } from 'pinia';
import { computed, readonly, ref } from 'vue';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<AuthUser | null>(null);
    const profile = ref<UserProfile | null>(null);
    const loading = ref(false);
    const initialized = ref(false);

    const isAuthenticated = computed(() => !!user.value);
    const userEmail = computed(() => user.value?.email || '');

    // Initialize auth state
    const initialize = async () => {
        try {
            loading.value = true;

            // Initialize Azure services
            await azureAuth.initialize();
            await azureCosmos.initialize();

            // Check if user is already authenticated
            const currentUser = await azureAuth.getUser();
            if (currentUser) {
                user.value = currentUser;
                await fetchProfile();
            }
        } catch (error: any) {
            console.error('Error initializing auth:', error);
            // Don't throw the error to prevent app crash, just log it
        } finally {
            loading.value = false;
            initialized.value = true;
        }
    };

    // Fetch user profile
    const fetchProfile = async () => {
        if (!user.value) {
            console.log('No user found, skipping profile fetch');
            return;
        }

        try {
            loading.value = true;
            console.log('Fetching profile for user:', user.value.id);

            // Query Azure Cosmos DB for user profile
            const userProfile = await azureCosmos.getUserProfile(user.value.id);

            if (!userProfile) {
                console.log('No profile found for user:', user.value.id);
                profile.value = null;
                return;
            }

            console.log('Profile fetched successfully:', userProfile);
            profile.value = userProfile;
        } catch (error: any) {
            console.error('Error fetching profile:', error);
            profile.value = null;
            throw error; // Re-throw to allow caller to handle the error
        } finally {
            loading.value = false;
        }
    };

    // Sign up - allows users to self-register
    const signUp = async () => {
        // If sign-up fails, try regular sign-in (External ID might handle new users during sign-in)
        try {
            const authUser = await azureAuth.signIn();

            if (authUser) {
                user.value = authUser;
                console.log('User authenticated successfully:', authUser.email);

                // Always try to fetch existing profile first
                let profileExists = false;
                try {
                    await fetchProfile();
                    if (profile.value) {
                        profileExists = true;
                        console.log('Existing user profile found:', profile.value.email);
                    }
                } catch (profileError) {
                    console.log('No existing profile found, will create new one');
                    profileExists = false;
                }

                // Create user profile if it doesn't exist
                if (!profileExists || !profile.value) {
                    const profileData: Partial<UserProfile> = {
                        email: authUser.email,
                        full_name: authUser.name || 'User',
                        privacy_settings: {
                            data_sharing: false,
                            analytics: true,
                            notifications: true,
                        },
                        medical_conditions: [],
                        medications: [],
                    };

                    console.log('Creating new user profile in user_profile container with data:', profileData);

                    try {
                        await createProfile(authUser.id, profileData);
                        console.log('User profile created successfully in Cosmos DB');

                        // Verify profile was created by fetching it again
                        await fetchProfile();
                        if (!profile.value) {
                            throw new Error('Profile creation verification failed');
                        }
                    } catch (createProfileError: any) {
                        console.error('Failed to create user profile:', createProfileError);
                        throw new Error(`User authenticated but profile creation failed: ${createProfileError.message}`);
                    }
                } else {
                    console.log('Using existing user profile');
                }

                return { user: authUser, profile: profile.value };
            }

            throw new Error('Failed to authenticate user');
        } catch (error: any) {
            console.error('Error during sign up:', error);
            throw error;
        } finally {
            loading.value = false;
        }
    };

    // Sign in
    const signIn = async () => {
        try {
            loading.value = true;

            const authUser = await azureAuth.signIn();
            if (authUser) {
                user.value = authUser;
                await fetchProfile();

                // Create profile if it doesn't exist
                if (!profile.value) {
                    await createProfile(authUser.id, {
                        email: authUser.email,
                        full_name: authUser.name,
                    });
                }
            }

            return { user: authUser };
        } catch (error: any) {
            console.error('Error signing in:', error);
            throw error;
        } finally {
            loading.value = false;
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            loading.value = true;

            await azureAuth.signOut();
            user.value = null;
            profile.value = null;
        } catch (error: any) {
            console.error('Error signing out:', error);
            // Clear local state even if sign out fails
            user.value = null;
            profile.value = null;
            throw error;
        } finally {
            loading.value = false;
        }
    };

    // Create profile
    const createProfile = async (userId: string, profileData: Partial<UserProfile>) => {
        try {
            loading.value = true;

            console.log(`Creating user profile in user_profile container for user ID: ${userId}`);

            // Ensure all required fields are present
            const completeProfileData = {
                id: userId,
                email: profileData.email || '',
                full_name: profileData.full_name || '',
                avatar_url: profileData.avatar_url,
                date_of_birth: profileData.date_of_birth,
                gender: profileData.gender,
                height: profileData.height,
                weight: profileData.weight,
                emergency_contact: profileData.emergency_contact,
                privacy_settings: {
                    data_sharing: false,
                    analytics: true,
                    notifications: true,
                    ...profileData.privacy_settings,
                },
                medical_conditions: profileData.medical_conditions || [],
                medications: profileData.medications || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...profileData,
            };

            console.log('Complete profile data to be created:', completeProfileData);

            const newProfile = await azureCosmos.createUserProfile(completeProfileData);

            console.log('User profile created successfully in Cosmos DB user_profile container:', newProfile.id);

            profile.value = newProfile;
            return newProfile;
        } catch (error: any) {
            console.error('Error creating profile in user_profile container:', error);
            throw new Error(`Failed to create user profile: ${error.message}`);
        } finally {
            loading.value = false;
        }
    };

    // Update profile
    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!user.value || !user.value.id) {
            throw new Error('Not authenticated');
        }

        try {
            loading.value = true;

            const updatedProfile = await azureCosmos.updateUserProfile(user.value.id, updates);

            profile.value = updatedProfile;
            return updatedProfile;
        } catch (error: any) {
            console.error('Error updating profile:', error);
            throw error;
        } finally {
            loading.value = false;
        }
    };

    // Reset password (handled by Azure AD)
    const resetPassword = async (_email: string) => {
        throw new Error('Password reset is handled through Azure Active Directory. Please use the Azure AD password reset flow.');
    };

    // Verify profile exists in user_profile container
    const verifyProfileExists = async (userId: string): Promise<boolean> => {
        try {
            console.log(`Verifying user profile exists in user_profile container for user ID: ${userId}`);
            const existingProfile = await azureCosmos.getUserProfile(userId);
            const exists = !!existingProfile;
            console.log(`Profile verification result: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
            return exists;
        } catch (error: any) {
            console.error('Error verifying profile existence:', error);
            return false;
        }
    };

    return {
        user: readonly(user),
        profile: readonly(profile),
        loading: readonly(loading),
        initialized: readonly(initialized),
        isAuthenticated,
        userEmail,
        initialize,
        fetchProfile,
        signUp,
        signIn,
        signOut,
        createProfile,
        updateProfile,
        resetPassword,
        verifyProfileExists,
    };
});
