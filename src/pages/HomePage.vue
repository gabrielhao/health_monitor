<template>
  <div class="min-h-screen bg-white text-neutral-900">
    <!-- Navbar -->
    <header class="flex items-center justify-between px-6 py-4 shadow-sm sticky top-0 bg-white z-50">
      <h1 class="text-2xl font-bold text-primary-600">AI Vital</h1>
      <button
        class="btn-primary"
        @click="showLogin = true"
      >
        Sign In
      </button>
    </header>

    <!-- Hero Section -->
    <section class="text-center py-20 px-6">
      <h2 class="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
        Your Health. Smarter.
      </h2>
      <p class="text-lg text-neutral-600 max-w-2xl mx-auto mb-12">
        Visualization, Insight, Tracking, Adaptation, Lifestyle — <span class="text-primary-600 font-medium">all powered by AI</span>
      </p>

      <!-- VITAL Acronym Animation -->
      <div class="flex flex-wrap justify-center gap-6 text-center">
        <div
          v-for="(item, index) in vitalConcepts"
          :key="item.word"
          class="w-40 h-40 rounded-2xl shadow-md p-4 flex flex-col items-center justify-center bg-neutral-50 hover:scale-105 transition-transform duration-500"
        >
          <p class="text-4xl font-bold text-primary-600 animate-bounce" :style="{ animationDelay: `${index * 0.2}s` }">
            {{ item.letter }}
          </p>
          <p class="mt-2 text-sm text-neutral-700 uppercase tracking-wide">{{ item.word }}</p>
        </div>
      </div>
    </section>

    <!-- Placeholder for login modal -->
    <div
      v-if="showLogin"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-white p-6 rounded-xl w-full max-w-md shadow-lg text-center">
        <h3 class="text-xl font-semibold mb-4">Sign In</h3>
        <p class="text-neutral-500">Login form placeholder</p>
        <button class="btn-secondary mt-6" @click="showLogin = false">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const showLogin = ref(false)

const vitalConcepts = [
  { letter: 'V', word: 'Visualization' },
  { letter: 'I', word: 'Insight' },
  { letter: 'T', word: 'Tracking' },
  { letter: 'A', word: 'Adaptation' },
  { letter: 'L', word: 'Lifestyle' },
]
</script>

<style scoped>
@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
.animate-bounce {
  animation: bounce 1.6s infinite;
}
.btn-primary {
  @apply px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition;
}
.btn-secondary {
  @apply px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition;
}
</style>
