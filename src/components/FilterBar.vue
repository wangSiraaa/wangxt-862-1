<template>
  <div class="filter-bar rounded-xl bg-slate-900/70 border border-slate-700 p-4 space-y-3" data-testid="filter-bar">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-slate-200 flex items-center gap-2">
        🔍 筛选条件
        <span
          v-if="activeFilterCount > 0"
          class="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full"
        >{{ activeFilterCount }}</span>
      </h3>
      <button
        class="text-xs text-slate-400 hover:text-blue-400 transition"
        @click="store.resetFilters()"
        data-testid="reset-filters"
      >重置</button>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="text-xs text-slate-400 block mb-1">严重等级</label>
        <select
          v-model="store.urlState.filters.severity"
          class="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-100"
          data-testid="filter-severity"
          @change="(e) => store.updateFilters({ severity: (e.target as HTMLSelectElement).value as EventSeverity | 'all' })"
        >
          <option value="all">全部</option>
          <option v-for="v in severityOptions" :key="v.value" :value="v.value">{{ v.label }}</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-slate-400 block mb-1">当前状态</label>
        <select
          v-model="store.urlState.filters.status"
          class="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-100"
          data-testid="filter-status"
          @change="(e) => store.updateFilters({ status: (e.target as HTMLSelectElement).value as EventStatus | 'all' })"
        >
          <option value="all">全部</option>
          <option v-for="v in statusOptions" :key="v.value" :value="v.value">{{ v.label }}</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-slate-400 block mb-1">所属网格</label>
        <select
          v-model="store.urlState.filters.gridId"
          class="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-100"
          data-testid="filter-grid"
          @change="(e) => store.updateFilters({ gridId: (e.target as HTMLSelectElement).value })"
        >
          <option value="all">全部</option>
          <option v-for="g in store.grids" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-slate-400 block mb-1">处理角色</label>
        <select
          v-model="store.urlState.filters.assigneeRole"
          class="w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-100"
          data-testid="filter-role"
          @change="(e) => store.updateFilters({ assigneeRole: (e.target as HTMLSelectElement).value as UserRole | 'all' })"
        >
          <option value="all">全部</option>
          <option value="grid">网格员</option>
          <option value="patrol">巡逻队</option>
        </select>
      </div>
    </div>
    <div>
      <label class="text-xs text-slate-400 block mb-1">关键词</label>
      <input
        v-model="store.urlState.filters.keyword"
        type="text"
        placeholder="搜索标题/地址/处理人..."
        class="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
        data-testid="filter-keyword"
        @input="debounceStore()"
      />
    </div>
    <div class="flex flex-wrap gap-3 pt-1">
      <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          v-model="store.urlState.filters.onlyUnclosed"
          data-testid="filter-only-unclosed"
          @change="store.updateFilters({})"
        />
        仅未结案
      </label>
      <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          v-model="store.urlState.filters.onlyOverdue"
          data-testid="filter-only-overdue"
          @change="store.updateFilters({})"
        />
        仅超时
      </label>
      <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          v-model="store.urlState.filters.onlyFlagged"
          data-testid="filter-only-flagged"
          @change="store.updateFilters({})"
        />
        仅督导标记
      </label>
    </div>
    <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-700/60">
      <span>共匹配 {{ store.filteredEvents.length }} 条事件</span>
      <span>总计 {{ store.events.length }} 条</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMainStore } from '@/stores/main'
import { SEVERITY_LABELS, STATUS_LABELS, type EventSeverity, type EventStatus, type UserRole } from '@/types'

const store = useMainStore()

const severityOptions = Object.entries(SEVERITY_LABELS).map(([value, label]) => ({
  value,
  label
}))
const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label
}))

const activeFilterCount = computed(() => {
  const f = store.urlState.filters
  let n = 0
  if (f.severity !== 'all') n++
  if (f.status !== 'all') n++
  if (f.gridId !== 'all') n++
  if (f.assigneeRole !== 'all') n++
  if (f.keyword) n++
  if (f.onlyOverdue) n++
  if (f.onlyFlagged) n++
  if (!f.onlyUnclosed) n++
  return n
})

const timer = ref<number | null>(null)
function debounceStore() {
  if (timer.value) window.clearTimeout(timer.value)
  timer.value = window.setTimeout(() => store.updateFilters({}), 200)
}
</script>
