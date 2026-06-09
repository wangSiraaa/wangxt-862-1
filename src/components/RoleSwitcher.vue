<template>
  <div class="role-switcher" data-testid="role-switcher">
    <div class="role-buttons flex gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700">
      <button
        v-for="r in roles"
        :key="r.value"
        :data-testid="'role-btn-' + r.value"
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
        :class="[
          store.currentUser.role === r.value
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'text-slate-300 hover:bg-slate-700/70'
        ]"
        @click="store.setRole(r.value)"
      >
        <span class="mr-1">{{ r.icon }}</span>
        {{ r.label }}
      </button>
    </div>
    <div class="user-chip flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-lg border border-slate-600">
      <span class="text-xl">{{ store.currentUser.avatar }}</span>
      <div class="text-left">
        <div class="text-sm font-semibold text-white">{{ store.currentUser.name }}</div>
        <div class="text-[11px] text-slate-400">{{ store.currentUser.team }} · {{ store.currentUser.area }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMainStore } from '@/stores/main'
import type { UserRole } from '@/types'
import { ROLE_LABELS } from '@/types'

const store = useMainStore()

const roles: { value: UserRole; label: string; icon: string }[] = [
  { value: 'commander', label: ROLE_LABELS.commander, icon: '🎖️' },
  { value: 'grid', label: ROLE_LABELS.grid, icon: '🧑‍💼' },
  { value: 'patrol', label: ROLE_LABELS.patrol, icon: '🚓' },
  { value: 'inspector', label: ROLE_LABELS.inspector, icon: '🕵️' }
]
</script>

<style scoped>
.role-switcher {
  display: flex;
  align-items: center;
  gap: 1rem;
}
</style>
