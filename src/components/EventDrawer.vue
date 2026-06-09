<template>
  <div
    v-if="store.selectedEvent"
    class="drawer fixed top-0 right-0 h-full w-[520px] max-w-[90vw] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 slide-in-right overflow-y-auto"
    data-testid="event-drawer"
  >
    <div class="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-5 py-4">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="px-2.5 py-1 text-xs rounded-full font-semibold text-white"
              :style="{ background: SEVERITY_COLORS[ev.severity] }"
              data-testid="drawer-severity"
            >{{ SEVERITY_LABELS[ev.severity] }}</span>
            <span
              class="px-2.5 py-1 text-xs rounded-full font-medium"
              :style="{ background: STATUS_COLORS[ev.status], color: ev.status === 'closed' ? '#fff' : '#fff' }"
              data-testid="drawer-status"
            >{{ STATUS_LABELS[ev.status] }}</span>
            <span v-if="ev.markedByInspector" class="px-2.5 py-1 text-xs rounded-full font-semibold bg-purple-600 text-white">
              🚩 督导标记
            </span>
            <span v-if="isOverdue(ev)" class="px-2.5 py-1 text-xs rounded-full font-semibold bg-red-600 text-white animate-pulse">
              超时 {{ overdueMin(ev) }}分
            </span>
          </div>
          <h2 class="text-lg font-bold text-white mt-2" data-testid="drawer-title">{{ ev.title }}</h2>
          <div class="text-xs text-slate-400 mt-1">
            ID: {{ ev.id }} · 版本 v{{ ev.version }} · 更新于 {{ formatTime(ev.updatedAt) }}
          </div>
        </div>
        <button
          class="text-slate-400 hover:text-white p-1 text-xl"
          data-testid="drawer-close"
          @click="store.selectEvent(undefined)"
        >✕</button>
      </div>
    </div>

    <div class="p-5 space-y-5">
      <section class="space-y-2">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">📄 基础信息</h3>
        <div class="grid grid-cols-2 gap-3 text-sm bg-slate-800/60 rounded-lg p-4 border border-slate-700">
          <div><span class="text-slate-500">📍 网格：</span><span class="text-slate-200">{{ ev.gridName }}</span></div>
          <div><span class="text-slate-500">👮 上报人：</span><span class="text-slate-200">{{ ev.reporter }}</span></div>
          <div class="col-span-2"><span class="text-slate-500">🏠 地址：</span><span class="text-slate-200">{{ ev.address }}</span></div>
          <div><span class="text-slate-500">📅 创建：</span><span class="text-slate-200">{{ formatTime(ev.createdAt) }}</span></div>
          <div>
            <span class="text-slate-500">⏰ 截止：</span>
            <span :class="isOverdue(ev) ? 'text-red-400 font-semibold' : 'text-slate-200'">
              {{ formatTime(ev.deadline) }}
            </span>
          </div>
          <div v-if="ev.assigneeName"><span class="text-slate-500">👤 处理人：</span><span class="text-slate-200">{{ ev.assigneeName }} ({{ ROLE_LABELS[ev.assigneeRole || 'grid'] }})</span></div>
          <div v-if="ev.arrivalTime"><span class="text-slate-500">✅ 到场：</span><span class="text-slate-200">{{ formatTime(ev.arrivalTime) }}</span></div>
          <div class="col-span-2"><span class="text-slate-500">📝 描述：</span><span class="text-slate-200">{{ ev.description || '（无）' }}</span></div>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">🛣️ 路线规划（4 方案）</h3>
          <span class="text-[11px] text-slate-500">选路后联动热力图高亮</span>
        </div>
        <div class="grid grid-cols-2 gap-2" data-testid="route-options">
          <div
            v-for="r in store.availableRoutes"
            :key="r.id"
            class="route-card rounded-lg border p-3 cursor-pointer transition-all"
            :class="[
              store.urlState.selectedRouteId === r.id
                ? 'bg-blue-900/40 border-blue-500'
                : 'bg-slate-800/60 border-slate-700 hover:border-slate-500'
            ]"
            :data-testid="'route-card-' + r.id"
            @click="store.selectRoute(r.id === store.urlState.selectedRouteId ? undefined : r.id)"
          >
            <div class="text-xs font-semibold text-white">{{ r.name }}</div>
            <div class="text-[11px] text-slate-400 mt-1 space-y-0.5">
              <div>🕒 {{ r.estimatedMinutes }}分钟 · 📏 {{ r.distanceKm }}km</div>
              <div>🟥 风险点{{ r.riskPoints }}个 · 🚦 {{ r.trafficLights }}灯</div>
              <div class="truncate">📦 覆盖: {{ r.coveredGridNames.join('、') }}</div>
            </div>
            <div class="mt-2 flex gap-1 flex-wrap">
              <span
                class="text-[10px] px-1.5 py-0.5 rounded"
                :class="r.riskLevel === 'high' ? 'bg-red-900/60 text-red-300' : r.riskLevel === 'medium' ? 'bg-yellow-900/60 text-yellow-300' : 'bg-emerald-900/60 text-emerald-300'"
              >风险等级: {{ r.riskLevel === 'high' ? '高' : r.riskLevel === 'medium' ? '中' : '低' }}</span>
            </div>
          </div>
          <div v-if="store.availableRoutes.length === 0" class="col-span-2 text-center text-slate-500 text-xs py-4">
            当前状态无需选择路线
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">⚡ 操作中心</h3>
          <div class="flex gap-2 items-center">
            <span v-if="lockOverridden" class="text-[10px] text-orange-400 animate-pulse">
              🔒 冲突模拟激活
            </span>
            <button
              class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
              data-testid="simulate-lock-conflict"
              @click="simulateLock"
            >模拟版本冲突</button>
          </div>
        </div>

        <div
          v-if="actions.length === 0"
          class="text-xs text-slate-500 italic bg-slate-800/40 rounded-lg p-3 border border-dashed border-slate-700"
          data-testid="no-actions"
        >
          当前角色「{{ ROLE_LABELS[store.currentUser.role] }}」在状态「{{ STATUS_LABELS[ev.status] }}」下无可用操作
        </div>

        <div v-else class="space-y-4">
          <div v-if="actionActive === 'dispatch'" class="bg-slate-800/80 rounded-lg p-4 border border-blue-500/40 space-y-3">
            <h4 class="text-sm font-semibold text-blue-300">📤 派发任务</h4>
            <div>
              <label class="text-xs text-slate-400 block mb-1">指派给</label>
              <select
                v-model="dispatchForm.assigneeId"
                class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-sm text-slate-100"
                data-testid="dispatch-assignee"
              >
                <option value="">请选择接单人...</option>
                <option v-for="u in dispatchCandidates" :key="u.id" :value="u.id">
                  {{ u.avatar }} {{ u.name }} - {{ ROLE_LABELS[u.role] }} ({{ u.team }})
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-400 block mb-1">批示内容</label>
              <textarea
                v-model="dispatchForm.note"
                rows="2"
                class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100"
                placeholder="派发说明..."
              ></textarea>
            </div>
            <div class="flex gap-2 justify-end">
              <button class="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-700" @click="actionActive = null">取消</button>
              <button
                class="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 font-semibold"
                data-testid="dispatch-confirm"
                @click="doDispatch"
              >确认派发</button>
            </div>
          </div>

          <div v-if="actionActive === 'submit_disposal'" class="bg-slate-800/80 rounded-lg p-4 border border-purple-500/40 space-y-3">
            <h4 class="text-sm font-semibold text-purple-300">📝 处置回填</h4>
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-slate-400">当前版本 v{{ ev.version }}</span>
              <span v-if="submittedVersion !== ev.version" class="text-[11px] text-orange-400">
                将以 v{{ submittedVersion }} 提交（乐观锁）
              </span>
              <div v-if="hasDraft" class="flex items-center gap-1 ml-auto">
                <span class="text-[11px] text-amber-400">💾 有离线草稿</span>
                <button
                  class="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 hover:bg-amber-800"
                  data-testid="restore-draft"
                  @click="restoreDraft"
                >恢复草稿</button>
                <button
                  class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                  @click="clearDraftBtn"
                >丢弃</button>
              </div>
              <button
                v-else
                class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 ml-auto"
                data-testid="save-draft"
                @click="doSaveDraft"
              >💾 存草稿</button>
            </div>
            <div>
              <label class="text-xs text-slate-400 block mb-1">
                到场签到：
                <span v-if="ev.arrivalTime" class="text-emerald-400">✅ {{ formatTime(ev.arrivalTime) }}</span>
                <button
                  v-else
                  class="ml-2 text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800"
                  data-testid="sign-arrival"
                  @click="doSignArrival"
                >点击签到</button>
              </label>
            </div>
            <div>
              <label class="text-xs text-slate-400 block mb-1">处置备注（必填，≥5字）</label>
              <textarea
                v-model="disposalForm.content"
                rows="4"
                class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100"
                placeholder="现场处置过程、措施、参与人员、劝离/处置数量等..."
                data-testid="disposal-content"
              ></textarea>
            </div>
            <div>
              <label class="text-xs text-slate-400 block mb-1">处置结果摘要（必填）</label>
              <textarea
                v-model="disposalForm.resultSummary"
                rows="2"
                class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100"
                placeholder="一句话总结处置结果..."
                data-testid="disposal-summary"
              ></textarea>
            </div>
            <div class="flex gap-2 justify-end">
              <button class="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-700" @click="actionActive = null">取消</button>
              <button
                class="text-xs px-4 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-500 font-semibold"
                data-testid="submit-disposal"
                @click="doSubmitDisposal"
              >提交处置 ➔ 待复核</button>
            </div>
          </div>

          <div v-if="actionActive === 'inspect'" class="bg-slate-800/80 rounded-lg p-4 border border-purple-500/40 space-y-3">
            <h4 class="text-sm font-semibold text-purple-300">🔍 督导抽检</h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-slate-400 block mb-1">评分 0-100</label>
                <input
                  v-model.number="inspectForm.score"
                  type="number"
                  min="0"
                  max="100"
                  class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100"
                />
              </div>
              <div class="flex items-end">
                <label class="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" v-model="inspectForm.flagged" />
                  🚩 标记重点关注
                </label>
              </div>
            </div>
            <div>
              <label class="text-xs text-slate-400 block mb-1">发现问题</label>
              <textarea
                v-model="inspectForm.findings"
                rows="3"
                class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100"
                placeholder="描述检查中发现的问题..."
              ></textarea>
            </div>
            <div>
              <label class="text-xs text-slate-400 block mb-1">整改建议</label>
              <textarea
                v-model="inspectForm.recommendation"
                rows="2"
                class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100"
                placeholder="给出整改建议..."
              ></textarea>
            </div>
            <div class="flex gap-2 justify-end">
              <button class="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-700" @click="actionActive = null">取消</button>
              <button
                class="text-xs px-4 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-500 font-semibold"
                data-testid="inspect-confirm"
                @click="doInspect"
              >提交督导意见</button>
            </div>
          </div>

          <div v-if="actionActive === 'review_approve' || actionActive === 'review_reject'" class="bg-slate-800/80 rounded-lg p-4 border border-amber-500/40 space-y-3">
            <h4 class="text-sm font-semibold" :class="actionActive === 'review_approve' ? 'text-emerald-300' : 'text-red-300'">
              {{ actionActive === 'review_approve' ? '✅ 复核通过 / 结案' : '❌ 复核驳回' }}
            </h4>
            <div>
              <label class="text-xs text-slate-400 block mb-1">
                {{ actionActive === 'review_approve' ? '结案说明（选填）' : '驳回理由（必填）' }}
              </label>
              <textarea
                v-model="reviewForm.reason"
                rows="3"
                class="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100"
                :placeholder="actionActive === 'review_approve' ? '补充说明...' : '详细说明驳回原因、需要补充哪些内容...'"
                data-testid="review-reason"
              ></textarea>
            </div>
            <div class="flex gap-2 justify-end">
              <button class="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:bg-slate-700" @click="actionActive = null">取消</button>
              <button
                class="text-xs px-4 py-1.5 rounded text-white font-semibold"
                :class="actionActive === 'review_approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'"
                :data-testid="actionActive === 'review_approve' ? 'review-approve' : 'review-reject'"
                @click="doReview"
              >{{ actionActive === 'review_approve' ? '确认结案' : '确认驳回 ➔ 处理中' }}</button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <template v-for="a in actions" :key="a.action">
              <button
                v-if="!['dispatch', 'submit_disposal', 'inspect', 'review_approve', 'review_reject'].includes(a.action) || actionActive === a.action"
                class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                :class="buttonClass(a.action)"
                :data-testid="'action-' + a.action"
                @click="triggerAction(a.action)"
              >
                {{ actionIcon(a.action) }} {{ a.label }}
              </button>
              <button
                v-else
                class="px-4 py-2 rounded-lg text-sm font-medium transition-all border border-dashed"
                :class="buttonClassOutline(a.action)"
                :data-testid="'trigger-' + a.action"
                @click="openAction(a.action)"
              >
                {{ actionIcon(a.action) }} {{ a.label }} →
              </button>
            </template>
          </div>
        </div>
      </section>

      <section v-if="ev.disposalRecord" class="space-y-2">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">🧾 处置记录</h3>
        <div class="bg-slate-800/60 rounded-lg p-3 border border-slate-700 text-sm text-slate-200">
          <div class="text-xs text-slate-400">{{ ev.disposalRecord.operatorName }} · {{ formatTime(ev.disposalRecord.timestamp) }}</div>
          <div class="mt-2 whitespace-pre-wrap">{{ ev.disposalRecord.content }}</div>
          <div class="mt-2 text-slate-300 border-t border-slate-700 pt-2">
            <span class="text-slate-500">结果摘要：</span>{{ ev.disposalRecord.resultSummary }}
          </div>
        </div>
      </section>

      <section v-if="ev.inspectionRecord" class="space-y-2">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">📑 督导记录</h3>
        <div class="bg-slate-800/60 rounded-lg p-3 border border-purple-700/60 text-sm text-slate-200">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-400">{{ ev.inspectionRecord.operatorName }} · {{ formatTime(ev.inspectionRecord.timestamp) }}</span>
            <span class="text-xs font-bold" :class="ev.inspectionRecord.score >= 80 ? 'text-emerald-400' : 'text-orange-400'">
              评分 {{ ev.inspectionRecord.score }}
            </span>
          </div>
          <div class="mt-2"><span class="text-slate-500">发现：</span>{{ ev.inspectionRecord.findings || '（无）' }}</div>
          <div class="mt-1"><span class="text-slate-500">建议：</span>{{ ev.inspectionRecord.recommendation || '（无）' }}</div>
        </div>
      </section>

      <section v-if="ev.reviewRecord" class="space-y-2">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">⚖️ 复核记录</h3>
        <div class="bg-slate-800/60 rounded-lg p-3 border text-sm text-slate-200"
          :class="ev.reviewRecord.approved ? 'border-emerald-700/60' : 'border-red-700/60'">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-400">{{ ev.reviewRecord.operatorName }} · {{ formatTime(ev.reviewRecord.timestamp) }}</span>
            <span
              class="text-xs font-bold px-2 py-0.5 rounded"
              :class="ev.reviewRecord.approved ? 'bg-emerald-600/30 text-emerald-300' : 'bg-red-600/30 text-red-300'"
            >{{ ev.reviewRecord.approved ? '通过' : '驳回' }}</span>
          </div>
          <div class="mt-2"><span class="text-slate-500">理由：</span>{{ ev.reviewRecord.reason || '（无）' }}</div>
        </div>
      </section>

      <section v-if="ev.dispatchNotes.length > 0" class="space-y-2">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">📢 派发批示</h3>
        <div class="space-y-2">
          <div v-for="n in ev.dispatchNotes" :key="n.id" class="bg-slate-800/60 rounded-lg p-3 border border-blue-700/40 text-sm">
            <div class="text-xs text-slate-400">{{ n.operatorName }} · {{ formatTime(n.timestamp) }}</div>
            <div class="mt-1 text-slate-200">{{ n.content }}</div>
          </div>
        </div>
      </section>

      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">📜 审计日志（{{ ev.auditLog.length }} 条）</h3>
          <button
            class="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
            data-testid="export-audit"
            @click="store.exportAudit()"
          >📥 导出全部 CSV</button>
        </div>
        <div class="max-h-48 overflow-y-auto space-y-1.5 text-xs" data-testid="audit-log">
          <div
            v-for="al in sortedAuditLog"
            :key="al.id"
            class="flex gap-2 items-start bg-slate-800/40 rounded p-2 border border-slate-700/60"
          >
            <span class="w-20 shrink-0 text-slate-500">{{ formatTimeShort(al.timestamp) }}</span>
            <span class="shrink-0" :title="ROLE_LABELS[al.operatorRole]">{{ roleIcon(al.operatorRole) }}</span>
            <span class="shrink-0 text-slate-300 font-medium w-16 truncate">{{ al.operatorName }}</span>
            <span class="shrink-0 bg-slate-700 text-slate-200 px-1.5 rounded">{{ al.action }}</span>
            <span class="text-slate-400 flex-1">{{ al.details }}</span>
            <span class="shrink-0 text-[10px] text-slate-500">
              v{{ al.versionBefore || 0 }}→v{{ al.versionAfter || 0 }}
            </span>
          </div>
          <div v-if="ev.auditLog.length === 0" class="text-center text-slate-500 py-3">暂无审计记录</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMainStore } from '@/stores/main'
