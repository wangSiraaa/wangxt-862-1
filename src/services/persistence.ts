import type { URLState, FilterState, UserRole, AuditLogEntry, DraftDisposal } from '@/types'

const URL_STATE_KEY = 'gch_url_state'
const DRAFT_KEY_PREFIX = 'gch_draft_'
const AUDIT_LOG_KEY = 'gch_audit_log'
const STATE_VERSION = 1

export const DEFAULT_FILTERS: FilterState = {
  severity: 'all',
  status: 'all',
  gridId: 'all',
  assigneeRole: 'all',
  keyword: '',
  onlyOverdue: false,
  onlyFlagged: false,
  onlyUnclosed: true,
  sortBy: 'priority'
}

export const DEFAULT_URL_STATE: URLState = {
  role: 'commander',
  filters: { ...DEFAULT_FILTERS },
  mapZoom: 1,
  mapCenter: { x: 500, y: 400 },
  fullscreen: false,
  viewMode: 'hybrid'
}

// =============== Base64URL ===============
function b64urlEncode(obj: unknown): string {
  try {
    const json = JSON.stringify(obj)
    // btoa 对 UTF-8 不安全，先转字节
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const b64 = btoa(binary)
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch {
    return ''
  }
}

function b64urlDecode<T = unknown>(s: string): T | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const binary = atob(b64 + pad)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

// =============== localStorage ===============
function safeLSGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeLSSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* noop */
  }
}
function safeLSRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* noop */
  }
}

// =============== URL 状态读写 ===============
export function updateBrowserURL(state: URLState) {
  const params = new URLSearchParams()
  params.set('role', state.role)
  params.set('z', String(state.mapZoom))
  params.set('cx', String(state.mapCenter.x))
  params.set('cy', String(state.mapCenter.y))
  params.set('fs', state.fullscreen ? '1' : '0')
  params.set('vm', state.viewMode)
  if (state.selectedEventId) params.set('eid', state.selectedEventId)
  if (state.selectedRouteId) params.set('rid', state.selectedRouteId)
  if (state.draftEventId) params.set('did', state.draftEventId)

  const fChanged =
    JSON.stringify(state.filters) !== JSON.stringify(DEFAULT_FILTERS)
  if (fChanged) {
    const enc = b64urlEncode(state.filters)
    if (enc) params.set('f', enc)
  }

  const hash = '#/?' + params.toString()
  const current = window.location.hash || '#/'
  if (current !== hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search + hash)
  }
}

export function parseFiltersFromURL(params: URLSearchParams): FilterState | null {
  const fStr = params.get('f')
  if (!fStr) return null
  const parsed = b64urlDecode<FilterState>(fStr)
  if (!parsed) return null
  // 合并默认，防止老版本缺字段
  return { ...DEFAULT_FILTERS, ...parsed }
}

export function parseURLState(): { state: Partial<URLState>; hasURL: boolean } {
  try {
    const raw = window.location.hash.replace(/^#\/?\??/, '')
    const params = new URLSearchParams(raw)
    if (params.toString().length === 0) return { state: {}, hasURL: false }

    const partial: Partial<URLState> = {}
    const role = params.get('role') as UserRole | null
    if (role && ['commander', 'grid', 'patrol', 'inspector'].includes(role)) {
      partial.role = role
    }
    const z = params.get('z')
    if (z) partial.mapZoom = Math.max(0.3, Math.min(3, Number(z) || 1))
    const cx = params.get('cx')
    const cy = params.get('cy')
    if (cx && cy) {
      partial.mapCenter = { x: Number(cx) || 500, y: Number(cy) || 400 }
    }
    const fs = params.get('fs')
    if (fs) partial.fullscreen = fs === '1'
    const vm = params.get('vm') as URLState['viewMode']
    if (vm && ['heatmap', 'grid', 'hybrid'].includes(vm)) {
      partial.viewMode = vm
    }
    const eid = params.get('eid')
    if (eid) partial.selectedEventId = eid
    const rid = params.get('rid')
    if (rid) partial.selectedRouteId = rid
    const did = params.get('did')
    if (did) partial.draftEventId = did
    const filters = parseFiltersFromURL(params)
    if (filters) partial.filters = filters
    return { state: partial, hasURL: true }
  } catch {
    return { state: {}, hasURL: false }
  }
}

// =============== LocalStorage 持久化 ===============
export function saveToLocalStorage(state: URLState) {
  const payload = { v: STATE_VERSION, state, ts: Date.now() }
  safeLSSet(URL_STATE_KEY, JSON.stringify(payload))
}

export function loadFromLocalStorage(): URLState | null {
  const raw = safeLSGet(URL_STATE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.v !== STATE_VERSION || !parsed?.state) return null
    // 合并默认值
    const base: URLState = { ...DEFAULT_URL_STATE, ...parsed.state }
    base.filters = { ...DEFAULT_FILTERS, ...(parsed.state.filters || {}) }
    base.mapCenter = { ...DEFAULT_URL_STATE.mapCenter, ...(parsed.state.mapCenter || {}) }
    return base
  } catch {
    return null
  }
}

// =============== 草稿 ===============
function draftKey(eventId: string): string {
  return DRAFT_KEY_PREFIX + eventId
}

export function saveDraft(d: DraftDisposal) {
  safeLSSet(draftKey(d.eventId), JSON.stringify(d))
}

