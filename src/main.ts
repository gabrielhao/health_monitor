// Buffer polyfill for Azure SDK
import { Buffer } from 'buffer'
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer
}
if (typeof global !== 'undefined') {
  (global as any).Buffer = Buffer
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')