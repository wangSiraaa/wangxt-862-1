<template>
  <div class="event-list h-full flex flex-col bg-slate-900/70 rounded-xl border border-slate-700 overflow-hidden" data-testid="event-list">
    <div class="p-3 border-b border-slate-700 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
        📋 事件列表
        <span class="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
          稳定排序
        </span>
      </h3>
      <div class="flex items-center gap-1 text-[10px] text-slate-400">
        <span title="未结案优先">📌</span>
        <span title="超时优先">⏰</span>
        <span title="督导标记优先">🚩</span>
        <span title="更新时间倒序">🕒</span>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <div
        v-for="(ev, idx) in store.filteredEvents"
        :key="ev.id"
        class="event-card rounded-lg p-3 cursor-pointer transition-all border"
        :class="[
          store.urlState.selectedEventId === ev.id
            ? 'bg-blue-900/40 border-blue-500 shadow-lg shadow-blue-500/10'
            : 'bg-slate-800/60 border-slate-700 hover:bg-slate-700/60 hover:border-slate-600'
        ]"
        :data-testid="'event-card-' + ev.id"
        @click="store.selectEvent(ev.id)"
      >
        <div class="flex items-start gap-3">
          <div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            :style="{ background: markerBg(ev) }">
            {{ idx + 1 }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="px-2 py-0.5 text-[10px] rounded-full font-medium text-white"
                :style="{ background: sevColor(ev.severity) }"
              >{{ sevLabel(ev.severity) }}</span>
              <span
                class="px-2 py-0.5 text-[10px] rounded-full font-medium text-slate-100"
                :style="{ background: statusColor(ev.status) }"
              >{{ statusLabel(ev.status) }}</span>
              <span v-if="isOverdue(ev)" class="px-2 py-0.5 text-[10px] rounded-full bg-red-600 text-white font-medium animate-pulse">
                超时 {{ overdueMin(ev) }}分钟
              </span>
              <span v-if="ev.markedByInspector" class="px-2 py-0.5 text-[10px] rounded-full bg-purple-600 text-white font-medium">
                🚩 督导
              </span>
            </div>
            <h4 class="text-sm font-semibold text-slate-100 mt-1.5 truncate">{{ ev.title }}</h4>
            <div class="text-[11px] text-slate-400 mt-1 truncate">
              📍 {{ ev.address }}
            </div>
            <div class="flex items-center justify-between mt-2 text-[10px] text-slate-500">
              <span>🏷️ {{ ev.gridName }}</span>
              <span v-if="ev.assigneeName">👤 {{ ev.assigneeName }}</span>
              <span>v{{ ev.version }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="store.filteredEvents.length === 0" class="text-center text-slate-500 text-sm py-12">
        🭶 没有匹配的事件记录
      </div>
    </div>
    <div class="p-2 border-t border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
      <span>列表/热力/抽屉 · 排序一致</span>
      <span>更新时间 {{ new Date().toLocaleTimeString() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMainStore } from '@/stores/main'
import { SEVERITY_COLORS, SEVERITY_LABELS, STATUS_COLORS, STATUS_LABELS, CLOSED_STATUSES } from '@/types'
import { isOverdue as _isOverdue, getOverdueMinutes } from '@/services/sorting'
import type { GridEvent, EventSeverity, EventStatus } from '@/types'

const store = useMainStore()

function sevColor(s: EventSeverity) { return SEVERITY_COLORS[s] }
function sevLabel(s: EventSeverity) { return SEVERITY_LABELS[s] }
function statusColor(s: EventStatus) { return STATUS_COLORS[s] }
function statusLabel(s: EventStatus) { return STATUS_LABELS[s] }
function isOverdue(e: GridEvent) { return _isOverdue(e) }
function overdueMin(e: GridEvent) { return getOverdueMinutes(e) }

function markerBg(ev: GridEvent): string {
  if (CLOSED_STATUSES.includes(ev.status)) return '#475569'
  return sevColor(ev.severity)
}
</script>
