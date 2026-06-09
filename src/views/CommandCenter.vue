<template>
  <div class="command-center w-full h-full flex flex-col" data-testid="command-center">
    <header class="shrink-0 px-5 py-3 border-b border-slate-700 bg-slate-900/80 backdrop-blur flex items-center justify-between gap-4 z-20">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold text-white flex items-center gap-2">
          <span class="text-2xl">🗺️</span>
          <span>布控网格热力图</span>
          <span class="ml-2 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full border border-slate-600">
            离线指挥中心 v1.0
          </span>
        </h1>
        <span class="text-xs text-slate-400 hidden md:block">
          端口 9528 · 状态持久化至 URL+localStorage · 刷新可恢复
        </span>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="store.currentUser.role === 'commander'"
          class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition"
          data-testid="open-create-task"
          @click="showCreate = true"
        >
          ＋ 新建布控任务
        </button>
        <button
          class="px-3 py-1.5 rounded-lg text-sm border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
          data-testid="export-audit-btn"
          @click="store.exportAudit()"
        >📥 导出审计</button>
        <RoleSwitcher />
      </div>
    </header>

    <main class="flex-1 min-h-0 grid grid-cols-12 gap-3 p-3 overflow-hidden">
      <aside class="col-span-12 md:col-span-3 flex flex-col min-h-0 gap-3 overflow-hidden">
        <FilterBar />
        <div class="flex-1 min-h-0 overflow-hidden">
          <EventList />
        </div>
      </aside>
      <section class="col-span-12 md:col-span-9 min-h-0 overflow-hidden relative">
        <HeatMap />
      </section>
    </main>

    <EventDrawer />
    <CreateTaskModal :show="showCreate" @close="showCreate = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMainStore } from '@/stores/main'
import RoleSwitcher from '@/components/RoleSwitcher.vue'
import FilterBar from '@/components/FilterBar.vue'
import EventList from '@/components/EventList.vue'
import HeatMap from '@/components/HeatMap.vue'
import EventDrawer from '@/components/EventDrawer.vue'
import CreateTaskModal from '@/components/CreateTaskModal.vue'

const store = useMainStore()
const showCreate = ref(false)
</script>