import {
  SEVERITY_COLORS, SEVERITY_LABELS, STATUS_COLORS, STATUS_LABELS, ROLE_LABELS, CLOSED_STATUSES
} from '@/types'
import type { ActionType, UserRole, AuditLogEntry } from '@/types'
import { isOverdue as _isOverdue, getOverdueMinutes } from '@/services/sorting'
import { getUserById, getUsersByRole } from '@/data/seed'
import type { GridEvent } from '@/types'

const store = useMainStore()
const ev = computed(() => store.selectedEvent!)
const actions = computed(() => store.getActionsForEvent(ev.value))

const actionActive = ref<ActionType | null>(null)
watch(() => store.selectedEvent?.id, () => { actionActive.value = null })

const dispatchForm = reactive({ assigneeId: '', note: '' })
const disposalForm = reactive({ content: '', resultSummary: '' })
const inspectForm = reactive({ score: 85, findings: '', flagged: false, recommendation: '' })
const reviewForm = reactive({ reason: '' })

const submittedVersion = computed(() => {
  if (!ev.value) return 0
  return store.getOverrideVersion(ev.value.id) ?? ev.value.version
})
const lockOverridden = computed(() => ev.value && !!store.getOverrideVersion(ev.value.id))
const hasDraft = computed(() => ev.value && store.hasDraftLocal(ev.value.id))

