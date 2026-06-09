import type { GridEvent } from '@/types'
import { CLOSED_STATUSES, SEVERITY_ORDER } from '@/types'

export function isOverdue(event: GridEvent): boolean {
  return Date.now() > event.deadline && !CLOSED_STATUSES.includes(event.status)
}

export function getOverdueMinutes(event: GridEvent): number {
  if (!isOverdue(event)) return 0
  return Math.floor((Date.now() - event.deadline) / 60000)
}

export function computePriorityScore(event: GridEvent): {
  unclosedScore: number
  overdueScore: number
  flaggedScore: number
  severityScore: number
  updatedScore: number
  total: number
} {
  const unclosedScore = CLOSED_STATUSES.includes(event.status) ? 0 : 1000000
  const overdueScore = isOverdue(event) ? 100000 + getOverdueMinutes(event) * 10 : 0
  const flaggedScore = event.markedByInspector ? 10000 : 0
  const severityScore = SEVERITY_ORDER[event.severity] * 1000
  const updatedScore = event.updatedAt / 100000
  const total = unclosedScore + overdueScore + flaggedScore + severityScore + updatedScore
  return {
    unclosedScore,
    overdueScore,
    flaggedScore,
    severityScore,
    updatedScore,
    total
  }
}

export function prioritySort(events: GridEvent[]): GridEvent[] {
  return [...events].sort((a, b) => {
    const scoreA = computePriorityScore(a).total
    const scoreB = computePriorityScore(b).total
    if (scoreB !== scoreA) return scoreB - scoreA
    return b.updatedAt - a.updatedAt
  })
}

export function stablePrioritySort(events: GridEvent[]): GridEvent[] {
  return [...events].sort((a, b) => {
    const aClosed = CLOSED_STATUSES.includes(a.status) ? 1 : 0
    const bClosed = CLOSED_STATUSES.includes(b.status) ? 1 : 0
    if (aClosed !== bClosed) return aClosed - bClosed

    const aOverdue = isOverdue(a) ? 1 : 0
    const bOverdue = isOverdue(b) ? 1 : 0
    if (aOverdue !== bOverdue) return bOverdue - aOverdue

    if (aOverdue && bOverdue) {
      const overdueDiff = getOverdueMinutes(b) - getOverdueMinutes(a)
      if (overdueDiff !== 0) return overdueDiff
    }

    if (a.markedByInspector !== b.markedByInspector) {
      return a.markedByInspector ? -1 : 1
    }

    const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
    if (sevDiff !== 0) return sevDiff

    const timeDiff = b.updatedAt - a.updatedAt
    if (timeDiff !== 0) return timeDiff

    return a.id.localeCompare(b.id)
  })
}

export function groupByGrid(events: GridEvent[]): Map<string, GridEvent[]> {
  const map = new Map<string, GridEvent[]>()
  for (const event of events) {
    const arr = map.get(event.gridId) || []
    arr.push(event)
    map.set(event.gridId, arr)
  }
  return map
}

export function computeGridHeatIntensity(events: GridEvent[]): {
  gridId: string
  count: number
  unclosedCount: number
  criticalCount: number
  overdueCount: number
  intensity: number
  events: GridEvent[]
}[] {
  const byGrid = groupByGrid(events)
  const result: {
    gridId: string
    count: number
    unclosedCount: number
    criticalCount: number
    overdueCount: number
    intensity: number
    events: GridEvent[]
  }[] = []

  byGrid.forEach((gridEvents, gridId) => {
    const unclosed = gridEvents.filter((e) => !CLOSED_STATUSES.includes(e.status))
    const critical = gridEvents.filter(
      (e) => e.severity === 'critical' && !CLOSED_STATUSES.includes(e.status)
    )
    const overdue = gridEvents.filter(isOverdue)

    const intensity = Math.min(
      1,
      unclosed.length * 0.15 + critical.length * 0.25 + overdue.length * 0.2
    )

    result.push({
      gridId,
      count: gridEvents.length,
      unclosedCount: unclosed.length,
      criticalCount: critical.length,
      overdueCount: overdue.length,
      intensity,
      events: stablePrioritySort(gridEvents)
    })
  })

  return result.sort((a, b) => b.intensity - a.intensity)
}
