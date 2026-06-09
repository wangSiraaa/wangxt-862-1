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
  StateTransition,
  LocateResult,
  LocateTargetType,
  NavigationHistoryRecord
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
  loadInitialState,
  appendNavHistory,
  restoreNavHistory,
  clearNavHistory
} from '@/services/persistence'

export const useMainStore = defineStore('main', () => {
  const events = ref<GridEvent[]>([...EVENTS])
  const grids = ref<GridInfo[]>([...GRIDS])
  const users = ref<UserInfo[]>([...USERS])
  const currentUser = ref<UserInfo>(USERS.find((u) => u.role === 'commander')!)

  const urlState = ref<URLState>({ ...DEFAULT_URL_STATE })
  const allAuditLogs = ref<AuditLogEntry[]>([])
  const navigationHistory = ref<NavigationHistoryRecord[]>([])

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

  function setLocateKeyword(kw: string) {
    urlState.value.locateKeyword = kw
    persistState()
  }

  function setShowHistory(show: boolean) {
    urlState.value.showHistory = show
    persistState()
  }

  function locateTarget(keyword: string, trigger: NavigationHistoryRecord['trigger'] = 'manual'): LocateResult {
    const k = (keyword || '').trim()
    if (!k) {
      const result: LocateResult = { success: false, reason: '请输入要定位的网格编号、事件编号、名称或关键词' }
      showError(result.reason!)
      return result
    }

    const lowerK = k.toLowerCase()
    let targetType: LocateTargetType | undefined
    let targetId: string | undefined
    let targetName: string | undefined
    let gridId: string | undefined
    let gridName: string | undefined
    let cx: number | undefined
    let cy: number | undefined
    let zoom: number = urlState.value.mapZoom

    const exactEvent = events.value.find((e) => e.id.toLowerCase() === lowerK)
    if (exactEvent) {
      targetType = 'event'
      targetId = exactEvent.id
      targetName = exactEvent.title
      gridId = exactEvent.gridId
      gridName = exactEvent.gridName
      cx = exactEvent.location.x
      cy = exactEvent.location.y
      zoom = 1.6
    }

    if (!targetType) {
      const exactGrid = grids.value.find(
        (g) => g.id.toLowerCase() === lowerK || g.name === k || g.area === k
      )
      if (exactGrid) {
        targetType = 'grid'
        targetId = exactGrid.id
        targetName = exactGrid.name
        gridId = exactGrid.id
        gridName = exactGrid.name
        cx = exactGrid.centerX
        cy = exactGrid.centerY
        zoom = 1.4
      }
    }

    if (!targetType) {
      const matchEvent = events.value.find(
        (e) =>
          e.title.toLowerCase().includes(lowerK) ||
          e.address.toLowerCase().includes(lowerK) ||
          e.description.toLowerCase().includes(lowerK) ||
          (e.assigneeName && e.assigneeName.includes(k))
      )
      if (matchEvent) {
        targetType = 'event'
        targetId = matchEvent.id
        targetName = matchEvent.title
        gridId = matchEvent.gridId
        gridName = matchEvent.gridName
        cx = matchEvent.location.x
        cy = matchEvent.location.y
        zoom = 1.6
      }
    }

    if (!targetType) {
      const matchGrid = grids.value.find(
        (g) => g.name.includes(k) || g.area.includes(k) || g.id.toLowerCase().includes(lowerK)
      )
      if (matchGrid) {
        targetType = 'grid'
        targetId = matchGrid.id
        targetName = matchGrid.name
        gridId = matchGrid.id
        gridName = matchGrid.name
        cx = matchGrid.centerX
        cy = matchGrid.centerY
        zoom = 1.4
      }
    }

    if (!targetType || !cx || !cy || !gridId) {
      const result: LocateResult = {
        success: false,
        reason: `未找到与「${k}」匹配的网格或事件。请尝试：网格编号(G001~G006)、事件编号(EVT_xxx)、网格名称、事件标题、地址等关键词。`
      }
      showError(result.reason!)
      return result
    }

    urlState.value.mapCenter = { x: cx, y: cy }
    urlState.value.mapZoom = zoom
    setLocateKeyword(k)

    let reviewReason: string | undefined
    let reviewable = false
    if (targetType === 'event' && targetId) {
      const ev = events.value.find((e) => e.id === targetId)
      if (ev) {
        const closedOrRejected = ev.status === 'closed' || ev.status === 'rejected'
        const hasDisposal = !!ev.disposalRecord
        const hasAuditTrail = ev.auditLog.length >= 3
        reviewable = closedOrRejected && hasDisposal && hasAuditTrail
        if (reviewable) {
          reviewReason = `新增流程可被查询并复查：事件「${ev.title}」状态为${
            ev.status === 'closed' ? '已结案' : '已驳回'
          }，已完成${ev.auditLog.length}步流转，含处置记录，版本号v${ev.version}，满足可复查条件（closed/rejected + 处置回填 + 审计链完整）。`
        } else {
          const missing: string[] = []
          if (!closedOrRejected) missing.push('终态(已结案/已驳回)')
          if (!hasDisposal) missing.push('处置回填记录')
          if (!hasAuditTrail) missing.push('完整审计链(≥3步)')
          reviewReason = `当前暂不满足可复查：缺少${missing.join('、')}。`
        }
        selectEvent(targetId)
      }
    }

    const record: NavigationHistoryRecord = {
      id: 'nav_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      operatorId: currentUser.value.id,
      operatorName: currentUser.value.name,
      trigger,
      targetType: targetType!,
      targetId: targetId!,
      targetName: targetName || '',
      gridId: gridId!,
      gridName: gridName || '',
      centerX: cx!,
      centerY: cy!,
      zoom,
      queryKeyword: k,
      reviewable,
      reviewReason
    }

    navigationHistory.value.unshift(record)
    appendNavHistory(record)
    if (navigationHistory.value.length > 200) navigationHistory.value.length = 200

    const successTip = reviewable
      ? `定位成功：${targetName}（${targetId}）- ${reviewReason}`
      : `定位成功：${targetName}（${targetId}）- 已跳转到 ${gridName} 区域`
    showSuccess(successTip)

    return {
      success: true,
      targetType,
      targetId,
      targetName,
      gridId,
      centerX: cx,
      centerY: cy,
      zoom,
      reason: reviewReason || `已定位到 ${targetName}`
    }
  }

  function jumpToHistory(recordId: string): LocateResult {
    const rec = navigationHistory.value.find((r) => r.id === recordId)
    if (!rec) {
      const result: LocateResult = { success: false, reason: '历史记录不存在' }
      showError(result.reason!)
      return result
    }
    urlState.value.mapCenter = { x: rec.centerX, y: rec.centerY }
    urlState.value.mapZoom = rec.zoom
    if (rec.targetType === 'event') {
      selectEvent(rec.targetId)
    }
    showSuccess(`已跳转至历史记录：${rec.targetName}（${rec.gridName}）`)
    return {
      success: true,
      targetType: rec.targetType,
      targetId: rec.targetId,
      targetName: rec.targetName,
      gridId: rec.gridId,
      centerX: rec.centerX,
      centerY: rec.centerY,
      zoom: rec.zoom,
      reason: rec.reviewReason
    }
  }

  function clearNavigationHistory() {
    navigationHistory.value = []
    clearNavHistory()
    showSuccess('导航历史已清空')
  }

  function pushNavHistoryForEvent(
    ev: GridEvent,
    trigger: NavigationHistoryRecord['trigger'],
    extraReason?: string
  ) {
    const grid = grids.value.find((g) => g.id === ev.gridId)
    if (!grid) return
    const reviewable =
      (ev.status === 'closed' || ev.status === 'rejected') &&
      !!ev.disposalRecord &&
      ev.auditLog.length >= 3
    let reviewReason: string | undefined
    if (reviewable) {
      reviewReason =
        extraReason ||
        `新增流程可被查询并复查：事件「${ev.title}」状态为${
          ev.status === 'closed' ? '已结案' : '已驳回'
        }，已完成${ev.auditLog.length}步流转，含处置记录，版本号v${ev.version}，满足可复查条件（closed/rejected + 处置回填 + 审计链完整）。`
    }
    const record: NavigationHistoryRecord = {
      id: 'nav_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      operatorId: currentUser.value.id,
      operatorName: currentUser.value.name,
      trigger,
      targetType: 'event',
      targetId: ev.id,
      targetName: ev.title,
      gridId: grid.id,
      gridName: grid.name,
      centerX: ev.location.x,
      centerY: ev.location.y,
      zoom: urlState.value.mapZoom,
      reviewable,
      reviewReason
    }
    navigationHistory.value.unshift(record)
    appendNavHistory(record)
    if (navigationHistory.value.length > 200) navigationHistory.value.length = 200
  }

  function loadNavigationHistoryFromStorage() {
    navigationHistory.value = restoreNavHistory()
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
    pushNavHistoryForEvent(newEv, 'event_create', `新增布控流程可被查询：事件「${newEv.title}」已创建，编号${newEv.id}，位于${grid.name}，当前状态待研判，创建人${operator.name}，版本号v${newEv.version}。`)
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
    if (action === 'review_approve' || action === 'review_reject' || action === 'reopen') {
      const trig =
        action === 'reopen' ? 'review_reopen' : 'event_query'
      pushNavHistoryForEvent(copy, trig)
    }
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
    loadNavigationHistoryFromStorage()
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
    navigationHistory,
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
    setLocateKeyword,
    setShowHistory,
    locateTarget,
    jumpToHistory,
    clearNavigationHistory,
    pushNavHistoryForEvent,
    loadNavigationHistoryFromStorage,
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
