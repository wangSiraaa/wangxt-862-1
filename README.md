# 布控网格热力图 · 离线指挥中心

基于 Vue 3 + TypeScript + Tailwind CSS + Vite 的布控网格热力图前端系统，**不接真实后端**，完整离线可用。

## ✨ 特性清单

### 👥 4 种角色，权限隔离
| 角色 | 权限 |
| --- | --- |
| 🎖️ 指挥员 | 创建布控任务、派发、复核通过/驳回、重新打开、导出审计 |
| 🧑‍💼 网格员 | 接派发单、到场签到、提交处置回填 |
| 🚓 巡逻队 | 接单、到场签到、处置回填、选择 4 条路线方案 |
| 🕵️ 督导员 | 督导抽检打分、标记重点、复核、重新打开 |

### 🔄 状态机
严格按 **待研判 → 已派发 → 处理中 → 待复核 → 已结案 / 已驳回** 流转。
每个迁移仅特定角色可触发，页面按钮和领域函数 `validateTransition` 双重阻止非法操作。

### 📊 稳定排序（热力层 / 列表 / 抽屉三处一致）
1. **未结案优先**（已结案/已驳回降到底部）
2. **超时优先**（deadline 已过，越久越靠前）
3. **督导标记优先**（markedByInspector 置顶）
4. **严重等级**（紧急/高/中/低）
5. **更新时间倒序**
6. **ID 字典序**（最终 tie-break，保证刷新后顺序不变）

### 💾 状态持久化
URL 编码 + localStorage 双写，刷新完整恢复：
- 筛选条件（`f` 参数 Base64URL 编码）
- 角色 `role`
- 选中事件 `eid`
- 地图缩放/中心 `z / cx / cy`
- 全屏、视图模式、选中路线
- 未提交处置草稿（独立 localStorage 键）
- **URL 与本地缓存冲突时，以 URL 为准，并写入一条 `state_restore` 审计记录**

### 🗺️ 路线规划
每个事件自动生成 **4 条路线方案**，显示：
- 预计到场时间 ETA、距离、红绿灯数
- 风险点（红色标注 + tooltip）
- 覆盖网格
- 不同风险等级色标
**选择路线后联动热力图高亮渲染虚线 + 起终点标记**

### 🔐 前端乐观锁
每个事件 `version` 单调递增，提交时：
- 携带 `submittedVersion`
- `validateOptimisticLock` 校验，不匹配直接失败并提示刷新
- 抽屉内提供「模拟版本冲突」按钮，故意将提交版本设为 `version - 1` 以验证

### 💿 离线草稿
处置回填支持：
- `存草稿` → 离线写入 localStorage（按事件 ID）
- 下次打开自动提示「有离线草稿」，`恢复草稿` / `丢弃`
- 草稿提交成功后自动清理
- **草稿恢复成功写入一条审计**

### 📋 审计导出
- 事件审计日志 + 全局恢复审计
- 一键导出 UTF-8 BOM CSV，Excel 可直接打开
- 包含时间、操作人、角色、操作、源/目标状态、详情、版本号变化

## 🚀 一键启动

### 方式 1：Docker（固定端口 9528）
```bash
docker compose up -d --build
# 打开 http://localhost:9528
```

### 方式 2：本地 Node（端口 9528）
```bash
npm install
npm run dev     # 开发模式（http://localhost:9528）
npm run build   # 生产构建 → dist/
npm run preview # 预览构建产物（http://localhost:9528）
```

### 方式 3：一键运行脚本
```bash
./scripts/start.sh        # macOS / Linux
.\scripts\start.ps1       # Windows PowerShell
```

## ✅ 自动化 Smoke 测试

使用 Puppeteer 串行验证 6 项关键场景：
```bash
npm run build
npm run smoke
```

**测试清单（串行执行，前项失败立即终止）**：

| # | 用例 | 验证点 |
| --- | --- | --- |
| 1 | 复杂筛选写入 URL 并刷新恢复 | 设置严重等级=紧急、状态=处理中、仅超时+督导标记 → URL 包含 `f=...` → 刷新 → 筛选器值全部还原 |
| 2 | 高等级+超时+督导事件置顶 | 切到督导员 → 列表第一条：未结案 ✔ + 超时 ✔ + 督导标记 ✔ + 等级非低 ✔ → 热力图第一个 marker 与列表首项 ID 一致 |
| 3 | 巡逻队尝试直接结案失败 | 切巡逻队 → 选一条 processing → 无「复核通过」按钮 ✔ → 尝试直接调用 `reviewApprove` → 被领域函数拒绝 ✔ |
| 4 | 网格员提交空处置备注失败 | 切网格员 → 选一条 processing → 打开处置 → 空备注提交 → Toast 错误 ✔ → 事件状态未变 ✔ |
| 5 | 旧 version 重复提交失败 | 切网格员 → 选事件 → 打开「模拟版本冲突」→ 填处置内容提交 → Toast 报告版本冲突 ✔ → 事件 version 未递增 ✔ → 关闭模拟 → 正常提交成功 ✔ |
| 6 | 离线草稿恢复后可继续提交并写入审计 | 切网格员 → 填处置内容 → 存草稿 → 刷新 → 提示「有离线草稿」→ 恢复 → 提交成功 → 审计日志新增两条（草稿恢复 + 提交处置） |

脚本退出码：0 = 全部通过，非 0 = 失败，stdout 详细记录每步结果。

## 📁 项目结构
```
src/
├── components/         # UI 组件（RoleSwitcher/FilterBar/HeatMap/EventList/EventDrawer/CreateTaskModal/GlobalToast）
├── views/CommandCenter.vue
├── stores/main.ts      # Pinia 全局状态（事件、排序、持久化、所有动作）
├── services/
│   ├── stateMachine.ts # 状态迁移矩阵 + 角色权限 + 乐观锁 + 处置校验
│   ├── sorting.ts      # 稳定排序算法 + 热力聚合计算
│   └── persistence.ts  # URL ↔ 状态、localStorage、CSV 导出
├── data/seed.ts        # 6 网格、9 用户、18 事件、4 路线/事件 种子数据
├── types/index.ts      # 完整领域模型
├── router/ & styles/ & App.vue & main.ts
scripts/
├── smoke.mjs           # Puppeteer smoke 测试
├── start.sh / start.ps1
Dockerfile / docker-compose.yml  # 一键容器化
```

## 🧠 领域模型（核心）

```typescript
interface GridEvent {
  id, title, description
  severity: critical | high | medium | low
  status:   pending_review → dispatched → processing → pending_review_result → closed | rejected
  gridId, gridName, address
  location: { x, y }
  deadline, createdAt, updatedAt
  reporter, reporterContact?
  assigneeId?, assigneeName?, assigneeRole?
  version: number                     // 乐观锁
  markedByInspector, flaggedAt, flaggedByName
  auditLog: AuditLogEntry[]           // 每次操作版本自增
  dispatchNotes, disposalRecord?,
  inspectionRecord?, reviewRecord?,
  selectedRouteId?, arrivalTime?,
  tags: string[]
}
```

## 🔧 技术栈
- Vue 3.4 + `<script setup>` + Composition API
- TypeScript 5.4（严格模式）
- Pinia 2.1 状态管理
- Vite 5.1 构建
- Tailwind CSS 3.4
- lucide-vue-next 图标
- Puppeteer 22 E2E smoke
- Docker + nginx 1.27 alpine（固定端口 9528）

## 📝 版本历史
- v1.0.0 完整离线指挥中心交付