const sortedAuditLog = computed<AuditLogEntry[]>(() =>
  [...ev.value.auditLog].sort((a, b) => b.timestamp - a.timestamp)
)

const dispatchCandidates = computed(() => {
  const gridWorkers = (ev.value.gridId
    ? store.grids.find((g) => g.id === ev.value.gridId)?.responsibleIds || []
    : []
  ).map((id) => getUserById(id)).filter(Boolean)
  const patrols = getUsersByRole('patrol')
  const combined = [...gridWorkers, ...patrols] as ReturnType<typeof getUserById>[]
  return Array.from(new Map(combined.map((u) => [u!.id, u!])).values())
})

function isOverdue(e: GridEvent) { return _isOverdue(e) }
function overdueMin(e: GridEvent) { return getOverdueMinutes(e) }

function formatTime(t: number) {
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}
function formatTimeShort(t: number) {
  return new Date(t).toLocaleTimeString('zh-CN', { hour12: false })
}

function roleIcon(r: UserRole): string {
  switch (r) {
    case 'commander': return '🎖️'
    case 'grid': return '🧑‍💼'
    case 'patrol': return '🚓'
    case 'inspector': return '🕵️'
    default: return '👤'
  }
}

function actionIcon(a: ActionType): string {
  switch (a) {
    case 'dispatch': return '📤'
    case 'accept': return '🙋'
    case 'sign_arrival': return '✅'
    case 'submit_disposal': return '📝'
    case 'inspect': return '🔍'
    case 'review_approve': return '✅'
    case 'review_reject': return '❌'
    case 'reopen': return '🔄'
    default: return '⚡'
  }
}

