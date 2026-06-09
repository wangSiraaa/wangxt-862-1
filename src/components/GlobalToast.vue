<template>
  <Teleport to="body">
    <Transition name="toast-fade">
      <div
        v-if="store.lastError || store.lastSuccess"
        :key="store.toastId"
        class="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-lg px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md border"
        :class="[
          store.lastError
            ? 'bg-red-900/90 border-red-500/50 text-red-100'
            : 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100'
        ]"
      >
        <div class="flex items-start gap-3">
          <span class="text-xl shrink-0">{{ store.lastError ? '⚠️' : '✅' }}</span>
          <div class="flex-1">
            <div class="font-semibold text-sm">
              {{ store.lastError ? '操作被阻止' : '操作成功' }}
            </div>
            <div class="text-sm opacity-90 mt-1 whitespace-pre-line">
              {{ store.lastError || store.lastSuccess }}
            </div>
          </div>
          <button
            class="shrink-0 opacity-80 hover:opacity-100 p-1"
            @click="store.lastError = null; store.lastSuccess = null"
          >
            ✕
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useMainStore } from '@/stores/main'
const store = useMainStore()
</script>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
