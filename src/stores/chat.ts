import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'
import { azureCosmos } from '@/services/azureCosmos'
import type { ChatMessage } from '@/types'
import { useAuthStore } from './auth'

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

  // Generate AI response (mock implementation)
  const generateAIResponse = async (userMessage: string): Promise<string> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

    const message = userMessage.toLowerCase()
    
    // Health-related responses
    if (message.includes('blood pressure')) {
      return "Blood pressure is an important indicator of cardiovascular health. Normal blood pressure is typically around 120/80 mmHg. If you're concerned about your readings, consider tracking them regularly and discussing patterns with your healthcare provider."
    }
    
    if (message.includes('weight') || message.includes('lose weight')) {
      return "Weight management involves a combination of healthy eating, regular physical activity, and lifestyle changes. Focus on creating sustainable habits rather than quick fixes. Consider tracking your meals and exercise to identify patterns."
    }
    
    if (message.includes('exercise') || message.includes('workout')) {
      return "Regular exercise is crucial for overall health. The CDC recommends at least 150 minutes of moderate-intensity aerobic activity per week, plus muscle-strengthening activities twice a week. Start with activities you enjoy to build consistency."
    }
    
    if (message.includes('sleep')) {
      return "Quality sleep is essential for physical and mental health. Most adults need 7-9 hours per night. Good sleep hygiene includes maintaining a consistent schedule, creating a comfortable environment, and avoiding screens before bedtime."
    }
    
    if (message.includes('stress') || message.includes('anxiety')) {
      return "Managing stress is important for overall health. Consider techniques like deep breathing, meditation, regular exercise, and maintaining social connections. If stress feels overwhelming, don't hesitate to seek professional support."
    }
    
    if (message.includes('diet') || message.includes('nutrition')) {
      return "A balanced diet rich in fruits, vegetables, whole grains, lean proteins, and healthy fats supports optimal health. Consider keeping a food diary to track your eating patterns and identify areas for improvement."
    }

    // General responses
    const responses = [
      "That's an interesting point about your health journey. Could you tell me more about your specific concerns or goals?",
      "I'm here to help you track and understand your health data. What specific metrics would you like to focus on?",
      "Health monitoring is a great way to stay aware of your wellbeing. Have you noticed any patterns in your recent data?",
      "Thank you for sharing that with me. Consistent tracking can help identify trends in your health metrics.",
      "I'd be happy to help you understand your health data better. What questions do you have about your recent measurements?",
    ]
    
    return responses[Math.floor(Math.random() * responses.length)]
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