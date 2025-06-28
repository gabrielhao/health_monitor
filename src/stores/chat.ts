import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'
import { azureCosmos } from '@/services/azureCosmos'
import type { ChatMessage } from '@/types'
import { useAuthStore } from './auth'
import { generateAIResponse } from '@/services/chatApi'

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()
  
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const typing = ref(false)

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
    messages: readonly(messages),
    loading: readonly(loading),
    typing: readonly(typing),
    fetchMessages,
    sendMessage,
    deleteMessage,
    clearMessages,
  }
})