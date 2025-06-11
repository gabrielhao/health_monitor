<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-neutral-900">Profile Settings</h1>
      <p class="text-neutral-600 mt-1">Manage your account and privacy settings</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Profile Information -->
      <div class="lg:col-span-2">
        <div class="card">
          <h2 class="text-xl font-semibold text-neutral-900 mb-6">Personal Information</h2>
          
          <form @submit.prevent="handleUpdateProfile">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Full Name
                </label>
                <input
                  v-model="profileForm.full_name"
                  type="text"
                  class="input-field"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Email
                </label>
                <input
                  :value="authStore.userEmail"
                  type="email"
                  class="input-field bg-neutral-50"
                  disabled
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Date of Birth
                </label>
                <input
                  v-model="profileForm.date_of_birth"
                  type="date"
                  class="input-field"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Gender
                </label>
                <select v-model="profileForm.gender" class="input-field">
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Height (cm)
                </label>
                <input
                  v-model.number="profileForm.height"
                  type="number"
                  class="input-field"
                  placeholder="170"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  v-model.number="profileForm.weight"
                  type="number"
                  step="0.1"
                  class="input-field"
                  placeholder="70.0"
                />
              </div>

              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-neutral-700 mb-1">
                  Emergency Contact
                </label>
                <input
                  v-model="profileForm.emergency_contact"
                  type="text"
                  class="input-field"
                  placeholder="Name and phone number"
                />
              </div>
            </div>

            <div class="mt-6">
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Medical Conditions
              </label>
              <div class="flex flex-wrap gap-2 mb-2">
                <span
                  v-for="(condition, index) in profileForm.medical_conditions"
                  :key="index"
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-error-100 text-error-800"
                >
                  {{ condition }}
                  <button
                    type="button"
                    @click="removeCondition(index)"
                    class="ml-2 text-error-600 hover:text-error-800"
                  >
                    <XMarkIcon class="w-4 h-4" />
                  </button>
                </span>
              </div>
              <div class="flex space-x-2">
                <input
                  v-model="newCondition"
                  type="text"
                  class="input-field flex-1"
                  placeholder="Add medical condition"
                  @keyup.enter="addCondition"
                />
                <button
                  type="button"
                  @click="addCondition"
                  class="btn-outline"
                >
                  Add
                </button>
              </div>
            </div>

            <div class="mt-6">
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Medications
              </label>
              <div class="flex flex-wrap gap-2 mb-2">
                <span
                  v-for="(medication, index) in profileForm.medications"
                  :key="index"
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800"
                >
                  {{ medication }}
                  <button
                    type="button"
                    @click="removeMedication(index)"
                    class="ml-2 text-primary-600 hover:text-primary-800"
                  >
                    <XMarkIcon class="w-4 h-4" />
                  </button>
                </span>
              </div>
              <div class="flex space-x-2">
                <input
                  v-model="newMedication"
                  type="text"
                  class="input-field flex-1"
                  placeholder="Add medication"
                  @keyup.enter="addMedication"
                />
                <button
                  type="button"
                  @click="addMedication"
                  class="btn-outline"
                >
                  Add
                </button>
              </div>
            </div>

            <div v-if="error" class="mt-6 bg-error-50 border border-error-200 rounded-lg p-3">
              <p class="text-sm text-error-700">{{ error }}</p>
            </div>

            <div v-if="success" class="mt-6 bg-success-50 border border-success-200 rounded-lg p-3">
              <p class="text-sm text-success-700">{{ success }}</p>
            </div>

            <div class="flex justify-end mt-8">
              <button
                type="submit"
                :disabled="authStore.loading"
                class="btn-primary"
              >
                <div v-if="authStore.loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Privacy Settings -->
      <div class="space-y-6">
        <div class="card">
          <h2 class="text-xl font-semibold text-neutral-900 mb-6">Privacy Settings</h2>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-neutral-900">Data Sharing</p>
                <p class="text-sm text-neutral-500">Allow sharing anonymized data for research</p>
              </div>
              <button
                @click="togglePrivacySetting('data_sharing')"
                :class="`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  profileForm.privacy_settings.data_sharing ? 'bg-primary-600' : 'bg-neutral-200'
                }`"
              >
                <span
                  :class="`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    profileForm.privacy_settings.data_sharing ? 'translate-x-6' : 'translate-x-1'
                  }`"
                />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-neutral-900">Analytics</p>
                <p class="text-sm text-neutral-500">Enable health analytics and insights</p>
              </div>
              <button
                @click="togglePrivacySetting('analytics')"
                :class="`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  profileForm.privacy_settings.analytics ? 'bg-primary-600' : 'bg-neutral-200'
                }`"
              >
                <span
                  :class="`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    profileForm.privacy_settings.analytics ? 'translate-x-6' : 'translate-x-1'
                  }`"
                />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-neutral-900">Notifications</p>
                <p class="text-sm text-neutral-500">Receive health reminders and alerts</p>
              </div>
              <button
                @click="togglePrivacySetting('notifications')"
                :class="`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  profileForm.privacy_settings.notifications ? 'bg-primary-600' : 'bg-neutral-200'
                }`"
              >
                <span
                  :class="`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    profileForm.privacy_settings.notifications ? 'translate-x-6' : 'translate-x-1'
                  }`"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Account Actions -->
        <div class="card">
          <h2 class="text-xl font-semibold text-neutral-900 mb-6">Account</h2>
          
          <div class="space-y-4">
            <button class="w-full btn-outline text-left">
              <DocumentArrowDownIcon class="w-5 h-5 mr-3" />
              Export My Data
            </button>
            
            <button class="w-full btn-outline text-left text-red-600 border-red-300 hover:bg-red-50">
              <TrashIcon class="w-5 h-5 mr-3" />
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  XMarkIcon,
  DocumentArrowDownIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import type { UserProfile, PrivacySettings } from '@/types'

const authStore = useAuthStore()

const error = ref('')
const success = ref('')
const newCondition = ref('')
const newMedication = ref('')

const profileForm = reactive({
  full_name: '',
  date_of_birth: '',
  gender: '',
  height: 0,
  weight: 0,
  emergency_contact: '',
  medical_conditions: [] as string[],
  medications: [] as string[],
  privacy_settings: {
    data_sharing: false,
    analytics: true,
    notifications: true,
  } as PrivacySettings,
})

const loadProfile = () => {
  if (authStore.profile) {
    const profile = authStore.profile
    profileForm.full_name = profile.full_name || ''
    profileForm.date_of_birth = profile.date_of_birth || ''
    profileForm.gender = profile.gender || ''
    profileForm.height = profile.height || 0
    profileForm.weight = profile.weight || 0
    profileForm.emergency_contact = profile.emergency_contact || ''
    profileForm.medical_conditions = [...(profile.medical_conditions || [])]
    profileForm.medications = [...(profile.medications || [])]
    profileForm.privacy_settings = { ...profile.privacy_settings }
  }
}

const addCondition = () => {
  if (newCondition.value.trim()) {
    profileForm.medical_conditions.push(newCondition.value.trim())
    newCondition.value = ''
  }
}

const removeCondition = (index: number) => {
  profileForm.medical_conditions.splice(index, 1)
}

const addMedication = () => {
  if (newMedication.value.trim()) {
    profileForm.medications.push(newMedication.value.trim())
    newMedication.value = ''
  }
}

const removeMedication = (index: number) => {
  profileForm.medications.splice(index, 1)
}

const togglePrivacySetting = (setting: keyof PrivacySettings) => {
  profileForm.privacy_settings[setting] = !profileForm.privacy_settings[setting]
}

const handleUpdateProfile = async () => {
  error.value = ''
  success.value = ''

  try {
    const updates: Partial<UserProfile> = {
      full_name: profileForm.full_name || null,
      date_of_birth: profileForm.date_of_birth || null,
      gender: profileForm.gender || null,
      height: profileForm.height || null,
      weight: profileForm.weight || null,
      emergency_contact: profileForm.emergency_contact || null,
      medical_conditions: profileForm.medical_conditions,
      medications: profileForm.medications,
      privacy_settings: profileForm.privacy_settings,
    }

    await authStore.updateProfile(updates)
    success.value = 'Profile updated successfully!'
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err: any) {
    error.value = err.message || 'Failed to update profile'
  }
}

// Watch for profile changes
watch(() => authStore.profile, loadProfile, { immediate: true })

onMounted(() => {
  loadProfile()
})
</script>