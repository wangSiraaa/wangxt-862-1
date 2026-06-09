import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  GridEvent,
  GridInfo,
  UserInfo,
  URLState,
  FilterState,
  UserRole,
  AuditLogEntry,
  PatrolRoute,
  DraftDisposal,
  ActionType,
  StateTransition
} from '@/types'
import { GRIDS, USERS, EVENTS, getUserById, getRoutesForEvent, getGridById } from '@/data/seed'
import { stablePrioritySort, isOverdue } from '@/services/sorting'
import {
  validateTransition,
  getAvailableTransitions,
  canPerformAction,
  createAuditLog,
  validateOptimisticLock,
  validateDisposalSubmission
} from '@/services/stateMachine'
import {
  DEFAULT_FILTERS,
  DEFAULT_URL_STATE,
  saveToLocalStorage,
  loadDraft,
  saveDraft,
  clearDraft,
  hasDraft,
  appendAuditLog,
  restoreAuditLog,
  updateBrowserURL,
  exportAuditLogsAsCSV,
  triggerCSVDownload,
  loadInitialState
} from '@/services/persistence'

export const useMainStore = defineStore('main', () => {
  const events = ref<GridEvent[]>([...EVENTS])
  const grids = ref<GridInfo[]>([...GRIDS])
  const users = ref<UserInfo[]>([...USERS])
  const currentUser = ref<UserInfo>(USERS.find((u) => u.role === 'commander')!)

  const urlState = ref<URLState>({ ...DEFAULT_URL_STATE })
  const allAuditLogs = ref<AuditLogEntry[]>([])

  watch(urlState, () => persistState(), { deep: true })

  const lastError = ref<string | null>(null)
  const lastSuccess = ref<string | null>(null)
  const toastId = ref(0)

  const optimisticLockVersionOverride = ref<Record<string, number>>({})

  function showError(msg: string) {
    lastError.value = msg
    lastSuccess.value = null
    toastId.value++
    setTimeout(() => {
      if (lastError.value === msg) lastError.value = null
    }, 5000)
  }

  function showSuccess(msg: string) {
    lastSuccess.value = msg
    lastError.value = null
    toastId.value++
    setTimeout(() => {
      if (lastSuccess.value === msg) lastSuccess.value = null
    }, 3500)
  }

  const sortedEvents = computed(() => stablePrioritySort(events.value))

  const filteredEvents = computed(() => {
    const f = urlState.value.filters
    return sortedEvents.value.filter((e) => {
      if (f.severity !== 'all' && e.severity !== f.severity) return false
      if (f.status !== 'all' && e.status !== f.status) return false
      if (f.gridId !== 'all' && e.gridId !== f.gridId) return false
      if (f.assigneeRole !== 'all' && e.assigneeRole !== f.assigneeRole) return false
      if (f.onlyOverdue && !isOverdue(e)) return false
      if (f.onlyFlagged && !e.markedByInspector) return false
      if (f.onlyUnclosed && ['closed', 'rejected'].includes(e.status)) return false
      if (f.keyword) {
        const kw = f.keyword.toLowerCase()
        const hay = (
          e.title +
          e.description +
          e.address +
          e.gridName +
          (e.assigneeName || '') +
          (e.reporter || '')
        ).toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  })

  const selectedEvent = computed(() => {
    const id = urlState.value.selectedEventId
    return id ? events.value.find((e) => e.id === id) : undefined
  })

  const availableRoutes = computed<PatrolRoute[]>(() => {
    if (!selectedEvent.value) return []
    return getRoutesForEvent(selectedEvent.value)
  })

  const selectedRoute = computed(() => {
    const rid = urlState.value.selectedRouteId
    return availableRoutes.value.find((r) => r.id === rid)
  })

  function setRole(role: UserRole) {
    const user = users.value.find((u) => u.role === role)
    if (user) {
      currentUser.value = user
      urlState.value.role = role
      persistState()
    }
  }

  function switchUserByIndex(role: UserRole, idx = 0) {
    const matches = users.value.filter((u) => u.role === role)
    if (matches.length) {
      const u = matches[idx % matches.length]
      currentUser.value = u
      urlState.value.role = role
      persistState()
    }
  }

  function updateFilters(partial: Partial<FilterState>) {
    urlState.value.filters = { ...urlState.value.filters, ...partial }
    persistState()
  }

  function resetFilters() {
    urlState.value.filters = { ...DEFAULT_FILTERS }
    persistState()
  }

  function selectEvent(id?: string) {
    urlState.value.selectedEventId = id
    urlState.value.selectedRouteId = undefined
    persistState()
  }

  function selectRoute(id?: string) {
    urlState.value.selectedRouteId = id
    persistState()
  }

  function setFullscreen(fs: boolean) {
    urlState.value.fullscreen = fs
    persistState()
  }

  function setMapZoom(z: number) {
    urlState.value.mapZoom = Math.max(0.3, Math.min(3, z))
    persistState()
  }

  function setMapCenter(x: number, y: number) {
    urlState.value.mapCenter = { x, y }
    persistState()
  }

  function setViewMode(vm: URLState['viewMode']) {
    urlState.value.viewMode = vm
    persistState()
  }

  function persistState() {
    saveToLocalStorage(urlState.value)
    try {
      updateBrowserURL(urlState.value)
    } catch {
      // no-op
    }
  }

  function addEventToMemory(ev: GridEvent) {
    events.value.push(ev)
  }

  function findEventIndex(id: string): number {
    return events.value.findIndex((e) => e.id === id)
  }

  function replaceEvent(updated: GridEvent) {
    const idx = findEventIndex(updated.id)
    if (idx >= 0) events.value.splice(idx, 1, updated)
  }

  function createTask(payload: {
    title: string
    description: string
    severity: GridEvent['severity']
    gridId: string
    address: string
    location?: { x: number; y: number }
    tags?: string[]
  }) {
    const operator = currentUser.value
    if (operator.role !== 'commander') {
      showError('只有指挥员可以创建布控任务')
      return null
    }
    if (!payload.title || payload.title.trim().length < 3) {
      showError('任务标题至少 3 个字符')
      return null
    }
    if (!payload.gridId) {
      showError('请选择所属网格')
      return null
    }
    const grid = getGridById(payload.gridId)
    if (!grid) {
      showError('所选网格不存在')
      return null
    }
    const now = Date.now()
    const sevHours: Record<GridEvent['severity'], number> = {
      critical: 0.5,
      high: 2,
      medium: 6,
      low: 24
    }
    const newEv: GridEvent = {
      id: `EVT_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: payload.title.trim(),
      description: payload.description || '',
      severity: payload.severity,
      status: 'pending_review',
      gridId: payload.gridId,
      gridName: grid.name,
      address: payload.address || grid.area + grid.name,
      location: payload.location || { x: grid.centerX, y: grid.centerY },
      deadline: now + sevHours[payload.severity] * 3600_000,
      createdAt: now,
      updatedAt: now,
      reporter: operator.name + '(指挥员布控)',
      reporterContact: undefined,
      version: 1,
      markedByInspector: false,
      auditLog: [],
      dispatchNotes: [],
      tags: payload.tags || [payload.severity, payload.gridId]
    }
    const audit = createAuditLog(newEv, operator, 'create_task', undefined, '新建布控任务')
    newEv.auditLog.push(audit)
    appendAuditLog(audit)
    allAuditLogs.value.unshift(audit)
    addEventToMemory(newEv)
    showSuccess('布控任务已创建，进入待研判')
    selectEvent(newEv.id)
    return newEv
  }

  function performTransition(
    eventId: string,
    action: ActionType,
    payload?: Record<string, unknown>
  ): { ok: boolean; error?: string } {
    const ev = events.value.find((e) => e.id === eventId)
    if (!ev) return { ok: false, error: '事件不存在' }

    const operator = currentUser.value

    const submitVersion =
      (payload?.submittedVersion as number) ??
      optimisticLockVersionOverride.value[eventId] ??
      ev.version

    const lockCheck = validateOptimisticLock(submitVersion, ev.version)
    if (!lockCheck.valid) {
      showError(lockCheck.error!)
      return { ok: false, error: lockCheck.error }
    }

    const v = validateTransition(ev, action, operator)
    if (!v.valid) {
      showError(v.error!)
      return { ok: false, error: v.error }
    }

    const copy: GridEvent = JSON.parse(JSON.stringify(ev))
    copy.updatedAt = Date.now()
    copy.version = ev.version + 1

    let auditDetails = `执行操作：${v.transition?.label || action}`

    switch (action) {
      case 'dispatch': {
        const assigneeId = payload?.assigneeId as string
        const assignee = getUserById(assigneeId)
        if (!assignee) return { ok: false, error: '请选择接单人' }
        copy.assigneeId = assignee.id
        copy.assigneeName = assignee.name
        copy.assigneeRole = assignee.role
        const note = payload?.note as string
        if (note) {
          copy.dispatchNotes.push({
            id: `DN_${Date.now()}`,
            timestamp: Date.now(),
            operatorId: operator.id,
            operatorName: operator.name,
            content: note
          })
          auditDetails += ` → 指派给 ${assignee.name}（${assignee.role}），批示：${note}`
        } else {
          auditDetails += ` → 指派给 ${assignee.name}（${assignee.role}）`
        }
        break
      }
      case 'accept': {
        auditDetails += ` → 接单：${operator.name}`
        if (!copy.assigneeId) {
          copy.assigneeId = operator.id
          copy.assigneeName = operator.name
          copy.assigneeRole = operator.role
        }
        break
      }
      case 'sign_arrival': {
        copy.arrivalTime = Date.now()
        auditDetails += ` → 到场签到时间：${new Date(copy.arrivalTime).toLocaleTimeString()}`
        break
      }
      case 'submit_disposal': {
        const content = (payload?.content as string) || ''
        const summary = (payload?.resultSummary as string) || ''
        const val = validateDisposalSubmission(content, summary)
        if (!val.valid) {
          showError(val.error!)
          return { ok: false, error: val.error }
        }
        copy.arrivalTime = copy.arrivalTime || Date.now()
        copy.disposalRecord = {
          id: `DR_${Date.now()}`,
          timestamp: Date.now(),
          operatorId: operator.id,
          operatorName: operator.name,
          arrivalTime: copy.arrivalTime,
          content,
          resultSummary: summary,
          photos: (payload?.photos as string[]) || []
        }
        clearDraft(copy.id)
        auditDetails += ` → 处置内容：${content.slice(0, 60)}`
        break
      }
      case 'inspect': {
        const score = Number(payload?.score ?? 80)
        const findings = (payload?.findings as string) || ''
        const flagged = !!payload?.flagged
        const recommendation = (payload?.recommendation as string) || ''
        copy.inspectionRecord = {
          id: `IR_${Date.now()}`,
          timestamp: Date.now(),
          operatorId: operator.id,
          operatorName: operator.name,
          score,
          findings,
          flagged,
          recommendation
        }
        copy.markedByInspector = flagged || copy.markedByInspector
        if (flagged) {
          copy.markedByInspectorAt = Date.now()
          copy.markedByInspectorName = operator.name
        }
        auditDetails += ` → 得分${score}分，${flagged ? '标记重点关注' : '不标记'}`
        break
      }
      case 'review_approve':
      case 'review_reject': {
        const reason = (payload?.reason as string) || ''
        const approved = action === 'review_approve'
        copy.reviewRecord = {
          id: `RR_${Date.now()}`,
          timestamp: Date.now(),
          operatorId: operator.id,
          operatorName: operator.name,
          approved,
          reason
        }
        auditDetails += ` → ${approved ? '复核通过予以结案' : '复核驳回'}，理由：${reason || '无'}`
        break
      }
      case 'reopen': {
        auditDetails += ` → 重新打开事件`
        break
      }
    }

    if (v.transition) {
      copy.status = v.transition.to
    }

    const audit = createAuditLog(copy, operator, action, v.transition, auditDetails)
    copy.auditLog.push(audit)
    appendAuditLog(audit)
    allAuditLogs.value.unshift(audit)

    replaceEvent(copy)
    showSuccess(`操作成功：${v.transition?.label || action}`)
    persistState()
    return { ok: true }
  }

  function dispatchTask(eventId: string, assigneeId: string, note = '') {
    return performTransition(eventId, 'dispatch', { assigneeId, note })
  }

  function acceptTask(eventId: string) {
    return performTransition(eventId, 'accept')
  }

  function signArrival(eventId: string) {
    return performTransition(eventId, 'sign_arrival')
  }

  function submitDisposal(
    eventId: string,
    payload: {
      content: string
      resultSummary: string
      submittedVersion?: number
      photos?: string[]
    }
  ) {
    return performTransition(eventId, 'submit_disposal', payload)
  }

  function inspect(
    eventId: string,
    payload: { score: number; findings: string; flagged: boolean; recommendation: string }
  ) {
    return performTransition(eventId, 'inspect', payload)
  }

  function reviewApprove(eventId: string, reason = '') {
    return performTransition(eventId, 'review_approve', { reason })
  }

  function reviewReject(eventId: string, reason = '') {
    return performTransition(eventId, 'review_reject', { reason })
  }

  function reopen(eventId: string, reason = '') {
    return performTransition(eventId, 'reopen', { reason })
  }

  function saveDraftLocal(draft: DraftDisposal) {
    saveDraft(draft)
    urlState.value.draftEventId = draft.eventId
    persistState()
    showSuccess('处置草稿已保存到本地，离线可恢复')
  }

  function loadDraftLocal(eventId: string): DraftDisposal | null {
    return loadDraft(eventId)
  }

  function hasDraftLocal(eventId: string): boolean {
    return hasDraft(eventId)
  }

  function clearDraftLocal(eventId: string) {
    clearDraft(eventId)
    if (urlState.value.draftEventId === eventId) {
      urlState.value.draftEventId = undefined
      persistState()
    }
  }

  function exportAudit() {
    const all = [...allAuditLogs.value]
    events.value.forEach((e) => all.push(...e.auditLog))
    const byTime = all.sort((a, b) => b.timestamp - a.timestamp)
    const deduped = Array.from(new Map(byTime.map((e) => [e.id, e])).values())
    const csv = exportAuditLogsAsCSV(deduped)
    const fname = `审计日志_${new Date().toISOString().slice(0, 10)}.csv`
    triggerCSVDownload(fname, csv)
    showSuccess(`审计日志已导出：${fname}`)
  }

  function initializeFromURLAndStorage() {
    const { state, restoreAudit } = loadInitialState()
    urlState.value = state
    const user = users.value.find((u) => u.role === state.role)
    if (user) currentUser.value = user
    if (restoreAudit) {
      appendAuditLog(restoreAudit)
      allAuditLogs.value.unshift(restoreAudit)
    }
    try {
      const saved = restoreAuditLog()
      if (saved.length) allAuditLogs.value.unshift(...saved)
    } catch {
      // no-op
    }
  }

  function canRoleDo(action: ActionType, status: GridEvent['status']): boolean {
    return canPerformAction(status, action, currentUser.value.role)
  }

  function getActionsForEvent(ev: GridEvent): StateTransition[] {
    return getAvailableTransitions(ev.status, currentUser.value.role, ev, currentUser.value.id)
  }

  function simulateOptimisticLockConflict(eventId: string) {
    const ev = events.value.find((e) => e.id === eventId)
    if (!ev) return
    optimisticLockVersionOverride.value[eventId] = Math.max(0, ev.version - 1)
    showSuccess(
      `已为事件 ${eventId} 模拟冲突：下次提交会携带 v${ev.version - 1}，而实际版本 v${ev.version}`
    )
  }

  function clearOptimisticLockOverride(eventId: string) {
    delete optimisticLockVersionOverride.value[eventId]
  }

  function getOverrideVersion(eventId: string): number | undefined {
    return optimisticLockVersionOverride.value[eventId]
  }

  function getEventById(id: string) {
    return events.value.find((e) => e.id === id)
  }

  return {
    events,
    grids,
    users,
    currentUser,
    urlState,
    allAuditLogs,
    lastError,
    lastSuccess,
    toastId,
    optimisticLockVersionOverride,
    sortedEvents,
    filteredEvents,
    selectedEvent,
    availableRoutes,
    selectedRoute,
    setRole,
    switchUserByIndex,
    updateFilters,
    resetFilters,
    selectEvent,
    selectRoute,
    setFullscreen,
    setMapZoom,
    setMapCenter,
    setViewMode,
    createTask,
    dispatchTask,
    acceptTask,
    signArrival,
    submitDisposal,
    inspect,
    reviewApprove,
    reviewReject,
    reopen,
    saveDraftLocal,
    loadDraftLocal,
    hasDraftLocal,
    clearDraftLocal,
    exportAudit,
    initializeFromURLAndStorage,
    canRoleDo,
    getActionsForEvent,
    simulateOptimisticLockConflict,
    clearOptimisticLockOverride,
    getOverrideVersion,
    showError,
    showSuccess,
    getEventById,
    persistState,
    replaceEvent
  }
})