function buttonClass(a: ActionType): string {
  const base = 'shadow-md hover:shadow-lg'
  switch (a) {
    case 'dispatch': return base + ' bg-blue-600 hover:bg-blue-500 text-white'
    case 'accept': return base + ' bg-cyan-600 hover:bg-cyan-500 text-white'
    case 'sign_arrival': return base + ' bg-emerald-600 hover:bg-emerald-500 text-white'
    case 'submit_disposal': return base + ' bg-purple-600 hover:bg-purple-500 text-white'
    case 'inspect': return base + ' bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
    case 'review_approve': return base + ' bg-emerald-600 hover:bg-emerald-500 text-white'
    case 'review_reject': return base + ' bg-red-600 hover:bg-red-500 text-white'
    case 'reopen': return base + ' bg-slate-600 hover:bg-slate-500 text-white'
    default: return base + ' bg-slate-700 text-white'
  }
}

function buttonClassOutline(a: ActionType): string {
  switch (a) {
    case 'dispatch': return 'border-blue-500/60 text-blue-300 hover:bg-blue-500/10'
    case 'submit_disposal': return 'border-purple-500/60 text-purple-300 hover:bg-purple-500/10'
    case 'inspect': return 'border-fuchsia-500/60 text-fuchsia-300 hover:bg-fuchsia-500/10'
    case 'review_approve': return 'border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/10'
    case 'review_reject': return 'border-red-500/60 text-red-300 hover:bg-red-500/10'
    default: return 'border-slate-500/60 text-slate-300 hover:bg-slate-500/10'
  }
}

