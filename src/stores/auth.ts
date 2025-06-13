import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { supabase } from '@/services/supabase'
import type { User, UserProfile } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const userEmail = computed(() => user.value?.email || '')

  // Initialize auth state
  const initialize = async () => {
    try {
      loading.value = true
      
      // Test connection first
      const { data: connectionTest, error: connectionError } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(1)
        .maybeSingle()

      if (connectionError && connectionError.message.includes('Failed to fetch')) {
        console.error('Supabase connection failed:', connectionError)
        throw new Error('Unable to connect to the database. Please check your internet connection and try again.')
      }

      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        user.value = session.user as User
        await fetchProfile()
      }
      
      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          user.value = session.user as User
          await fetchProfile()
        } else {
          user.value = null
          profile.value = null
        }
      })
    } catch (error: any) {
      console.error('Error initializing auth:', error)
      // Don't throw the error to prevent app crash, just log it
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  // Fetch user profile
  const fetchProfile = async () => {
    if (!user.value) return

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.value.id)
        .maybeSingle()

      if (error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the database. Please check your internet connection.')
        }
        throw error
      }

      // Set profile to data (which will be null if no profile found)
      profile.value = data
    } catch (error: any) {
      console.error('Error fetching profile:', error)
      // Don't throw the error to prevent app crash
    }
  }

  // Sign up
  const signUp = async (email: string, password: string, userData?: Partial<UserProfile>) => {
    try {
      loading.value = true
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        // Provide more specific error messages for sign up
        if (error.message.includes('already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.')
        }
        if (error.message.includes('password')) {
          throw new Error('Password must be at least 6 characters long.')
        }
        if (error.message.includes('email')) {
          throw new Error('Please enter a valid email address.')
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.')
        }
        throw new Error(error.message)
      }

      // Create profile immediately after user is created, regardless of session status
      if (data.user) {
        await createProfile(data.user.id, { email, ...userData })
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        // Email confirmation required
        return { needsConfirmation: true }
      }

      return { needsConfirmation: false }
    } catch (error: any) {
      console.error('Error signing up:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      loading.value = true
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Provide more helpful error messages for sign in
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('The email or password you entered is incorrect. Please check your credentials and try again.')
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and click the confirmation link before signing in.')
        }
        if (error.message.includes('Too many requests')) {
          throw new Error('Too many sign-in attempts. Please wait a few minutes before trying again.')
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.')
        }
        throw new Error(error.message)
      }

      user.value = data.user as User
      await fetchProfile()
      
      return data
    } catch (error: any) {
      console.error('Error signing in:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      loading.value = true
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        if (error.message.includes('Failed to fetch')) {
          // If we can't connect to sign out, just clear local state
          console.warn('Unable to connect to server for sign out, clearing local session')
        } else {
          throw error
        }
      }

      user.value = null
      profile.value = null
    } catch (error) {
      console.error('Error signing out:', error)
      // Clear local state even if server sign out fails
      user.value = null
      profile.value = null
    } finally {
      loading.value = false
    }
  }

  // Create profile
  const createProfile = async (userId: string, profileData: Partial<UserProfile>) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          ...profileData,
        })
        .select()
        .single()

      if (error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the database. Please check your internet connection.')
        }
        throw error
      }

      profile.value = data
      return data
    } catch (error) {
      console.error('Error creating profile:', error)
      throw error
    }
  }

  // Update profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user.value) throw new Error('Not authenticated')

    try {
      loading.value = true
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.value.id)
        .select()
        .single()

      if (error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the database. Please check your internet connection.')
        }
        throw error
      }

      profile.value = data
      return data
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      
      if (error) {
        if (error.message.includes('email')) {
          throw new Error('Please enter a valid email address.')
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.')
        }
        throw new Error(error.message)
      }
    } catch (error: any) {
      console.error('Error resetting password:', error)
      throw error
    }
  }

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
  }
})