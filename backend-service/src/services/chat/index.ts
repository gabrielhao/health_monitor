import { chatService } from './chatService.js'

export async function initializeChatService(): Promise<void> {
  try {
    await chatService.initialize()
    console.log('Chat service initialized successfully')
  } catch (error) {
    console.error('Failed to initialize chat service:', error)
    throw error
  }
}

export { chatService }
export * from './routes/chat.js' 