function openAction(a: ActionType) {
  actionActive.value = a
  if (a === 'submit_disposal' && hasDraft.value) {
    // 提示有草稿
  }
}

function triggerAction(a: ActionType) {
  switch (a) {
    case 'accept':
      store.acceptTask(ev.value.id)
      break
    case 'sign_arrival':
      store.signArrival(ev.value.id)
      break
    case 'reopen':
      store.reopen(ev.value.id, '手动重新打开')
      break
  }
}

function doDispatch() {
  if (!dispatchForm.assigneeId) {
    store.showError('请选择接单人')
    return
  }
  const r = store.dispatchTask(ev.value.id, dispatchForm.assigneeId, dispatchForm.note)
  if (r.ok) {
    actionActive.value = null
    dispatchForm.assigneeId = ''
    dispatchForm.note = ''
  }
}

function doSignArrival() {
  store.signArrival(ev.value.id)
}

function doSubmitDisposal() {
  const version = submittedVersion.value
  const r = store.submitDisposal(ev.value.id, {
    content: disposalForm.content,
    resultSummary: disposalForm.resultSummary,
    submittedVersion: version
  })
  if (r.ok) {
    actionActive.value = null
    disposalForm.content = ''
    disposalForm.resultSummary = ''
    store.clearOptimisticLockOverride(ev.value.id)
  }
}

