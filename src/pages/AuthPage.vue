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
      </div>

      <div class="bg-white/25 rounded-xl shadow-sm px-8 py-6">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
