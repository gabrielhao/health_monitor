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
    } catch (error) {
      console.error('Error initializing auth:', error)
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
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      profile.value = data
    } catch (error) {
      console.error('Error fetching profile:', error)
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

      if (error) throw error

      // Create profile if user was created
      if (data.user && !data.session) {
        // Email confirmation required
        return { needsConfirmation: true }
      }

      if (data.user && userData) {
        await createProfile(data.user.id, { email, ...userData })
      }

      return { needsConfirmation: false }
    } catch (error) {
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

      if (error) throw error

      user.value = data.user as User
      await fetchProfile()
      
      return data
    } catch (error) {
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
      
      if (error) throw error

      user.value = null
      profile.value = null
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
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

      if (error) throw error

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

      if (error) throw error

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
      
      if (error) throw error
    } catch (error) {
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