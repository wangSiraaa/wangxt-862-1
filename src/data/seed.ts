import type {
  GridInfo,
  UserInfo,
  GridEvent,
  PatrolRoute,
  RoutePoint,
  UserRole,
  EventSeverity,
  EventStatus
} from '@/types'

const NOW = Date.now()
const HOUR = 3600_000
const MIN = 60_000

function makePolygon(
  cx: number,
  cy: number,
  w: number,
  h: number
): { x: number; y: number }[] {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 }
  ]
}

export const GRIDS: GridInfo[] = [
  {
    id: 'G001',
    name: '城东中心区',
    area: '城东街道',
    centerX: 200,
    centerY: 200,
    polygon: makePolygon(200, 200, 180, 160),
    population: 12800,
    riskLevel: 'high',
    responsibleIds: ['u_grid_zhang', 'u_patrol_tiger']
  },
  {
    id: 'G002',
    name: '城西商业区',
    area: '城西街道',
    centerX: 500,
    centerY: 200,
    polygon: makePolygon(500, 200, 180, 160),
    population: 8600,
    riskLevel: 'medium',
    responsibleIds: ['u_grid_li', 'u_patrol_phoenix']
  },
  {
    id: 'G003',
    name: '城南工业区',
    area: '城南街道',
    centerX: 800,
    centerY: 200,
    polygon: makePolygon(800, 200, 180, 160),
    population: 5200,
    riskLevel: 'high',
    responsibleIds: ['u_grid_wang', 'u_patrol_tiger']
  },
  {
    id: 'G004',
    name: '城北文教园',
    area: '城北街道',
    centerX: 200,
    centerY: 500,
    polygon: makePolygon(200, 500, 180, 160),
    population: 15600,
    riskLevel: 'low',
    responsibleIds: ['u_grid_zhang', 'u_patrol_dragon']
  },
  {
    id: 'G005',
    name: '城中政务区',
    area: '城中街道',
    centerX: 500,
    centerY: 500,
    polygon: makePolygon(500, 500, 180, 160),
    population: 6400,
    riskLevel: 'medium',
    responsibleIds: ['u_grid_li', 'u_patrol_dragon']
  },
  {
    id: 'G006',
    name: '城乡结合区',
    area: '城郊乡',
    centerX: 800,
    centerY: 500,
    polygon: makePolygon(800, 500, 180, 160),
    population: 4100,
    riskLevel: 'medium',
    responsibleIds: ['u_grid_wang', 'u_patrol_phoenix']
  }
]

export const USERS: UserInfo[] = [
  {
    id: 'u_cmd_zhao',
    name: '赵指挥',
    role: 'commander',
    avatar: '👮‍♂️',
    team: '指挥一组',
    area: '全区',
    capabilities: ['dispatch', 'review', 'reopen', 'create_task', 'flag_inspection']
  },
  {
    id: 'u_grid_zhang',
    name: '张网格',
    role: 'grid',
    avatar: '🧑‍💼',
    team: '网格东组',
    area: '城东、城北片区',
    gridIds: ['G001', 'G004'],
    capabilities: ['accept', 'sign_arrival', 'submit_disposal']
  },
  {
    id: 'u_grid_li',
    name: '李网格',
    role: 'grid',
    avatar: '👩‍💼',
    team: '网格西组',
    area: '城西、城中片区',
    gridIds: ['G002', 'G005'],
    capabilities: ['accept', 'sign_arrival', 'submit_disposal']
  },
  {
    id: 'u_grid_wang',
    name: '王网格',
    role: 'grid',
    avatar: '👨‍💼',
    team: '网格南组',
    area: '城南、城郊片区',
    gridIds: ['G003', 'G006'],
    capabilities: ['accept', 'sign_arrival', 'submit_disposal']
  },
  {
    id: 'u_patrol_tiger',
    name: '虎巡逻',
    role: 'patrol',
    avatar: '🚓',
    team: '猛虎巡逻队',
    area: '东城区机动',
    capabilities: ['accept', 'sign_arrival', 'submit_disposal', 'route_select']
  },
  {
    id: 'u_patrol_phoenix',
    name: '凤巡逻',
    role: 'patrol',
    avatar: '🚨',
    team: '凤凰巡逻队',
    area: '西城区机动',
    capabilities: ['accept', 'sign_arrival', 'submit_disposal', 'route_select']
  },
  {
    id: 'u_patrol_dragon',
    name: '龙巡逻',
    role: 'patrol',
    avatar: '🚁',
    team: '飞龙巡逻队',
    area: '北城区机动',
    capabilities: ['accept', 'sign_arrival', 'submit_disposal', 'route_select']
  },
  {
    id: 'u_ins_sun',
    name: '孙督导',
    role: 'inspector',
    avatar: '🕵️',
    team: '督导组一组',
    area: '全区督导',
    capabilities: ['inspect', 'review', 'flag', 'reopen', 'export_audit']
  },
  {
    id: 'u_ins_qian',
    name: '钱督导',
    role: 'inspector',
    avatar: '🔍',
    team: '督导组二组',
    area: '西区督导',
    capabilities: ['inspect', 'review', 'flag', 'export_audit']
  }
]

