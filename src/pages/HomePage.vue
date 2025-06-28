<template>
  <div class="h-screen w-screen overflow-hidden">
    <div class="relative h-full w-full text-neutral-900 home-bg">
      <div class="flex flex-col items-center justify-center h-full w-full">
        <div class="w-36 h-36 flex items-center justify-center">
          <img
            src="@/assets/AIvital_logo.png"
            alt="Logo"
            class="w-36 h-36 object-contain"
          />
        </div>
        <div
          class="text-white text-5xl font-bold mb-4 text-center drop-shadow-lg font-source-sans"
        >
          Smarter Health. Powered by AI.
        </div>
        <div
          class="text-white text-lg font-light text-center drop-shadow-lg leading-[20px] max-w-3xl font-source-sans"
        >
          <div>
            Get personalized insights, smart tracking, and adaptive
            recommendations
          </div>
          <div>
            — all powered by <span class="italic font-bold">AI</span>, all built
            around you.
          </div>
        </div>

        <div class="mt-8 flex flex-col items-center">
          <button
            class="w-56 py-1 bg-white rounded-lg flex items-center justify-center shadow-lg transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 active:scale-95"
            @click="signIn()"
          >
            <span
              class="text-xl bg-gradient-to-r from-[#0068D7] to-[#4ADC75] bg-clip-text text-transparent"
              >Sign In</span
            >
          </button>
          <div
            class="text-white text-lg font-light text-center drop-shadow-lg leading-[40px] max-w-3xl font-source-sans mt-4"
          >
            How it works?
          </div>
        </div>
      </div>
    </div>

    <div class="absolute left-0 right-0 bottom-20 flex justify-center gap-20">
      <div class="flex justify-center items-center">
        <div style="transform: scale(0.8); transform-origin: top left">
          <svg
            width="38"
            height="42"
            viewBox="0 0 38 42"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M35.9 42L30.4 36.5C29.7 37.0667 28.925 37.4583 28.075 37.675C27.225 37.8917 26.3667 38 25.5 38C23.139 38 21.132 37.173 19.479 35.519C17.8263 33.865 17 31.8567 17 29.494C17 27.1313 17.827 25.125 19.481 23.475C21.135 21.825 23.1433 21 25.506 21C27.8687 21 29.875 21.8263 31.525 23.479C33.175 25.132 34 27.139 34 29.5C34 30.3667 33.8917 31.2333 33.675 32.1C33.4583 32.9667 33.0667 33.7333 32.5 34.4L38 39.9L35.9 42ZM25.493 35C27.031 35 28.3333 34.469 29.4 33.407C30.4667 32.345 31 31.045 31 29.507C31 27.969 30.469 26.6667 29.407 25.6C28.345 24.5333 27.045 24 25.507 24C23.969 24 22.6667 24.531 21.6 25.593C20.5333 26.655 20 27.955 20 29.493C20 31.031 20.531 32.3333 21.593 33.4C22.655 34.4667 23.955 35 25.493 35ZM36 19.5H33V7H30V11.5H6V7H3V37H15.5V40H3C2.13333 40 1.41667 39.7167 0.85 39.15C0.283333 38.5833 0 37.8667 0 37V7C0 6.13333 0.283333 5.41667 0.85 4.85C1.41667 4.28333 2.13333 4 3 4H13.1C13.3333 2.83333 13.9083 1.875 14.825 1.125C15.7417 0.375 16.8 0 18 0C19.2 0 20.2583 0.375 21.175 1.125C22.0917 1.875 22.6667 2.83333 22.9 4H33C33.8667 4 34.5833 4.28333 35.15 4.85C35.7167 5.41667 36 6.13333 36 7V19.5ZM18 7C18.5667 7 19.0417 6.80833 19.425 6.425C19.8083 6.04167 20 5.56667 20 5C20 4.43333 19.8083 3.95833 19.425 3.575C19.0417 3.19167 18.5667 3 18 3C17.4333 3 16.9583 3.19167 16.575 3.575C16.1917 3.95833 16 4.43333 16 5C16 5.56667 16.1917 6.04167 16.575 6.425C16.9583 6.80833 17.4333 7 18 7Z"
              fill="url(#paint0_linear_3_118)"
              style=""
            />
            <defs>
              <linearGradient
                id="paint0_linear_3_118"
                x1="19"
                y1="0"
                x2="19"
                y2="42"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  stop-color="#4ADC75"
                  style="
                    stop-color: #4adc75;
                    stop-color: color(display-p3 0.2902 0.8627 0.4588);
                    stop-opacity: 1;
                  "
                />
                <stop
                  offset="1"
                  stop-color="#0068D7"
                  style="
                    stop-color: #0068d7;
                    stop-color: color(display-p3 0 0.4078 0.8431);
                    stop-opacity: 1;
                  "
                />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="flex flex-col text-gray-400 text-sm">
          <div>Personalized</div>
          <div>Insights</div>
        </div>
      </div>

      <div class="flex justify-center items-center">
        <div style="transform: scale(0.8); transform-origin: top left">
          <svg
            width="42"
            height="37"
            viewBox="0 0 42 37"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 11.5V3C0 2.2 0.3 1.5 0.9 0.9C1.5 0.3 2.2 0 3 0H37C37.8 0 38.5 0.3 39.1 0.9C39.7 1.5 40 2.2 40 3V16H37V3H3V11.5H0ZM3 32C2.2 32 1.5 31.7 0.9 31.1C0.3 30.5 0 29.8 0 29V20.5H3V29H17.95V32H3ZM32 37L27.95 33.55C25.55 31.4833 23.9583 29.925 23.175 28.875C22.3917 27.825 22 26.7 22 25.5C22 24 22.5333 22.7083 23.6 21.625C24.6667 20.5417 25.9667 20 27.5 20C28.3667 20 29.1917 20.2 29.975 20.6C30.7583 21 31.4333 21.5833 32 22.35C32.5333 21.5833 33.1917 21 33.975 20.6C34.7583 20.2 35.6 20 36.5 20C38 20 39.2917 20.5417 40.375 21.625C41.4583 22.7083 42 24 42 25.5C42 26.7 41.5917 27.8417 40.775 28.925C39.9583 30.0083 38.25 31.65 35.65 33.85L32 37ZM32 33.05L33.6 31.65C35.8 29.7833 37.25 28.4583 37.95 27.675C38.65 26.8917 39 26.1667 39 25.5C39 24.8333 38.75 24.25 38.25 23.75C37.75 23.25 37.1667 23 36.5 23C36.0937 23 35.7253 23.0833 35.395 23.25C35.065 23.4167 34.7167 23.6833 34.35 24.05L32 26.25L29.6 24.05C29.2333 23.6833 28.882 23.4167 28.546 23.25C28.2103 23.0833 27.8617 23 27.5 23C26.8 23 26.2083 23.25 25.725 23.75C25.2417 24.25 25 24.8333 25 25.5C25 26.1667 25.4583 27.0167 26.375 28.05C27.2917 29.0833 28.6 30.2833 30.3 31.65L32 33.05ZM9.997 25.5C9.699 25.5 9.43333 25.4333 9.2 25.3C8.96667 25.1667 8.76667 24.9667 8.6 24.7L5.05 17.5H0V14.5H6C6.27233 14.5 6.52617 14.5773 6.7615 14.732C6.99683 14.8863 7.17633 15.0923 7.3 15.35L10 20.65L16.65 7.35C16.7833 7.08333 16.973 6.89167 17.219 6.775C17.465 6.65833 17.7233 6.6 17.994 6.6C18.2647 6.6 18.525 6.65833 18.775 6.775C19.025 6.89167 19.2167 7.08333 19.35 7.35L22.9 14.5H29.5V17.5H22C21.7 17.5 21.4313 17.4333 21.194 17.3C20.9563 17.1667 20.775 16.9667 20.65 16.7L17.95 11.4L11.3 24.7C11.176 24.9667 10.996 25.1667 10.76 25.3C10.5243 25.4333 10.27 25.5 9.997 25.5Z"
              fill="url(#paint0_linear_3_123)"
              style=""
            />
            <defs>
              <linearGradient
                id="paint0_linear_3_123"
                x1="21"
                y1="0"
                x2="21"
                y2="37"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  stop-color="#4ADC75"
                  style="
                    stop-color: #4adc75;
                    stop-color: color(display-p3 0.2902 0.8627 0.4588);
                    stop-opacity: 1;
                  "
                />
                <stop
                  offset="1"
                  stop-color="#0068D7"
                  style="
                    stop-color: #0068d7;
                    stop-color: color(display-p3 0 0.4078 0.8431);
                    stop-opacity: 1;
                  "
                />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="flex flex-col text-gray-400 text-sm">
          <div>Effortless</div>
          <div>Tracking</div>
        </div>
      </div>

      <div class="flex justify-center items-center">
        <div style="transform: scale(0.8); transform-origin: top left">
          <svg
            width="30"
            height="40"
            viewBox="0 0 30 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 40C14.1 40 13.3083 39.7833 12.625 39.35C11.9417 38.9167 11.5 38.3167 11.3 37.55H10.6C9.8 37.55 9.1 37.25 8.5 36.65C7.9 36.05 7.6 35.35 7.6 34.55V27.4C5.4 25.9667 3.66667 24.1333 2.4 21.9C1.13333 19.6667 0.5 17.2 0.5 14.5C0.5 10.4667 1.90833 7.04167 4.725 4.225C7.54167 1.40833 10.9667 0 15 0C19.0333 0 22.4583 1.40833 25.275 4.225C28.0917 7.04167 29.5 10.4667 29.5 14.5C29.5 17.2 28.8667 19.6667 27.6 21.9C26.3333 24.1333 24.6 25.9667 22.4 27.4V34.55C22.4 35.35 22.1 36.05 21.5 36.65C20.9 37.25 20.2 37.55 19.4 37.55H18.7C18.5 38.3167 18.0583 38.9167 17.375 39.35C16.6917 39.7833 15.9 40 15 40ZM10.6 34.55H19.4V32.35H10.6V34.55ZM10.6 30.35H19.4V28.35H10.6V30.35ZM10.15 25.35H13.85V18.5L9.25 13.9L10.8 12.35L15 16.55L19.2 12.35L20.75 13.9L16.15 18.5V25.35H19.85C21.85 24.4167 23.4583 22.9667 24.675 21C25.8917 19.0333 26.5 16.8667 26.5 14.5C26.5 11.2667 25.3917 8.54167 23.175 6.325C20.9583 4.10833 18.2333 3 15 3C11.7667 3 9.04167 4.10833 6.825 6.325C4.60833 8.54167 3.5 11.2667 3.5 14.5C3.5 16.8667 4.10833 19.0333 5.325 21C6.54167 22.9667 8.15 24.4167 10.15 25.35Z"
              fill="url(#paint0_linear_3_128)"
              style=""
            />
            <defs>
              <linearGradient
                id="paint0_linear_3_128"
                x1="15"
                y1="0"
                x2="15"
                y2="40"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  stop-color="#4ADC75"
                  style="
                    stop-color: #4adc75;
                    stop-color: color(display-p3 0.2902 0.8627 0.4588);
                    stop-opacity: 1;
                  "
                />
                <stop
                  offset="1"
                  stop-color="#0068D7"
                  style="
                    stop-color: #0068d7;
                    stop-color: color(display-p3 0 0.4078 0.8431);
                    stop-opacity: 1;
                  "
                />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="flex flex-col text-gray-400 text-sm">
          <div>Intelligent</div>
          <div>Coaching</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
