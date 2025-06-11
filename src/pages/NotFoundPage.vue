<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full text-center">
      <div class="mb-8">
        <h1 class="text-9xl font-bold text-primary-600">404</h1>
        <h2 class="text-2xl font-semibold text-neutral-900 mt-4">Page not found</h2>
        <p class="text-neutral-600 mt-2">
          Sorry, we couldn't find the page you're looking for.
        </p>
      </div>
      
      <div class="space-y-4">
        <router-link to="/dashboard" class="btn-primary w-full">
          Go to Dashboard
        </router-link>
        <button @click="$router.go(-1)" class="btn-outline w-full">
          Go Back
        </button>
      </div>
    </div>
  </div>
</template>