<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0068d7] to-[#4adc75] px-4 sm:px-6 lg:px-8"
  >
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div
          class="w-36 h-36 mx-auto rounded-lg flex items-center justify-center"
        >
          <img
            src="@/assets/AIvital_logo.png"
            alt="Logo"
            class="w-36 h-36 object-contain"
          />
        </div>
        <h2 class="mt-6 text-3xl font-bold text-neutral-900">
          {{ isSignUp ? 'Create your account' : 'Sign in to your account' }}
        </h2>
        <p class="mt-2 text-sm text-neutral-600">
          {{
            isSignUp
              ? 'Start monitoring your health today'
              : 'Welcome back to Aivital'
          }}
        </p>
      </div>

      <div
        class="bg-white rounded-xl shadow-sm border border-neutral-200 px-8 py-6"
      >
        <button
          type="button"
          @click="signIn()"
          :disabled="loading"
          class="btn-primary w-full"
        >
          <div
            v-if="loading"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></div>
          {{ 'Start using Aivital' }}
        </button>
        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-neutral-300" />
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-neutral-500">
                {{ isSignUp ? 'Already have an account?' : 'New to Aivital?' }}
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
    <div
      v-if="showResetPassword"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-neutral-900 mb-4">
          Reset Password
        </h3>
        <form @submit.prevent="handleResetPassword">
          <div class="mb-4">
            <label
              for="resetEmail"
              class="block text-sm font-medium text-neutral-700"
            >
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
          <div
            v-if="resetError"
            class="mb-4 bg-error-50 border border-error-200 rounded-lg p-3"
          >
            <p class="text-sm text-error-700">{{ resetError }}</p>
          </div>
          <div
            v-if="resetSuccess"
            class="mb-4 bg-success-50 border border-success-200 rounded-lg p-3"
          >
            <p class="text-sm text-success-700">{{ resetSuccess }}</p>
          </div>
          <div class="flex space-x-3">
            <button
              type="submit"
              :disabled="loading"
              class="btn-primary flex-1"
            >
              Send Reset Link
            </button>
            <button
              type="button"
              @click="closeResetModal"
              class="btn-outline flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const signIn = async () => {
  try {
    const result = await authStore.signUp();

    if (result.needsConfirmation) {
      successMessage.value = 'Please check your email for a confirmation link.';
      return;
    } else if (result.success) {
      router.push('/dashboard');
    }
  } catch (error) {
    return;
  }
};
</script>
