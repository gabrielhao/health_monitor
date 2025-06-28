<template>
  <div class="h-screen flex flex-col bg-neutral-50/60">
    <!-- Header -->
    <div class="bg-white border-b border-neutral-200 px-6 py-4">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 bg-secondary-100 rounded-full flex items-center justify-center">
          <CpuChipIcon class="w-6 h-6 text-secondary-600" />
        </div>
        <div>
          <h1 class="text-xl font-semibold text-neutral-900">Health Assistant</h1>
          <p class="text-sm text-neutral-500">Your AI-powered health companion</p>
        </div>
        <div v-if="chatStore.typing" class="ml-auto flex items-center space-x-2 text-sm text-neutral-500">
          <div class="flex space-x-1">
            <div class="w-2 h-2 bg-secondary-400 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-secondary-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-secondary-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          </div>
          <span>AI is typing...</span>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 space-y-4">
      <div v-if="chatStore.loading && chatStore.messages.length === 0" class="flex justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>

      <div v-else-if="chatStore.messages.length === 0" class="text-center py-12">
        <div class="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ChatBubbleLeftRightIcon class="w-8 h-8 text-secondary-600" />
        </div>
        <h3 class="text-lg font-medium text-neutral-900 mb-2">Start a conversation</h3>
        <p class="text-neutral-500 mb-6 max-w-md mx-auto">
          Ask me about your health metrics, get advice on wellness, or discuss your health goals.
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            @click="sendSuggestion(suggestion)"
            class="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition-colors duration-200"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <div v-else>
        <div
          v-for="message in chatStore.messages"
          :key="message.id"
          :class="`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`"
        >
          <div
            :class="`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
              message.sender_type === 'user'
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-neutral-200 text-neutral-900'
            }`"
          >
            <p class="text-sm">{{ message.message }}</p>
            <p
              :class="`text-xs mt-1 ${
                message.sender_type === 'user' ? 'text-primary-100' : 'text-neutral-500'
              }`"
            >
              {{ formatDate(message.created_at) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Message Input -->
    <div class="bg-white border-t border-neutral-200 p-4">
      <form @submit.prevent="sendMessage" class="flex space-x-4">
        <div class="flex-1">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Type your message..."
            class="input-field"
            :disabled="chatStore.typing || sending"
          />
        </div>
        <button
          type="submit"
          :disabled="!newMessage.trim() || chatStore.typing || sending"
          class="btn-primary px-6"
        >
          <div v-if="sending" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <PaperAirplaneIcon v-else class="w-5 h-5" />
        </button>
      </form>

      <div v-if="error" class="mt-3 bg-error-50 border border-error-200 rounded-lg p-3">
        <p class="text-sm text-error-700">{{ error }}</p>
      </div>
    </div>

    <!-- Clear Chat Button (when messages exist) -->
    <div v-if="chatStore.messages.length > 0" class="bg-white border-t border-neutral-200 px-6 py-3">
      <button
        @click="showClearConfirm = true"
        class="text-sm text-neutral-500 hover:text-red-600 transition-colors duration-200"
      >
        Clear conversation
      </button>
    </div>

    <!-- Clear Confirmation Modal -->
    <div v-if="showClearConfirm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">Clear Conversation</h3>
        <p class="text-neutral-600 mb-6">
          Are you sure you want to clear all messages? This action cannot be undone.
        </p>
        <div class="flex space-x-3">
          <button @click="clearChat" :disabled="clearing" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1">
            Clear
          </button>
          <button @click="showClearConfirm = false" class="btn-outline flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { format } from 'date-fns'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  CpuChipIcon,
} from '@heroicons/vue/24/outline'

const chatStore = useChatStore()

const newMessage = ref('')
const sending = ref(false)
const error = ref('')
const showClearConfirm = ref(false)
const clearing = ref(false)
const messagesContainer = ref<HTMLElement>()

const suggestions = [
  'How can I track my blood pressure?',
  'What should I know about my heart rate?',
  'Tips for better sleep hygiene',
  'How to maintain a healthy weight?',
]

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim()) return

  error.value = ''
  const message = newMessage.value.trim()
  newMessage.value = ''

  try {
    sending.value = true
    await chatStore.sendMessage(message)
    await scrollToBottom()
  } catch (err: any) {
    error.value = err.message || 'Failed to send message'
    newMessage.value = message // Restore message on error
  } finally {
    sending.value = false
  }
}

const sendSuggestion = async (suggestion: string) => {
  newMessage.value = suggestion
  await sendMessage()
}

const clearChat = async () => {
  try {
    clearing.value = true
    await chatStore.clearMessages()
    showClearConfirm.value = false
  } catch (err: any) {
    error.value = err.message || 'Failed to clear messages'
  } finally {
    clearing.value = false
  }
}

const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'HH:mm')
}

onMounted(async () => {
  await chatStore.fetchMessages()
  await scrollToBottom()
})
</script>