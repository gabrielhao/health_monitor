import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { mockSupabaseClient, createMockUser, createMockProfile } from '../mocks/supabase'

vi.mock('@/services/supabase', () => ({
  supabase: mockSupabaseClient
}))

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    it('should initialize with existing session', async () => {
      // Arrange
      const mockUser = createMockUser()
      const mockProfile = createMockProfile()
      
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      })
      
      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null
          })
        })
      })

      const authStore = useAuthStore()

      // Act
      await authStore.initialize()

      // Assert
      expect(authStore.user).toEqual(mockUser)
      expect(authStore.profile).toEqual(mockProfile)
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.initialized).toBe(true)
    })

    it('should handle connection errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockRejectedValue(new Error('Failed to fetch'))
          })
        })
      })

      const authStore = useAuthStore()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Act
      await authStore.initialize()

      // Assert
      expect(authStore.initialized).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error initializing auth:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('signUp', () => {
    it('should sign up user successfully', async () => {
      // Arrange
      const mockUser = createMockUser()
      
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: { user: mockUser } },
        error: null
      })
      
      mockSupabaseClient.from().insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: createMockProfile(),
            error: null
          })
        })
      })

      const authStore = useAuthStore()

      // Act
      const result = await authStore.signUp('test@example.com', 'password123', {
        full_name: 'Test User'
      })

      // Assert
      expect(result.needsConfirmation).toBe(false)
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      })
    })

    it('should handle email confirmation requirement', async () => {
      // Arrange
      const mockUser = createMockUser()
      
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null }, // No session = needs confirmation
        error: null
      })
      
      mockSupabaseClient.from().insert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: createMockProfile(),
            error: null
          })
        })
      })

      const authStore = useAuthStore()

      // Act
      const result = await authStore.signUp('test@example.com', 'password123')

      // Assert
      expect(result.needsConfirmation).toBe(true)
    })

    it('should handle sign up errors with specific messages', async () => {
      // Arrange
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' }
      })

      const authStore = useAuthStore()

      // Act & Assert
      await expect(authStore.signUp('existing@example.com', 'password123'))
        .rejects.toThrow('An account with this email already exists. Please sign in instead.')
    })
  })

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      // Arrange
      const mockUser = createMockUser()
      const mockProfile = createMockProfile()
      
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: { user: mockUser } },
        error: null
      })
      
      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null
          })
        })
      })

      const authStore = useAuthStore()

      // Act
      const result = await authStore.signIn('test@example.com', 'password123')

      // Assert
      expect(authStore.user).toEqual(mockUser)
      expect(authStore.profile).toEqual(mockProfile)
      expect(result.user).toEqual(mockUser)
    })

    it('should handle invalid credentials with helpful message', async () => {
      // Arrange
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      })

      const authStore = useAuthStore()

      // Act & Assert
      await expect(authStore.signIn('wrong@example.com', 'wrongpassword'))
        .rejects.toThrow('The email or password you entered is incorrect. Please check your credentials and try again.')
    })

    it('should handle network errors', async () => {
      // Arrange
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Failed to fetch' }
      })

      const authStore = useAuthStore()

      // Act & Assert
      await expect(authStore.signIn('test@example.com', 'password123'))
        .rejects.toThrow('Unable to connect to the server. Please check your internet connection and try again.')
    })
  })

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      // Arrange
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null
      })

      const authStore = useAuthStore()
      authStore.user = createMockUser()
      authStore.profile = createMockProfile()

      // Act
      await authStore.signOut()

      // Assert
      expect(authStore.user).toBe(null)
      expect(authStore.profile).toBe(null)
    })

    it('should handle network errors during sign out', async () => {
      // Arrange
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: { message: 'Failed to fetch' }
      })

      const authStore = useAuthStore()
      authStore.user = createMockUser()
      authStore.profile = createMockProfile()

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Act
      await authStore.signOut()

      // Assert - Local state is cleared even if server sign out fails
      expect(authStore.user).toBe(null)
      expect(authStore.profile).toBe(null)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unable to connect to server for sign out, clearing local session'
      )

      consoleSpy.mockRestore()
    })
  })

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const mockUser = createMockUser()
      const updatedProfile = {
        ...createMockProfile(),
        full_name: 'Updated Name',
        height: 175
      }
      
      mockSupabaseClient.from().update.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: updatedProfile,
              error: null
            })
          })
        })
      })

      const authStore = useAuthStore()
      authStore.user = mockUser

      // Act
      const result = await authStore.updateProfile({
        full_name: 'Updated Name',
        height: 175
      })

      // Assert
      expect(authStore.profile).toEqual(updatedProfile)
      expect(result).toEqual(updatedProfile)
    })

    it('should handle update errors', async () => {
      // Arrange
      mockSupabaseClient.from().update.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Update failed'))
          })
        })
      })

      const authStore = useAuthStore()
      authStore.user = createMockUser()

      // Act & Assert
      await expect(authStore.updateProfile({ full_name: 'New Name' }))
        .rejects.toThrow('Update failed')
    })

    it('should require authentication for profile updates', async () => {
      // Arrange
      const authStore = useAuthStore()
      authStore.user = null

      // Act & Assert
      await expect(authStore.updateProfile({ full_name: 'New Name' }))
        .rejects.toThrow('Not authenticated')
    })
  })

  describe('resetPassword', () => {
    it('should send password reset email successfully', async () => {
      // Arrange
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: null
      })

      const authStore = useAuthStore()

      // Act
      await authStore.resetPassword('test@example.com')

      // Assert
      expect(mockSupabaseClient.auth.resetPasswordForEmail)
        .toHaveBeenCalledWith('test@example.com')
    })

    it('should handle invalid email format', async () => {
      // Arrange
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'Invalid email format' }
      })

      const authStore = useAuthStore()

      // Act & Assert
      await expect(authStore.resetPassword('invalid-email'))
        .rejects.toThrow('Please enter a valid email address.')
    })
  })

  describe('Computed Properties', () => {
    it('should compute isAuthenticated correctly', () => {
      // Arrange
      const authStore = useAuthStore()

      // Act & Assert - Not authenticated initially
      expect(authStore.isAuthenticated).toBe(false)

      // Act - Set user
      authStore.user = createMockUser()

      // Assert - Now authenticated
      expect(authStore.isAuthenticated).toBe(true)
    })

    it('should compute userEmail correctly', () => {
      // Arrange
      const authStore = useAuthStore()

      // Act & Assert - Empty email initially
      expect(authStore.userEmail).toBe('')

      // Act - Set user
      const mockUser = createMockUser({ email: 'test@example.com' })
      authStore.user = mockUser

      // Assert - Email is returned
      expect(authStore.userEmail).toBe('test@example.com')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing profile gracefully', async () => {
      // Arrange
      const mockUser = createMockUser()
      
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      })
      
      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null, // No profile found
            error: null
          })
        })
      })

      const authStore = useAuthStore()

      // Act
      await authStore.initialize()

      // Assert
      expect(authStore.user).toEqual(mockUser)
      expect(authStore.profile).toBe(null)
      expect(authStore.isAuthenticated).toBe(true)
    })

    it('should handle concurrent initialization calls', async () => {
      // Arrange
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      const authStore = useAuthStore()

      // Act - Call initialize multiple times concurrently
      const promises = [
        authStore.initialize(),
        authStore.initialize(),
        authStore.initialize()
      ]

      await Promise.all(promises)

      // Assert - Should not cause errors
      expect(authStore.initialized).toBe(true)
    })
  })
})