const router = useRouter();

const authStore = useAuthStore();
const signIn = async () => {
  try {
    if (!authStore.initialized) {
      await authStore.initialize();
    }
    const result = await authStore.signUp();
    if (result && result.user) {
      router.push('/dashboard');
    } else {
      alert('注册失败，请重试');
    }
  } catch (error) {
    console.error('signIn error:', error);
    alert('发生错误，请重试');
  }
};

// const vitalConcepts = [
//   { letter: 'V', word: 'Visualization' },
//   { letter: 'I', word: 'Insight' },
//   { letter: 'T', word: 'Tracking' },
//   { letter: 'A', word: 'Adaptation' },
//   { letter: 'L', word: 'Lifestyle' },
// ];
</script>

<style scoped>
.home-bg {
  position: relative;
  width: 100vw;
  min-height: 95vh;
  max-height: 95vh;
  overflow: hidden;
  clip-path: ellipse(70% 70% at 50% 15%);
}
.home-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #fff;
}
.home-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(0deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)),
    url('@/assets/terry-zhong-mqQ0pLzaP88-unsplash.jpg') center center/cover
      no-repeat;
}
.home-bg > * {
  position: relative;
  z-index: 2;
}

.font-source-sans {
  font-family:
    'Source Sans Pro', 'Helvetica Neue', Arial, 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}
</style>
