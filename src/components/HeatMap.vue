<template>
  <div
    class="heatmap-container relative w-full h-full rounded-xl overflow-hidden border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-950 to-black"
    :class="{ 'inset-0 fixed z-40': store.urlState.fullscreen }"
    @wheel.prevent="onWheel"
    data-testid="heatmap-container"
  >
    <svg
      class="absolute inset-0 w-full h-full select-none"
      :viewBox="viewBox"
      :style="{ transform: `scale(${store.urlState.mapZoom})`, transformOrigin: transformOrigin }"
      ref="svgEl"
    >
      <defs>
        <radialGradient id="heat-high">
          <stop offset="0%" stop-color="#ef4444" stop-opacity="0.95" />
          <stop offset="50%" stop-color="#ef4444" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#ef4444" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="heat-mid">
          <stop offset="0%" stop-color="#f97316" stop-opacity="0.85" />
          <stop offset="50%" stop-color="#faad14" stop-opacity="0.4" />
          <stop offset="100%" stop-color="#eab308" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="heat-low">
          <stop offset="0%" stop-color="#22c55e" stop-opacity="0.75" />
          <stop offset="50%" stop-color="#52c41a" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#52c41a" stop-opacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g :transform="canvasTransform">
        <g class="grids-layer">
          <polygon
            v-for="g in store.grids"
            :key="'grid-' + g.id"
            :points="toPoints(g.polygon)"
            :fill="gridFill(g)"
            :stroke="gridStroke(g)"
            stroke-width="1.5"
            class="grid-polygon transition-all cursor-pointer"
            :class="{ 'ring-highlight': g.id === (store.selectedEvent?.gridId) }"
            data-testid="grid-polygon"
            @click="onGridClick(g.id)"
          >
            <title>{{ g.name }} · {{ g.area }}</title>
          </polygon>
          <text
            v-for="g in store.grids"
            :key="'gt-' + g.id"
            :x="g.centerX"
            :y="g.centerY"
            text-anchor="middle"
            class="text-[10px] fill-slate-400 pointer-events-none font-medium"
          >{{ g.name }}</text>
        </g>

        <g v-if="showHeat" class="heat-layer" filter="url(#glow)">
          <circle
            v-for="h in heatPoints"
            :key="'h-' + h.id"
            :cx="h.x"
            :cy="h.y"
            :r="h.r"
            :fill="h.fill"
            :opacity="h.opacity"
            class="heat-circle"
            pointer-events="none"
          />
        </g>

        <g v-if="showRoute && store.selectedRoute" class="route-layer">
          <polyline
            :points="routePoints"
            fill="none"
            stroke="#60a5fa"
            stroke-width="4"
            stroke-linejoin="round"
            stroke-linecap="round"
            opacity="0.9"
            stroke-dasharray="8 6"
            class="route-line"
          />
          <circle
            v-for="(pt, i) in store.selectedRoute.points"
            :key="'rp-' + i"
            :cx="pt.x"
            :cy="pt.y"
            :r="pt.type === 'risk' ? 9 : 6"
            :fill="routePointFill(pt.type)"
            stroke="#fff"
            stroke-width="1.5"
          >
            <title>{{ pt.label }} {{ pt.riskNote || '' }}</title>
          </circle>
          <text
            v-for="(pt, i) in store.selectedRoute.points"
            :key="'rt-' + i"
            :x="pt.x"
            :y="pt.y - 14"
            text-anchor="middle"
            class="text-[9px] fill-white font-semibold"
          >{{ pt.label }}</text>
        </g>

        <g class="events-layer">
          <g
            v-for="ev in sortedFiltered"
            :key="'ev-' + ev.id"
            :transform="`translate(${ev.location.x}, ${ev.location.y})`"
            class="event-marker cursor-pointer transition-transform hover:scale-125"
            :class="{ 'marker-selected': ev.id === store.urlState.selectedEventId }"
            :data-testid="'event-marker-' + ev.id"
            @click="onEventClick(ev.id)"
          >
            <circle
              r="11"
              :fill="markerColor(ev)"
              stroke="#fff"
              stroke-width="1.5"
              :opacity="isOverdue(ev) ? 1 : 0.92"
            />
            <text
              text-anchor="middle"
              y="3.5"
              class="text-[9px] fill-white font-bold pointer-events-none"
            >{{ severityInitial(ev) }}</text>
            <circle
              v-if="isOverdue(ev)"
              r="15"
              fill="none"
              stroke="#ef4444"
              stroke-width="1.5"
              opacity="0.75"
              class="pulse-dot"
            />
            <circle
              v-if="ev.markedByInspector"
              cx="9"
              cy="-9"
              r="5"
              fill="#a855f7"
              stroke="#fff"
              stroke-width="1"
            >
              <title>督导标记</title>
            </circle>
          </g>
        </g>
      </g>
    </svg>

    <div class="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none z-10">
      <div class="bg-slate-900/70 backdrop-blur px-3 py-2 rounded-lg border border-slate-700 pointer-events-auto">
        <div class="text-[11px] text-slate-400">统计</div>
        <div class="text-sm text-white font-semibold">
          <span class="text-red-400">{{ stats.critical }}</span> ·
          <span class="text-orange-400"> {{ stats.high }}</span> ·
          <span class="text-yellow-400"> {{ stats.medium }}</span> ·
          <span class="text-emerald-400"> {{ stats.low }}</span>
        </div>
        <div class="text-[11px] text-slate-400 mt-1">
          超时 <span class="text-red-400 font-semibold">{{ stats.overdue }}</span> ·
          督导标记 <span class="text-purple-400 font-semibold">{{ stats.flagged }}</span>
        </div>
      </div>
      <div class="flex gap-2 pointer-events-auto">
        <button
          v-for="vm in viewModes"
          :key="vm.value"
          class="px-2 py-1 text-xs rounded-md border transition"
          :class="[
            store.urlState.viewMode === vm.value
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'
          ]"
          @click="store.setViewMode(vm.value)"
        >{{ vm.label }}</button>
        <button
          class="px-2 py-1 text-xs rounded-md border bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700 transition"
          @click="store.setFullscreen(!store.urlState.fullscreen)"
          data-testid="toggle-fullscreen"
        >{{ store.urlState.fullscreen ? '退出全屏' : '全屏' }}</button>
      </div>
    </div>

    <div class="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
      <button
        class="w-9 h-9 rounded-lg bg-slate-800/90 border border-slate-600 text-white text-lg hover:bg-slate-700 transition"
        data-testid="zoom-in"
        @click="store.setMapZoom(store.urlState.mapZoom + 0.2)"
      >+</button>
      <div class="text-center text-[10px] text-slate-400">{{ (store.urlState.mapZoom * 100).toFixed(0) }}%</div>
      <button
        class="w-9 h-9 rounded-lg bg-slate-800/90 border border-slate-600 text-white text-lg hover:bg-slate-700 transition"
        data-testid="zoom-out"
        @click="store.setMapZoom(store.urlState.mapZoom - 0.2)"
      >−</button>
    </div>

    <div class="absolute bottom-3 left-3 flex flex-wrap gap-2 max-w-[60%] z-10 pointer-events-auto">
      <div class="bg-slate-900/70 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-300 border border-slate-700 flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>紧急/高
        <span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>中
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>低
        <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span>督导标记
        <span class="w-2.5 h-2.5 rounded-full border border-red-500 animate-pulse"></span>超时
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMainStore } from '@/stores/main'
import type { GridInfo, GridEvent, EventSeverity } from '@/types'
import { SEVERITY_COLORS, SEVERITY_ORDER, CLOSED_STATUSES } from '@/types'
import { isOverdue, stablePrioritySort, computeGridHeatIntensity } from '@/services/sorting'

