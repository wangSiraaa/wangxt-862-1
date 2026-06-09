import type {
  StateTransition,
  EventStatus,
  UserRole,
  ActionType,
  GridEvent,
  AuditLogEntry,
  UserInfo
} from '@/types'

export const STATE_TRANSITIONS: StateTransition[] = [
  { from: 'pending_review', to: 'dispatched', action: 'dispatch', allowedRoles: ['commander'], label: '派发任务', description: '指挥员将待研判事件派发给网格员或巡逻队' },
  { from: 'dispatched', to: 'processing', action: 'accept', allowedRoles: ['grid', 'patrol'], label: '接单处理', description: '网格员或巡逻队接收派发的任务' },
  { from: 'processing', to: 'pending_review_result', action: 'submit_disposal', allowedRoles: ['grid', 'patrol'], label: '提交处置', description: '处置完成后提交处理结果等待复核' },
  { from: 'pending_review_result', to: 'closed', action: 'review_approve', allowedRoles: ['commander', 'inspector'], label: '复核通过', description: '复核通过，事件结案' },
  { from: 'pending_review_result', to: 'rejected', action: 'review_reject', allowedRoles: ['commander', 'inspector'], label: '复核驳回', description: '复核驳回，案件退回并标记为已驳回终态' },
  { from: 'closed', to: 'processing', action: 'reopen', allowedRoles: ['commander', 'inspector'], label: '重新打开', description: '重新打开已结案事件' },
  { from: 'rejected', to: 'processing', action: 'reopen', allowedRoles: ['commander', 'inspector'], label: '重新打开', description: '重新打开已驳回事件' }
]

export function getAvailableTransitions(currentStatus: EventStatus, userRole: UserRole, event?: GridEvent, userId?: string): StateTransition[] {
  const base = STATE_TRANSITIONS.filter((t) => t.from === currentStatus && t.allowedRoles.includes(userRole))
    .filter((t) => {
      if (!event || !userId) return true
      // accept: 如果已指派给其他人，则不能接单
      if (t.action === 'accept' && event.assigneeId && event.assigneeId !== userId) return false
      // submit_disposal: 只能提交自己负责的
      if (t.action === 'submit_disposal' && event.assigneeId && event.assigneeId !== userId) return false
      return true
    })
  const extras: StateTransition[] = []
  if ((userRole === 'grid' || userRole === 'patrol') && currentStatus === 'processing' && !event?.arrivalTime) {
    // sign_arrival: 只能为自己负责的事件签到
    if (!event?.assigneeId || !userId || event.assigneeId === userId) {
      extras.push({ from: currentStatus, to: currentStatus, action: 'sign_arrival', allowedRoles: [userRole], label: '到场签到', description: '标记已到达现场' })
    }
  }
  if (userRole === 'inspector' && currentStatus !== 'pending_review') {
    extras.push({ from: currentStatus, to: currentStatus, action: 'inspect', allowedRoles: ['inspector'], label: '督导抽检', description: '对事件进行督导检查和评分' })
  }
  return [...base, ...extras]
}

export function canPerformAction(currentStatus: EventStatus, action: ActionType, userRole: UserRole): boolean {
  if (action === 'sign_arrival') return (userRole === 'grid' || userRole === 'patrol') && currentStatus === 'processing'
  if (action === 'inspect') return userRole === 'inspector' && currentStatus !== 'pending_review'
  return STATE_TRANSITIONS.some((t) => t.from === currentStatus && t.action === action && t.allowedRoles.includes(userRole))
}

export function getNextStatus(currentStatus: EventStatus, action: ActionType): EventStatus | null {
  if (action === 'sign_arrival' || action === 'inspect') return currentStatus
  const transition = STATE_TRANSITIONS.find((t) => t.from === currentStatus && t.action === action)
  return transition ? transition.to : null
}

export function validateTransition(event: GridEvent, action: ActionType, user: UserInfo): { valid: boolean; error?: string; transition?: StateTransition } {
  if (!event) return { valid: false, error: '事件不存在' }
  if (action === 'sign_arrival') {
    if (!(user.role === 'grid' || user.role === 'patrol')) return { valid: false, error: '只有网格员或巡逻队可以到场签到' }
    if (event.status !== 'processing') return { valid: false, error: '仅处理中状态可以签到' }
    if (event.arrivalTime) return { valid: false, error: '已到场，请勿重复签到' }
    if (event.assigneeId && event.assigneeId !== user.id) return { valid: false, error: '非本人负责的事件无法签到' }
    const t: StateTransition = { from: event.status, to: event.status, action: 'sign_arrival', allowedRoles: ['grid', 'patrol'], label: '到场签到', description: '标记已到达现场' }
    return { valid: true, transition: t }
  }
  if (action === 'inspect') {
    if (user.role !== 'inspector') return { valid: false, error: '只有督导员可以执行抽检' }
    if (event.status === 'pending_review') return { valid: false, error: '待研判事件暂不可督导' }
    const t: StateTransition = { from: event.status, to: event.status, action: 'inspect', allowedRoles: ['inspector'], label: '督导抽检', description: '对事件进行督导检查和评分' }
    return { valid: true, transition: t }
  }
  const transition = STATE_TRANSITIONS.find((t) => t.from === event.status && t.action === action)
  if (!transition) return { valid: false, error: '当前状态 [' + event.status + '] 不允许执行操作 [' + action + ']' }
  if (!transition.allowedRoles.includes(user.role)) return { valid: false, error: '角色 [' + user.role + '] 无权限执行操作 [' + transition.label + ']' }
  if (action === 'accept' && event.assigneeId && event.assigneeId !== user.id) return { valid: false, error: '该任务已指派给其他人员，非本人无法接单' }
  if (action === 'submit_disposal' && event.assigneeId && event.assigneeId !== user.id) return { valid: false, error: '只能提交自己负责的任务处置结果' }
  return { valid: true, transition }
}

export function createAuditLog(event: GridEvent, user: UserInfo, action: ActionType, transition: StateTransition | undefined, details: string): AuditLogEntry {
  return {
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    timestamp: Date.now(),
    operatorId: user.id,
    operatorName: user.name,
    operatorRole: user.role,
    action: action,
    fromStatus: transition?.from || event.status,
    toStatus: transition?.to,
    details,
    versionBefore: event.version,
    versionAfter: event.version + 1
  }
}

export function validateOptimisticLock(submittedVersion: number, currentVersion: number): { valid: boolean; error?: string } {
  if (submittedVersion !== currentVersion) return { valid: false, error: '版本冲突：提交版本 v' + submittedVersion + '，当前版本 v' + currentVersion + '。请刷新后重试。' }
  return { valid: true }
}

export function validateDisposalSubmission(content: string, summary: string): { valid: boolean; error?: string } {
  if (!content || !content.trim()) return { valid: false, error: '处置备注不能为空' }
  if (content.trim().length < 5) return { valid: false, error: '处置备注至少 5 个字符' }
  if (!summary || !summary.trim()) return { valid: false, error: '处置结果摘要不能为空' }
  return { valid: true }
}