function doSaveDraft() {
  if (!ev.value) return
  store.saveDraftLocal({
    eventId: ev.value.id,
    versionSaved: ev.value.version,
    savedAt: Date.now(),
    content: disposalForm.content,
    resultSummary: disposalForm.resultSummary,
    arrivalTime: ev.value.arrivalTime,
    photos: []
  })
}

function restoreDraft() {
  if (!ev.value) return
  const d = store.loadDraftLocal(ev.value.id)
  if (d) {
    disposalForm.content = d.content
    disposalForm.resultSummary = d.resultSummary
    store.showSuccess('离线草稿已恢复，可继续编辑后提交')
  }
}

function clearDraftBtn() {
  if (!ev.value) return
  store.clearDraftLocal(ev.value.id)
  store.showSuccess('已丢弃离线草稿')
}

function doInspect() {
  const r = store.inspect(ev.value.id, { ...inspectForm })
  if (r.ok) {
    actionActive.value = null
  }
}

function doReview() {
  if (actionActive.value === 'review_reject' && !reviewForm.reason.trim()) {
    store.showError('驳回必须填写理由')
    return
  }
  const method = actionActive.value === 'review_approve' ? 'reviewApprove' : 'reviewReject'
  const r = (store as any)[method](ev.value.id, reviewForm.reason)
  if (r?.ok) {
    actionActive.value = null
    reviewForm.reason = ''
  }
}

function simulateLock() {
  if (!ev.value) return
  if (ev.value.version <= 1) {
    store.showError('事件版本过低，无法模拟冲突')
    return
  }
  store.simulateOptimisticLockConflict(ev.value.id)
}
</script>
