import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      buffer: 'buffer',
    },
  },
  define: {
    __VUE_PROD_DEVTOOLS__: false,
    global: 'globalThis',
    VITE_AZURE_CLIENT_ID: JSON.stringify(process.env.VITE_AZURE_CLIENT_ID),
    VITE_AZURE_TENANT_ID: JSON.stringify(process.env.VITE_AZURE_TENANT_ID),
    VITE_AZURE_EXTERNAL_ID_DOMAIN: JSON.stringify(process.env.VITE_AZURE_EXTERNAL_ID_DOMAIN),
    VITE_AZURE_KNOWN_AUTHORITIES: JSON.stringify(process.env.VITE_AZURE_KNOWN_AUTHORITIES),
    VITE_AZURE_COSMOS_CONNECTION_STRING: JSON.stringify(process.env.VITE_AZURE_COSMOS_CONNECTION_STRING),
    VITE_AZURE_COSMOS_DATABASE: JSON.stringify(process.env.VITE_AZURE_COSMOS_DATABASE),
    VITE_AZURE_STORAGE_ACCOUNT: JSON.stringify(process.env.VITE_AZURE_STORAGE_ACCOUNT),
    VITE_AZURE_STORAGE_CONTAINER: JSON.stringify(process.env.VITE_AZURE_STORAGE_CONTAINER),
    VITE_AZURE_STORAGE_CONNECTION_STRING: JSON.stringify(process.env.VITE_AZURE_STORAGE_CONNECTION_STRING),
    VITE_BACKEND_SERVICE_URL: JSON.stringify(process.env.VITE_BACKEND_SERVICE_URL),
    VITE_APP_NAME: JSON.stringify(process.env.VITE_APP_NAME),
    VITE_APP_VERSION: JSON.stringify(process.env.VITE_APP_VERSION),
    VITE_ENVIRONMENT: JSON.stringify(process.env.VITE_ENVIRONMENT),
  },
  optimizeDeps: {
    include: ['buffer']
  }
})