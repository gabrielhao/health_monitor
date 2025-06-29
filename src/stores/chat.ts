import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'
import { azureCosmos } from '@/services/azureCosmos'
import type { ChatMessage } from '@/types'
import { useAuthStore } from './auth'
import { generateAIResponse } from '@/services/chatApi'
import { 
  sendHealthChatMessage as apiSendHealthChatMessage, 
  searchUserHealthData,
  generateHealthInsights,
  type HealthChatMessage, 
  type HealthDataSearchOptions,
  type HealthChatResponse,
  type HealthDataSearchResult 
} from '@/services/healthChatApi'

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()
  
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const typing = ref(false)
  
  // Health context and RAG state
  const healthContextEnabled = ref(true)
  const lastRagContext = ref<HealthChatResponse['ragContext'] | null>(null)
  const healthSearchOptions = ref<HealthDataSearchOptions>({
    limit: 10,
    similarityThreshold: 0.75
  })

  // Fetch messages
  const fetchMessages = async (limit = 50) => {
    if (!authStore.user) return

    try {
      loading.value = true
      
      const chatMessages = await azureCosmos.getChatMessages(authStore.user.id, { limit })
      messages.value = chatMessages || []
    } catch (error) {
      console.error('Error fetching messages:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Send message
  const sendMessage = async (message: string, messageType: 'text' | 'image' | 'file' = 'text') => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      // Add user message
      const userMessage = await azureCosmos.createChatMessage({
        user_id: authStore.user.id,
        message,
        sender_type: 'user',
        message_type: messageType,
      })

      messages.value.push(userMessage)

      // Generate AI response
      typing.value = true
      const aiResponse = await generateAIResponse(message)
      
      const aiMessage = await azureCosmos.createChatMessage({
        user_id: authStore.user.id,
        message: aiResponse,
        sender_type: 'ai',
        message_type: 'text',
      })

      messages.value.push(aiMessage)
      
      return { userMessage, aiMessage }
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    } finally {
      typing.value = false
    }
  }

  // Send health-aware message with RAG context
  const sendHealthMessage = async (
    message: string, 
    messageType: 'text' | 'image' | 'file' = 'text',
    enableHealth = healthContextEnabled.value
  ) => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      // Add user message to local storage
      const userMessage = await azureCosmos.createChatMessage({
        user_id: authStore.user.id,
        message,
        sender_type: 'user',
        message_type: messageType,
      })

      messages.value.push(userMessage)

      // Generate health-aware AI response
      typing.value = true
      
      const healthChatMessages: HealthChatMessage[] = [
        { role: 'user', content: message }
      ]

      const healthResponse = await apiSendHealthChatMessage(healthChatMessages, {
        userId: authStore.user.id,
        enableHealthContext: enableHealth,
        healthSearchOptions: healthSearchOptions.value
      })

      // Store RAG context for debugging/display
      lastRagContext.value = healthResponse.ragContext || null

      // Store AI response
      const aiMessage = await azureCosmos.createChatMessage({
        user_id: authStore.user.id,
        message: healthResponse.message,
        sender_type: 'ai',
        message_type: 'text',
        metadata: {
          ragContext: healthResponse.ragContext,
          model: healthResponse.model,
          usage: healthResponse.usage
        }
      })

      messages.value.push(aiMessage)
      
      return { userMessage, aiMessage, ragContext: healthResponse.ragContext }
    } catch (error) {
      console.error('Error sending health message:', error)
      throw error
    } finally {
      typing.value = false
    }
  }

  // Search health data with AI analysis
  const searchHealthData = async (query: string, options?: HealthDataSearchOptions): Promise<HealthDataSearchResult> => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      loading.value = true
      
      const searchOptions = { ...healthSearchOptions.value, ...options }
      const result = await searchUserHealthData(authStore.user.id, query, searchOptions)
      
      return result
    } catch (error) {
      console.error('Error searching health data:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Generate health insights for common categories
  const getHealthInsights = async (
    insightType: 'sleep' | 'activity' | 'heart_rate' | 'general',
    timeRange?: { start: string; end: string }
  ): Promise<HealthDataSearchResult> => {
    if (!authStore.user) throw new Error('Not authenticated')

    try {
      loading.value = true
      
      const result = await generateHealthInsights(authStore.user.id, insightType, timeRange)
      
      return result
    } catch (error) {
      console.error('Error generating health insights:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Toggle health context for chat
  const toggleHealthContext = (enabled: boolean) => {
    healthContextEnabled.value = enabled
  }

  // Update health search options
  const updateHealthSearchOptions = (options: Partial<HealthDataSearchOptions>) => {
    healthSearchOptions.value = { ...healthSearchOptions.value, ...options }
  }



  // Delete message
  const deleteMessage = async (id: string) => {
    try {
      if (!authStore.user) return
      
      await azureCosmos.deleteChatMessage(id, authStore.user.id)
      messages.value = messages.value.filter(m => m.id !== id)
    } catch (error) {
      console.error('Error deleting message:', error)
      throw error
    }
  }

  // Clear all messages
  const clearMessages = async () => {
    if (!authStore.user) return

    try {
      await azureCosmos.clearChatMessages(authStore.user.id)
      messages.value = []
    } catch (error) {
      console.error('Error clearing messages:', error)
      throw error
    }
  }

  return {
    // Existing state
    messages: readonly(messages),
    loading: readonly(loading),
    typing: readonly(typing),
    
    // Health context state
    healthContextEnabled: readonly(healthContextEnabled),
    lastRagContext: readonly(lastRagContext),
    healthSearchOptions: readonly(healthSearchOptions),
    
    // Existing methods
    fetchMessages,
    sendMessage,
    deleteMessage,
    clearMessages,
    
    // New health-aware methods
    sendHealthMessage,
    searchHealthData,
    getHealthInsights,
    toggleHealthContext,
    updateHealthSearchOptions,
  }
})