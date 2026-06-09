export type UserRole = 'commander' | 'grid' | 'patrol' | 'inspector'

export const ROLE_LABELS: Record<UserRole, string> = {
  commander: '指挥员',
  grid: '网格员',
  patrol: '巡逻队',
  inspector: '督导员'
}

export type EventSeverity = 'critical' | 'high' | 'medium' | 'low'

export const SEVERITY_LABELS: Record<EventSeverity, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低'
}

export const SEVERITY_ORDER: Record<EventSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
}

export const SEVERITY_COLORS: Record<EventSeverity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
}

export type EventStatus =
  | 'pending_review'
  | 'dispatched'
  | 'processing'
  | 'pending_review_result'
  | 'closed'
  | 'rejected'

export const STATUS_LABELS: Record<EventStatus, string> = {
  pending_review: '待研判',
  dispatched: '已派发',
  processing: '处理中',
  pending_review_result: '待复核',
  closed: '已结案',
  rejected: '已驳回'
}

export const STATUS_COLORS: Record<EventStatus, string> = {
  pending_review: '#94a3b8',
  dispatched: '#3b82f6',
  processing: '#8b5cf6',
  pending_review_result: '#f59e0b',
  closed: '#22c55e',
  rejected: '#ef4444'
}

export const CLOSED_STATUSES: EventStatus[] = ['closed', 'rejected']

export interface GridInfo {
  id: string
  name: string
  area: string
  centerX: number
  centerY: number
  polygon: { x: number; y: number }[]
  population: number
  riskLevel: 'high' | 'medium' | 'low'
  responsibleIds: string[]
}

export interface AuditLogEntry {
  id: string
  timestamp: number
  operatorId: string
  operatorName: string
  operatorRole: UserRole
  action: string
  fromStatus?: EventStatus
  toStatus?: EventStatus
  details: string
  versionBefore?: number
  versionAfter?: number
}

export interface DispatchNote {
  id: string
  timestamp: number
  operatorId: string
  operatorName: string
  content: string
}

export interface DisposalRecord {
  id: string
  timestamp: number
  operatorId: string
  operatorName: string
  arrivalTime?: number
  content: string
  photos?: string[]
  resultSummary: string
}

export interface InspectionRecord {
  id: string
  timestamp: number
  operatorId: string
  operatorName: string
  score: number
  findings: string
  flagged: boolean
  recommendation: string
}

export interface ReviewRecord {
  id: string
  timestamp: number
  operatorId: string
  operatorName: string
  approved: boolean
  reason: string
}

export interface GridEvent {
  id: string
  title: string
  description: string
  severity: EventSeverity
  status: EventStatus
  gridId: string
  gridName: string
  address: string
  location: { x: number; y: number }
  deadline: number
  createdAt: number
  updatedAt: number
  reporter: string
  reporterContact?: string
  assigneeId?: string
  assigneeName?: string
  assigneeRole?: UserRole
  version: number
  markedByInspector: boolean
  markedByInspectorAt?: number
  markedByInspectorName?: string
  auditLog: AuditLogEntry[]
  dispatchNotes: DispatchNote[]
  disposalRecord?: DisposalRecord
  inspectionRecord?: InspectionRecord
  reviewRecord?: ReviewRecord
  selectedRouteId?: string
  arrivalTime?: number
  tags: string[]
}

export interface RoutePoint {
  x: number
  y: number
  label: string
  type: 'start' | 'waypoint' | 'risk' | 'destination'
  riskNote?: string
}

export interface PatrolRoute {
  id: string
  name: string
  points: RoutePoint[]
  estimatedMinutes: number
  distanceKm: number
  riskPoints: number
  riskLevel: 'high' | 'medium' | 'low'
  coveredGridIds: string[]
  coveredGridNames: string[]
  trafficLights: number
  mainRoads: string[]
  description: string
}

export interface UserInfo {
  id: string
  name: string
  role: UserRole
  avatar: string
  team: string
  area: string
  gridIds?: string[]
  capabilities: string[]
}

export interface FilterState {
  severity: EventSeverity | 'all'
  status: EventStatus | 'all'
  gridId: string | 'all'
  assigneeRole: UserRole | 'all'
  keyword: string
  onlyOverdue: boolean
  onlyFlagged: boolean
  onlyUnclosed: boolean
  dateFrom?: number
  dateTo?: number
  sortBy: 'priority' | 'updated' | 'created' | 'deadline'
}

export interface URLState {
  role: UserRole
  filters: FilterState
  selectedEventId?: string
  mapZoom: number
  mapCenter: { x: number; y: number }
  fullscreen: boolean
  selectedRouteId?: string
  draftEventId?: string
  viewMode: 'heatmap' | 'grid' | 'hybrid'
}

export interface DraftDisposal {
  eventId: string
  versionSaved: number
  savedAt: number
  content: string
  resultSummary: string
  arrivalTime?: number
  photos: string[]
}

export type ActionType =
  | 'create_task'
  | 'dispatch'
  | 'accept'
  | 'sign_arrival'
  | 'submit_disposal'
  | 'inspect'
  | 'review_approve'
  | 'review_reject'
  | 'reopen'

export interface StateTransition {
  from: EventStatus
  to: EventStatus
  action: ActionType
  allowedRoles: UserRole[]
  label: string
  description: string
}
