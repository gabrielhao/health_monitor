<template>
  <div
    class="min-h-screen text-neutral-900 bg-gradient-to-br from-[#0068d7] to-[#4adc75]"
  >
    <!-- Navbar -->
    <header
      class="flex items-center justify-between shadow-sm px-4 sticky top-0 bg-white/20 backdrop-blur z-50"
    >
      <div class="w-24 h-24 rounded-lg flex items-center justify-center">
        <img
          src="@/assets/AIvital_logo.png"
          alt="Logo"
          class="w-24 h-24 object-contain"
        />
      </div>
      <button class="btn-primary" @click="goToAuth">Sign In</button>
    </header>

    <!-- Hero Section -->
    <section class="text-center py-20 px-6">
      <div class="bg-white/20 rounded-2xl shadow-lg max-w-5xl mx-auto p-8">
        <h2 class="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
          Your Health. Smarter.
        </h2>
        <p class="text-lg text-neutral-600 max-w-5xl mx-auto mb-12">
          Visualization, Insight, Tracking, Adaptation, Lifestyle —
          <span class="text-[#0068d7] font-medium">all powered by AI</span>
        </p>

        <!-- VITAL Acronym Animation -->
        <div class="flex flex-wrap justify-center gap-6 text-center">
          <div
            v-for="(item, index) in vitalConcepts"
            :key="item.word"
            class="w-40 h-40 rounded-2xl shadow-md p-4 flex flex-col items-center justify-center bg-white/40 hover:scale-105 transition-transform duration-500"
          >
            <p
              class="text-6xl font-bold text-white/40 animate-bounce"
              :style="{ animationDelay: `${index * 0.2}s` }"
            >
              {{ item.letter }}
            </p>
            <p class="mt-2 text-sm text-neutral-700 uppercase tracking-wide">
              {{ item.word }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const showLogin = ref(false);

const router = useRouter();
const goToAuth = () => {
  router.push('/auth');
};

const vitalConcepts = [
  { letter: 'V', word: 'Visualization' },
  { letter: 'I', word: 'Insight' },
  { letter: 'T', word: 'Tracking' },
  { letter: 'A', word: 'Adaptation' },
  { letter: 'L', word: 'Lifestyle' },
];
</script>

<style scoped>
@keyframes bounce {
  0%,
  100% {
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
  @apply px-4 py-2 bg-[#0068d7] text-white rounded-lg hover:bg-[#0050a8] transition;
}
.btn-secondary {
  @apply px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition;
}
</style>