const store = useMainStore()
const svgEl = ref<SVGSVGElement | null>(null)
const transformOrigin = '50% 50%'

const CANVAS_W = 1000
const CANVAS_H = 800
const viewBox = `0 0 ${CANVAS_W} ${CANVAS_H}`

const canvasTransform = computed(() => {
  const cx = store.urlState.mapCenter.x
  const cy = store.urlState.mapCenter.y
  const tx = CANVAS_W / 2 - cx
  const ty = CANVAS_H / 2 - cy
  return `translate(${tx}, ${ty})`
})

const showHeat = computed(() => store.urlState.viewMode !== 'grid')
const showRoute = computed(() => store.urlState.viewMode !== 'grid')

const sortedFiltered = computed(() => stablePrioritySort(store.filteredEvents))

const heatPoints = computed(() => {
  const gridIntensity = computeGridHeatIntensity(store.events)
  const result: { id: string; x: number; y: number; r: number; fill: string; opacity: number }[] = []
  gridIntensity.forEach((gi) => {
    if (gi.unclosedCount === 0) return
    const grid = store.grids.find((g) => g.id === gi.gridId)
    if (!grid) return
    const maxSeverity = gi.events.reduce<number>(
      (acc, e) => Math.max(acc, SEVERITY_ORDER[e.severity]),
      0
    )
    const fillMap: Record<number, string> = {
      4: 'url(#heat-high)',
      3: 'url(#heat-high)',
      2: 'url(#heat-mid)',
      1: 'url(#heat-low)'
    }
    result.push({
      id: 'hp-' + gi.gridId,
      x: grid.centerX,
      y: grid.centerY,
      r: 60 + Math.min(80, gi.unclosedCount * 12 + gi.overdueCount * 18 + gi.criticalCount * 22),
      fill: fillMap[maxSeverity] || 'url(#heat-low)',
      opacity: Math.min(0.9, 0.35 + gi.intensity * 0.8)
    })
  })
  return result
})

