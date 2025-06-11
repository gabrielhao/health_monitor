<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="mx-auto w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center">
          <HeartIcon class="w-8 h-8 text-white" />
        </div>
        <h2 class="mt-6 text-3xl font-bold text-neutral-900">
          {{ isSignUp ? 'Create your account' : 'Sign in to your account' }}
        </h2>
        <p class="mt-2 text-sm text-neutral-600">
          {{ isSignUp ? 'Start monitoring your health today' : 'Welcome back to HealthMonitor' }}
        </p>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-neutral-200 px-8 py-6">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div v-if="isSignUp" class="space-y-4">
            <div>
              <label for="fullName" class="block text-sm font-medium text-neutral-700">
                Full Name
              </label>
              <input
                id="fullName"
                v-model="form.fullName"
                type="text"
                class="input-field mt-1"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-neutral-700">
              Email address
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              class="input-field mt-1"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-neutral-700">
              Password
            </label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              required
              class="input-field mt-1"
              placeholder="Enter your password"
            />
          </div>

          <div v-if="isSignUp">
            <label for="confirmPassword" class="block text-sm font-medium text-neutral-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              type="password"
              required
              class="input-field mt-1"
              placeholder="Confirm your password"
            />
          </div>

          <div v-if="error" class="bg-error-50 border border-error-200 rounded-lg p-3">
            <p class="text-sm text-error-700">{{ error }}</p>
          </div>

          <div v-if="successMessage" class="bg-success-50 border border-success-200 rounded-lg p-3">
            <p class="text-sm text-success-700">{{ successMessage }}</p>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="btn-primary w-full"
          >
            <div v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            {{ isSignUp ? 'Create Account' : 'Sign In' }}
          </button>
        </form>

        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-neutral-300" />
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-neutral-500">
                {{ isSignUp ? 'Already have an account?' : 'New to HealthMonitor?' }}
              </span>
            </div>
          </div>

          <button
            @click="toggleMode"
            class="mt-4 w-full text-center text-sm text-primary-600 hover:text-primary-500 transition-colors duration-200"
          >
            {{ isSignUp ? 'Sign in instead' : 'Create an account' }}
          </button>
        </div>

        <div v-if="!isSignUp" class="mt-4 text-center">
          <button
            @click="showResetPassword = true"
            class="text-sm text-primary-600 hover:text-primary-500 transition-colors duration-200"
          >
            Forgot your password?
          </button>
        </div>
      </div>
    </div>

    <!-- Reset Password Modal -->
    <div v-if="showResetPassword" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">Reset Password</h3>
        <form @submit.prevent="handleResetPassword">
          <div class="mb-4">
            <label for="resetEmail" class="block text-sm font-medium text-neutral-700">
              Email address
            </label>
            <input
              id="resetEmail"
              v-model="resetEmail"
              type="email"
              required
              class="input-field mt-1"
              placeholder="Enter your email"
            />
          </div>
          <div class="flex space-x-3">
            <button type="submit" :disabled="loading" class="btn-primary flex-1">
              Send Reset Link
            </button>
            <button type="button" @click="showResetPassword = false" class="btn-outline flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { HeartIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const authStore = useAuthStore()

const isSignUp = ref(false)
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const showResetPassword = ref(false)
const resetEmail = ref('')

const form = reactive({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const toggleMode = () => {
  isSignUp.value = !isSignUp.value
  error.value = ''
  successMessage.value = ''
  resetForm()
}

const resetForm = () => {
  form.fullName = ''
  form.email = ''
  form.password = ''
  form.confirmPassword = ''
}

const handleSubmit = async () => {
  error.value = ''
  successMessage.value = ''

  // Validation
  if (isSignUp.value && form.password !== form.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }

  if (form.password.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return
  }

  try {
    loading.value = true

    if (isSignUp.value) {
      const result = await authStore.signUp(form.email, form.password, {
        full_name: form.fullName,
      })

      if (result.needsConfirmation) {
        successMessage.value = 'Please check your email for a confirmation link.'
        return
      }
    } else {
      await authStore.signIn(form.email, form.password)
    }

    router.push('/dashboard')
  } catch (err: any) {
    error.value = err.message || 'An error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

const handleResetPassword = async () => {
  try {
    loading.value = true
    await authStore.resetPassword(resetEmail.value)
    successMessage.value = 'Password reset link sent to your email.'
    showResetPassword.value = false
    resetEmail.value = ''
  } catch (err: any) {
    error.value = err.message || 'An error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>