export function getUserById(id: string): UserInfo | undefined {
  return USERS.find((u) => u.id === id)
}

export function getUsersByRole(role: UserRole): UserInfo[] {
  return USERS.filter((u) => u.role === role)
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

function makeEvent(
  idx: number,
  overrides: Partial<GridEvent> = {}
): GridEvent {
  const gridIndex = idx % GRIDS.length
  const grid = GRIDS[gridIndex]
  const createdAt = NOW - (idx + 1) * 25 * MIN - Math.random() * 10 * MIN
  const severities: EventSeverity[] = ['critical', 'high', 'medium', 'low']
  const sev: EventSeverity = severities[idx % 4]

  const deadlineMap: Record<EventSeverity, number> = {
    critical: createdAt + 30 * MIN,
    high: createdAt + 2 * HOUR,
    medium: createdAt + 6 * HOUR,
    low: createdAt + 24 * HOUR
  }

  const statuses: EventStatus[] = [
    'pending_review',
    'dispatched',
    'processing',
    'pending_review_result',
    'closed',
    'pending_review',
    'processing',
    'dispatched'
  ]
  const status = statuses[idx % statuses.length]

  const assigneesByRole: Record<UserRole, UserInfo[]> = {
    commander: getUsersByRole('commander'),
    grid: getUsersByRole('grid'),
    patrol: getUsersByRole('patrol'),
    inspector: getUsersByRole('inspector')
  }

  let assignee: UserInfo | undefined
  if (status === 'dispatched' || status === 'processing' || status === 'pending_review_result') {
    const gridWorkers = grid.responsibleIds
      .map((id) => getUserById(id))
      .filter((u): u is UserInfo => !!u)
    assignee = gridWorkers[idx % Math.max(1, gridWorkers.length)]
  } else if (status === 'closed') {
    const patrols = assigneesByRole.patrol
    assignee = patrols[idx % patrols.length]
  }

  const titles: Record<EventSeverity, string[]> = {
    critical: [
      '重大治安突发事件',
      '疑似群体性事件苗头',
      '紧急火灾隐患点',
      '重点区域异常聚集'
    ],
    high: [
      '高风险路段交通拥堵',
      '重点管控人员失联预警',
      '危化品存放隐患',
      '公共设施严重破坏'
    ],
    medium: [
      '商铺占道经营需整治',
      '老旧小区噪音投诉',
      '垃圾堆放未及时清运',
      '路灯故障持续3天'
    ],
    low: [
      '路面井盖松动建议维护',
      '小区绿化修剪建议',
      '公益宣传栏内容更新',
      '共享单车停放整理'
    ]
  }

  const titlePool = titles[sev]
  const title = titlePool[idx % titlePool.length] + ` #${idx + 1}`

  const location = {
    x: grid.centerX + (Math.random() - 0.5) * 80,
    y: grid.centerY + (Math.random() - 0.5) * 70
  }

  const base: GridEvent = {
    id: genId('EVT'),
    title,
    description: `在${grid.name}区域内发现${title}，需要相关人员尽快到场处理。`,
    severity: sev,
    status,
    gridId: grid.id,
    gridName: grid.name,
    address: `${grid.area}${grid.name}${idx + 3}号路${(idx * 17) % 100 + 1}号`,
    location,
    deadline: deadlineMap[sev],
    createdAt,
    updatedAt: createdAt + idx * 3 * MIN,
    reporter: ['群众热线', '网格员巡查', '视频监控AI', '巡逻队上报', '督导员抽检'][idx % 5],
    reporterContact: sev === 'critical' ? '139****' + String(1000 + idx * 37) : undefined,
    version: 1 + (idx % 5),
    markedByInspector: idx % 4 === 1 || sev === 'critical',
    markedByInspectorAt: idx % 4 === 1 ? createdAt + 8 * MIN : undefined,
    markedByInspectorName: idx % 4 === 1 ? getUsersByRole('inspector')[idx % 2].name : undefined,
    auditLog: [],
    dispatchNotes: [],
    tags: [sev, grid.id]
  }

  if (assignee) {
    base.assigneeId = assignee.id
    base.assigneeName = assignee.name
    base.assigneeRole = assignee.role
  }

  if (status === 'dispatched' || status === 'processing') {
    base.dispatchNotes.push({
      id: genId('DN'),
      timestamp: createdAt + 5 * MIN,
      operatorId: 'u_cmd_zhao',
      operatorName: '赵指挥',
      content: `请${assignee?.name || '相关人员'}立即前往处理，注意安全并及时反馈。`
    })
    base.auditLog.push({
      id: genId('AL'),
      timestamp: createdAt + 5 * MIN,
      operatorId: 'u_cmd_zhao',
      operatorName: '赵指挥',
      operatorRole: 'commander',
      action: 'dispatch',
      fromStatus: 'pending_review',
      toStatus: 'dispatched',
      details: '指挥员派发任务',
      versionBefore: 1,
      versionAfter: 2
    })
    base.version = Math.max(base.version, 2)
  }

  if (status === 'processing' || status === 'pending_review_result' || status === 'closed') {
    base.arrivalTime = createdAt + 22 * MIN
    base.auditLog.push({
      id: genId('AL'),
      timestamp: createdAt + 22 * MIN,
      operatorId: assignee?.id || 'u_grid_zhang',
      operatorName: assignee?.name || '张网格',
      operatorRole: assignee?.role || 'grid',
      action: 'sign_arrival',
      fromStatus: 'dispatched',
      toStatus: 'processing',
      details: `到达现场，签到时间：${new Date(createdAt + 22 * MIN).toLocaleTimeString()}`,
      versionBefore: 2,
      versionAfter: 3
    })
    base.version = Math.max(base.version, 3)
  }

  if (status === 'pending_review_result' || status === 'closed') {
    base.disposalRecord = {
      id: genId('DR'),
      timestamp: createdAt + 55 * MIN,
      operatorId: assignee?.id || 'u_grid_zhang',
      operatorName: assignee?.name || '张网格',
      arrivalTime: base.arrivalTime,
      content: `已抵达现场进行处置：疏导交通3起，劝解群众5人，设置临时警示标识2处。现场秩序已恢复正常。`,
      resultSummary: '已平息并完成初步处置，建议持续观察24小时',
      photos: []
    }
    base.auditLog.push({
      id: genId('AL'),
      timestamp: createdAt + 55 * MIN,
      operatorId: assignee?.id || 'u_grid_zhang',
      operatorName: assignee?.name || '张网格',
      operatorRole: assignee?.role || 'grid',
      action: 'submit_disposal',
      fromStatus: 'processing',
      toStatus: 'pending_review_result',
      details: '处置回填完成，等待复核',
      versionBefore: 3,
      versionAfter: 4
    })
    base.version = Math.max(base.version, 4)
    base.updatedAt = createdAt + 55 * MIN
  }

  if (status === 'closed') {
    base.reviewRecord = {
      id: genId('RR'),
      timestamp: createdAt + 80 * MIN,
      operatorId: 'u_cmd_zhao',
      operatorName: '赵指挥',
      approved: true,
      reason: '处置流程规范，记录完整，群众反馈良好，予以结案。'
    }
    base.auditLog.push({
      id: genId('AL'),
      timestamp: createdAt + 80 * MIN,
      operatorId: 'u_cmd_zhao',
      operatorName: '赵指挥',
      operatorRole: 'commander',
      action: 'review_approve',
      fromStatus: 'pending_review_result',
      toStatus: 'closed',
      details: '复核通过，事件结案',
      versionBefore: 4,
      versionAfter: 5
    })
    base.version = Math.max(base.version, 5)
    base.updatedAt = createdAt + 80 * MIN
  }

  if (base.markedByInspector && base.markedByInspectorAt) {
    base.inspectionRecord = {
      id: genId('IR'),
      timestamp: base.markedByInspectorAt,
      operatorId: 'u_ins_sun',
      operatorName: '孙督导',
      score: sev === 'critical' ? 72 : 85,
      findings:
        sev === 'critical'
          ? '发现现场录像不完整，建议补全影像资料'
          : '总体情况良好，建议加强后续走访',
      flagged: true,
      recommendation:
        sev === 'critical'
          ? '需要立即整改并二次复核'
          : '纳入月度重点关注清单'
    }
  }

  return { ...base, ...overrides }
}

export const EVENTS: GridEvent[] = Array.from({ length: 18 }, (_, i) => makeEvent(i))

// 为网格员张（u_grid_zhang）补充一个 processing 事件（落在他负责的 G004 区域）
// 这样在 smoke 测试中可以有 2 条他本人可操作的处置任务（供 Case5/Case6 分别使用）
{
  const grid = GRIDS.find((g) => g.id === 'G004')!
  const zhang = getUserById('u_grid_zhang')!
  const extra = makeEvent(18) // 独立生成不干扰 0-17
  extra.id = 'EVT_EXTRA_001'
  extra.status = 'processing'
  extra.severity = 'medium'
  extra.gridId = grid.id
  extra.gridName = grid.name
  extra.title = '北环路交通高峰管控值守 #19'
  extra.description = '北环路早高峰期间车流密集，需要网格员现场疏导交通、引导行人过街。'
  extra.address = `${grid.area}${grid.name}北段12号路口`
  extra.location = { x: grid.centerX + 20, y: grid.centerY - 30 }
  extra.assigneeId = zhang.id
  extra.assigneeName = zhang.name
  extra.assigneeRole = zhang.role
  extra.deadline = Date.now() + 5 * 60 * 1000 // 5分钟内即将超时
  extra.arrivalTime = Date.now() - 25 * 60 * 1000 // 已签到 25 分钟
  extra.markedByInspector = true // 督导标记，确保置顶
  extra.markedByInspectorAt = Date.now() - 20 * 60 * 1000
  extra.markedByInspectorName = '王督导'
  extra.auditLog.push({
    id: 'audit_seed_extra_001',
    timestamp: extra.createdAt + 2 * 60 * 1000,
    operatorId: 'u_commander_001',
    operatorName: '指挥员·中心',
    operatorRole: 'commander',
    action: 'dispatch',
    fromStatus: 'pending_review',
    toStatus: 'dispatched',
    details: '派发任务给张网格（北环路片区）',
    versionBefore: 1,
    versionAfter: 2
  })
  extra.auditLog.push({
    id: 'audit_seed_extra_002',
    timestamp: extra.arrivalTime,
    operatorId: zhang.id,
    operatorName: zhang.name,
    operatorRole: zhang.role,
    action: 'sign_arrival',
    fromStatus: 'processing',
    toStatus: 'processing',
    details: '张网格到场签到，开始现场处置',
    versionBefore: 3,
    versionAfter: 4
  })
  extra.version = 4
  EVENTS.push(extra)
}

function makeRoutesForEvent(
  event: GridEvent,
  patrolStartPoints: { x: number; y: number; name: string }[]
): PatrolRoute[] {
  const dest = event.location
  return patrolStartPoints.map((sp, idx) => {
    const midX = (sp.x + dest.x) / 2 + (idx % 2 === 0 ? 30 : -40)
    const midY = (sp.y + dest.y) / 2 + (idx % 2 === 0 ? -50 : 40)
    const hasRisk = idx % 2 === 1
    const points: RoutePoint[] = [
      { x: sp.x, y: sp.y, label: sp.name, type: 'start' },
      { x: midX - 20, y: midY + 10, label: '途经点A', type: 'waypoint' },
      ...(hasRisk
        ? [
            {
              x: midX + 20,
              y: midY - 15,
              label: '施工占道风险点',
              type: 'risk' as const,
              riskNote: '近期地铁施工，通行缓慢，建议减速'
            }
          ]
        : []),
      { x: midX + 60, y: midY + 20, label: '途经点B', type: 'waypoint' },
      { x: dest.x, y: dest.y, label: event.gridName, type: 'destination' }
    ]
    const estBase = 12 + idx * 5
    const est = hasRisk ? estBase + 8 : estBase
    const dist = +(0.8 + idx * 0.35 + (hasRisk ? 0.25 : 0)).toFixed(2)
    const coveredGrids = GRIDS.filter((g) => {
      const dx = Math.abs(g.centerX - (sp.x + dest.x) / 2)
      const dy = Math.abs(g.centerY - (sp.y + dest.y) / 2)
      return dx < 250 && dy < 200
    })
    return {
      id: `R_${event.id}_${idx}`,
      name: `方案${['一(快速)', '二(稳妥)', '三(经济)', '四(全面)'][idx]} · ${sp.name}出发`,
      points,
      estimatedMinutes: est,
      distanceKm: dist,
      riskPoints: hasRisk ? 1 : 0,
      riskLevel: hasRisk ? 'high' : idx === 0 ? 'low' : 'medium',
      coveredGridIds: coveredGrids.map((g) => g.id),
      coveredGridNames: coveredGrids.map((g) => g.name),
      trafficLights: 3 + idx * 2,
      mainRoads: [
        ['光明大道', '平安街'],
        ['人民中路', '环城快速'],
        ['长江大道', '建设大街'],
        ['自由路', '文教区小路', '河堤便道']
      ][idx],
      description: `从${sp.name}出发，经${points.length - 2}个途经点抵达${event.gridName}。`
    }
  })
}

const PATROL_STARTS = [
  { x: 60, y: 60, name: '东卡口巡逻站' },
  { x: 940, y: 90, name: '南警务站' },
  { x: 100, y: 620, name: '北移动岗亭' },
  { x: 880, y: 640, name: '西综合检查站' }
]

export function getRoutesForEvent(event: GridEvent): PatrolRoute[] {
  return makeRoutesForEvent(event, PATROL_STARTS)
}

export function getGridById(id: string): GridInfo | undefined {
  return GRIDS.find((g) => g.id === id)
}

export function getEventById(id: string): GridEvent | undefined {
  return EVENTS.find((e) => e.id === id)
}