const routePoints = computed(() => {
  if (!store.selectedRoute) return ''
  return store.selectedRoute.points.map((p) => `${p.x},${p.y}`).join(' ')
})

function routePointFill(type: string) {
  switch (type) {
    case 'start':
      return '#22c55e'
    case 'waypoint':
      return '#3b82f6'
    case 'risk':
      return '#ef4444'
    case 'destination':
      return '#f97316'
    default:
      return '#94a3b8'
  }
}

const viewModes = [
  { value: 'heatmap' as const, label: '热力' },
  { value: 'grid' as const, label: '网格' },
  { value: 'hybrid' as const, label: '混合' }
]

function toPoints(poly: { x: number; y: number }[]): string {
  return poly.map((p) => `${p.x},${p.y}`).join(' ')
}

function gridFill(g: GridInfo): string {
  const activeInGrid = store.events.filter(
    (e) => e.gridId === g.id && !CLOSED_STATUSES.includes(e.status)
  )
  const critical = activeInGrid.filter((e) => e.severity === 'critical' || e.severity === 'high')
  const selected = store.selectedEvent?.gridId === g.id
  if (selected) return 'rgba(59, 130, 246, 0.28)'
  if (critical.length >= 2) return 'rgba(239, 68, 68, 0.22)'
  if (critical.length >= 1) return 'rgba(249, 115, 22, 0.18)'
  if (activeInGrid.length >= 3) return 'rgba(234, 179, 8, 0.15)'
  if (activeInGrid.length >= 1) return 'rgba(34, 197, 94, 0.12)'
  return 'rgba(148, 163, 184, 0.06)'
}

function gridStroke(g: GridInfo): string {
  if (store.selectedEvent?.gridId === g.id) return '#60a5fa'
  const riskMap: Record<string, string> = { high: '#ef4444', medium: '#eab308', low: '#475569' }
  return riskMap[g.riskLevel] || '#475569'
}

function markerColor(ev: GridEvent): string {
  if (CLOSED_STATUSES.includes(ev.status)) return '#64748b'
  return SEVERITY_COLORS[ev.severity]
}

function severityInitial(ev: GridEvent): string {
  if (CLOSED_STATUSES.includes(ev.status)) return '✓'
  const map: Record<EventSeverity, string> = { critical: '急', high: '高', medium: '中', low: '低' }
  return map[ev.severity]
}

const stats = computed(() => {
  const list = store.events
  return {
    critical: list.filter((e) => e.severity === 'critical' && !CLOSED_STATUSES.includes(e.status)).length,
    high: list.filter((e) => e.severity === 'high' && !CLOSED_STATUSES.includes(e.status)).length,
    medium: list.filter((e) => e.severity === 'medium' && !CLOSED_STATUSES.includes(e.status)).length,
    low: list.filter((e) => e.severity === 'low' && !CLOSED_STATUSES.includes(e.status)).length,
    overdue: list.filter(isOverdue).length,
    flagged: list.filter((e) => e.markedByInspector && !CLOSED_STATUSES.includes(e.status)).length
  }
})

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.08 : 0.08
  store.setMapZoom(store.urlState.mapZoom + delta)
}

function onGridClick(gid: string) {
  store.updateFilters({ gridId: store.urlState.filters.gridId === gid ? 'all' : gid })
}

function onEventClick(id: string) {
  store.selectEvent(id === store.urlState.selectedEventId ? undefined : id)
}
</script>

<style scoped>
.grid-polygon {
  transition: all 0.25s ease;
}
.grid-polygon:hover {
  filter: brightness(1.3);
  stroke-width: 2.5;
}
.ring-highlight {
  stroke: #60a5fa !important;
  stroke-width: 3 !important;
}
.marker-selected circle:first-child {
  stroke-width: 3;
  stroke: #fbbf24;
}
</style>
