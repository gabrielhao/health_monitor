import { msalInstance } from './azureConfig'
import type { AccountInfo, SilentRequest } from '@azure/msal-browser'

export interface AuthUser {
  id: string
  email: string
  name?: string
  accessToken?: string
}

class AzureAuthService {
  private account: AccountInfo | null = null

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Azure Auth with config:', {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
        authority: import.meta.env.VITE_AZURE_AUTHORITY || 
          (import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN ? 
            `https://${import.meta.env.VITE_AZURE_EXTERNAL_ID_DOMAIN}/${import.meta.env.VITE_AZURE_TENANT_ID}` :
            `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`),
        knownAuthorities: import.meta.env.VITE_AZURE_KNOWN_AUTHORITIES
      })
      
      await msalInstance.initialize()
      
      // Handle redirect promise on app load
      const response = await msalInstance.handleRedirectPromise()
      if (response && response.account) {
        this.account = response.account
      } else {
        // Try to get account from cache
        const accounts = msalInstance.getAllAccounts()
        if (accounts.length > 0) {
          this.account = accounts[0]
        }
      }
    } catch (error) {
      console.error('Azure Auth initialization failed:', error)
      throw error
    }
  }

  async signIn(): Promise<AuthUser | null> {
    try {
      const loginRequest = {
        scopes: ['https://graph.microsoft.com/User.Read'],
        prompt: 'select_account'
      }

      const response = await msalInstance.loginPopup(loginRequest)
      this.account = response.account

      return this.mapToAuthUser(response.account, response.accessToken)
    } catch (error) {
      console.error('Sign in failed:', error)
      throw new Error('Authentication failed')
    }
  }

  async signUp(): Promise<AuthUser | null> {
    try {
      console.log('Starting sign-up flow for External ID...')
      
      // For Microsoft Entra External ID, sign-up is handled through the regular login flow
      // The External ID tenant should be configured to allow self-service sign-up
      const signUpRequest = {
        scopes: ['https://graph.microsoft.com/User.Read'],
        prompt: 'select_account', // Allow user to choose or create account
        // No extra query parameters needed for External ID
      }

      console.log('Sign-up request configuration:', signUpRequest)
      const response = await msalInstance.loginPopup(signUpRequest)
      
      if (!response || !response.account) {
        throw new Error('No account information received from authentication')
      }

      console.log('Sign-up successful, account info:', {
        id: response.account.homeAccountId,
        email: response.account.username,
        name: response.account.name
      })

      this.account = response.account
      return this.mapToAuthUser(response.account, response.accessToken)
      
    } catch (error: any) {
      console.error('Sign up failed with detailed error:', {
        error: error,
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      })
      
      // Handle specific error types
      if (error?.name === 'BrowserAuthError' && error?.message?.includes('user_cancelled')) {
        throw new Error('Sign-up was cancelled by user')
      }
      
      if (error?.name === 'ClientAuthError') {
        throw new Error(`Authentication configuration error: ${error.message}. Please check your External ID tenant configuration.`)
      }
      
      if (error?.name === 'ServerError') {
        throw new Error(`Server error during sign-up: ${error.message}. Please try again or contact support.`)
      }
      
      // Generic error with more details
      throw new Error(`Sign-up failed: ${error?.message || 'Unknown error'}. Please ensure your External ID tenant allows self-service sign-up.`)
    }
  }

  async signOut(): Promise<void> {
    if (this.account) {
      await msalInstance.logoutPopup({
        account: this.account
      })
      this.account = null
    }
  }

  async getUser(): Promise<AuthUser | null> {
    if (!this.account) {
      return null
    }

    try {
      const accessToken = await this.getAccessToken()
      return this.mapToAuthUser(this.account, accessToken)
    } catch (error) {
      console.error('Failed to get user:', error)
      return null
    }
  }

  async getAccessToken(): Promise<string> {
    if (!this.account) {
      throw new Error('No authenticated user')
    }

    const silentRequest: SilentRequest = {
      scopes: ['https://graph.microsoft.com/User.Read'],
      account: this.account
    }

    try {
      const response = await msalInstance.acquireTokenSilent(silentRequest)
      return response.accessToken
    } catch (error) {
      // If silent token acquisition fails, try interactive
      const response = await msalInstance.acquireTokenPopup(silentRequest)
      return response.accessToken
    }
  }

  private mapToAuthUser(account: AccountInfo, accessToken: string): AuthUser {
    return {
      id: account.homeAccountId,
      email: account.username,
      name: account.name || undefined,
      accessToken
    }
  }

  isAuthenticated(): boolean {
    return this.account !== null
  }

  getCurrentAccount(): AccountInfo | null {
    return this.account
  }
}

export const azureAuth = new AzureAuthService()

// JWT verification helper for server-side functions
export const verifyJWT = async (token: string): Promise<AuthUser | null> => {
  try {
    // In a real implementation, you would verify the JWT token
    // against Azure AD's public keys and validate claims
    // For now, we'll decode the token payload
    const payload = JSON.parse(atob(token.split('.')[1]))
    
    return {
      id: payload.sub || payload.oid,
      email: payload.email || payload.upn,
      name: payload.name
    }
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
} 