export function loadDraft(eventId: string): DraftDisposal | null {
  const raw = safeLSGet(draftKey(eventId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as DraftDisposal
  } catch {
    return null
  }
}

export function hasDraft(eventId: string): boolean {
  return !!safeLSGet(draftKey(eventId))
}

export function clearDraft(eventId: string) {
  safeLSRemove(draftKey(eventId))
}

// =============== 审计日志（localStorage 存档，用于恢复后回溯） ===============
export function appendAuditLog(entry: AuditLogEntry) {
  const list = restoreAuditLog()
  list.unshift(entry)
  // 只保留最近 1000 条避免过大
  const trimmed = list.slice(0, 1000)
  safeLSSet(AUDIT_LOG_KEY, JSON.stringify(trimmed))
}

export function restoreAuditLog(): AuditLogEntry[] {
  const raw = safeLSGet(AUDIT_LOG_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as AuditLogEntry[]) : []
  } catch {
    return []
  }
}

// =============== 初始化：URL 优先 + 冲突写入审计 ===============
export function loadInitialState(): { state: URLState; restoreAudit: AuditLogEntry | null } {
  const fromLS = loadFromLocalStorage()
  const { state: fromURL, hasURL } = parseURLState()

  // 先从默认/本地构建
  const base: URLState = fromLS ? { ...fromLS } : { ...DEFAULT_URL_STATE }
  base.filters = { ...DEFAULT_FILTERS, ...(base.filters || {}) }
  base.mapCenter = { ...DEFAULT_URL_STATE.mapCenter, ...(base.mapCenter || {}) }

  let conflict = false
  let conflictFields: string[] = []

  if (hasURL) {
    // 以 URL 为准
    const keys: (keyof URLState)[] = [
      'role',
      'mapZoom',
      'fullscreen',
      'viewMode',
      'selectedEventId',
      'selectedRouteId',
      'draftEventId'
    ] as const
    for (const k of keys) {
      if (k in fromURL && (fromURL as any)[k] !== undefined) {
        if (fromLS && (fromLS as any)[k] !== (fromURL as any)[k]) {
          conflict = true
          conflictFields.push(k)
        }
        ;(base as any)[k] = (fromURL as any)[k]
      }
    }
    if ('mapCenter' in fromURL && fromURL.mapCenter) {
      if (
        fromLS &&
        (fromLS.mapCenter.x !== fromURL.mapCenter.x || fromLS.mapCenter.y !== fromURL.mapCenter.y)
      ) {
        conflict = true
        conflictFields.push('mapCenter')
      }
      base.mapCenter = { ...fromURL.mapCenter }
    }
    if (fromURL.filters) {
      if (
        fromLS &&
        JSON.stringify(fromLS.filters) !== JSON.stringify(fromURL.filters)
      ) {
        conflict = true
        conflictFields.push('filters')
      }
      base.filters = { ...fromURL.filters }
    }
  }

  let restoreAudit: AuditLogEntry | null = null
  if (hasURL && (conflict || !fromLS)) {
    restoreAudit = {
      id: 'restore_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      timestamp: Date.now(),
      operatorId: 'system',
      operatorName: '系统',
      operatorRole: (base.role || 'commander') as UserRole,
      action: 'state_restore',
      details: conflict
        ? `从 URL 恢复并覆盖本地缓存（冲突字段: ${conflictFields.join(', ')}）`
        : '从 URL 初始化状态（无本地缓存）',
      versionBefore: undefined,
      versionAfter: undefined
    }
  }

  return { state: base, restoreAudit }
}

// =============== CSV 导出 ===============
function csvEscape(s: unknown): string {
  const v = String(s ?? '')
  if (/[",\n\r]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

export function exportAuditLogsAsCSV(entries: AuditLogEntry[]): string {
  const headers = [
    '时间',
    '操作人ID',
    '操作人',
    '操作角色',
    '动作',
    '源状态',
    '目标状态',
    '详情',
    '版本前',
    '版本后'
  ]
  const statusLabel: Record<string, string> = {
    pending_review: '待研判',
    dispatched: '已派发',
    processing: '处理中',
    pending_review_result: '待复核',
    closed: '已结案',
    rejected: '已驳回'
  }
  const roleLabel: Record<string, string> = {
    commander: '指挥员',
    grid: '网格员',
    patrol: '巡逻队',
    inspector: '督导员',
    system: '系统'
  }
  const rows = entries.map((e) => [
    new Date(e.timestamp).toLocaleString('zh-CN', { hour12: false }),
    e.operatorId,
    e.operatorName,
    roleLabel[e.operatorRole] || e.operatorRole,
    e.action,
    e.fromStatus ? statusLabel[e.fromStatus] || e.fromStatus : '',
    e.toStatus ? statusLabel[e.toStatus] || e.toStatus : '',
    e.details,
    e.versionBefore ?? '',
    e.versionAfter ?? ''
  ])
  const lines = [headers, ...rows].map((r) => r.map(csvEscape).join(','))
  // UTF-8 BOM 以便 Excel 正确识别中文
  return '\uFEFF' + lines.join('\r\n')
}

export function triggerCSVDownload(filename: string, csvContent: string) {
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    // 兜底：新窗口打开 base64
    const b64 = btoa(unescape(encodeURIComponent(csvContent)))
    window.open('data:text/csv;charset=utf-8;base64,' + b64)
  }
}
