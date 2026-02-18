# Components Reference

SPM Simulator 可复用组件文档。组件位于 `src/components/` 和 `src/pages/RiskOverview/` 子目录。

---

## 通用组件 (`src/components/`)

### MaterialTable

材料数据表格，支持行选择和虚拟滚动。

```tsx
import MaterialTable from '../components/MaterialTable';

<MaterialTable
  dataSource={materials}
  selectedRowKeys={[1, 2, 3]}
  onSelectionChange={(keys) => setSelectedIds(keys)}
  scrollY={300}
  virtual={materials.length >= 200}
  extraColumns={[
    { title: '客户', dataIndex: 'customer_name', width: 100 },
  ]}
/>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `dataSource` | `Material[]` | (必填) | 材料数据源 |
| `selectedRowKeys` | `number[]` | (必填) | 选中行 ID 列表 |
| `onSelectionChange` | `(keys: number[]) => void` | (必填) | 选择变化回调 |
| `scrollY` | `number` | `200` | 表格滚动区域高度 |
| `extraColumns` | `TableColumnsType<Material>` | - | 追加的自定义列 |
| `virtual` | `boolean` | - | 启用 Ant Table 虚拟滚动（建议 200+ 行时启用） |

内置列: 卷号、钢种、宽度、厚度、重量。已包裹 `React.memo`。

---

### DeferredEChart

基于 IntersectionObserver 的懒加载 ECharts 容器。图表进入可视区域后才渲染，减少首屏开销。

```tsx
import * as echarts from 'echarts/core';
import DeferredEChart from '../components/DeferredEChart';

<DeferredEChart
  echarts={echarts}
  option={pieOption}
  style={{ height: 220 }}
  onEvents={{ click: handleChartClick }}
/>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `echarts` | `unknown` | (必填) | echarts 核心实例 |
| `option` | `unknown` | (必填) | ECharts option 对象（建议 `useMemo` 稳定引用） |
| `style` | `CSSProperties` | - | 外层容器样式 |
| `className` | `string` | - | 外层容器 CSS 类名 |
| `onEvents` | `unknown` | - | ECharts 事件监听（如 `{ click: fn }`） |
| `rootMargin` | `string` | `'120px 0px'` | IntersectionObserver rootMargin |
| `placeholder` | `ReactNode` | 默认文字 | 图表未加载时的占位内容 |
| `notMerge` | `boolean` | - | 传递给 echarts-for-react |
| `lazyUpdate` | `boolean` | - | 传递给 echarts-for-react |

已包裹 `React.memo`。为避免不必要的重渲染，**调用方应确保 `option` 通过 `useMemo` 缓存**。

---

### PlanStatusTag

方案状态标签，根据 `status` 自动映射颜色和文本。

```tsx
import PlanStatusTag from '../components/PlanStatusTag';

<PlanStatusTag status="scheduled" />
```

| Prop | 类型 | 说明 |
|------|------|------|
| `status` | `string` | 方案状态码（`draft` / `scheduled` / `saved` / `archived`） |
| `style` | `CSSProperties` | 自定义样式 |

已包裹 `React.memo`。颜色映射来自 `constants/schedule.ts` 的 `planStatusColorMap`。

---

### RiskSeverityTag

风险严重度标签。

```tsx
import RiskSeverityTag from '../components/RiskSeverityTag';

<RiskSeverityTag severity="high" />
```

| Prop | 类型 | 说明 |
|------|------|------|
| `severity` | `string` | 严重度级别（`high` / `medium` / `low`） |
| `style` | `CSSProperties` | 自定义样式 |

已包裹 `React.memo`。颜色映射来自 `severityColorMap`。

---

### DueDateTag

交期状态标签，Tooltip 显示具体交期日期。

```tsx
import DueDateTag from '../components/DueDateTag';

<DueDateTag bucket="overdue" dueDate="2025-06-01" />
```

| Prop | 类型 | 说明 |
|------|------|------|
| `bucket` | `DueBucket` | 交期分桶（`overdue` / `in3` / `in7` / `later` / `none`） |
| `dueDate` | `string` | 可选，具体交期日期 |

已包裹 `React.memo`。

---

### ErrorBoundary

React Error Boundary，捕获子组件渲染错误并提供重试。

```tsx
import ErrorBoundary from '../components/ErrorBoundary';

<ErrorBoundary>
  <SomeComponent />
</ErrorBoundary>
```

Class 组件，不适用 `React.memo`。

---

## RiskOverview 子组件 (`src/pages/RiskOverview/`)

以下组件从 RiskOverview 页面拆分而来，均为展示型组件并包裹 `React.memo`。

### RiskScoreOverview

评分概览行：综合评分圆环 + 4 维子评分进度条 + 统计数据。

```tsx
<RiskScoreOverview analysis={analysis} />
```

| Prop | 类型 | 说明 |
|------|------|------|
| `analysis` | `RiskAnalysis` | 风险分析数据 |

显示: `score_overall`、`score_sequence`、`score_delivery`、`score_efficiency`、`total_count`、`total_weight`、`roll_change_count`、`steel_grade_switches`。

---

### RiskChartRow

风险统计卡片 + 3 个图表：风险分布饼图、适温分布饼图、班次产能柱状图。

```tsx
<RiskChartRow
  analysis={analysis}
  riskSeverityFilter={riskSeverityFilter}
  riskDueFilter={riskDueFilter}
  toggleSeverityFilter={toggleSeverityFilter}
  toggleDueFilter={toggleDueFilter}
  riskPieOption={riskPieOption}
  riskPieEvents={riskPieEvents}
  tempPieOption={tempPieOption}
  shiftBarOption={shiftBarOption}
/>
```

| Prop | 类型 | 说明 |
|------|------|------|
| `analysis` | `RiskAnalysis` | 风险分析数据 |
| `riskSeverityFilter` | `'all' \| 'high' \| 'medium' \| 'low'` | 当前严重度筛选 |
| `riskDueFilter` | `string` | 当前交期筛选 |
| `toggleSeverityFilter` | `(target) => void` | 切换严重度筛选 |
| `toggleDueFilter` | `(target) => void` | 切换交期筛选 |
| `riskPieOption` | `EChartsOption` | 风险分布饼图配置 |
| `riskPieEvents` | `Record<string, fn>` | 饼图点击事件 |
| `tempPieOption` | `EChartsOption` | 适温分布饼图配置 |
| `shiftBarOption` | `EChartsOption` | 班次柱状图配置 |

点击统计卡片可联动筛选风险清单。

---

### WidthJumpPanel

宽度跳跃分析面板：宽度差柱状图 + 明细表格。

```tsx
<WidthJumpPanel
  widthJumps={analysis.width_jumps}
  widthLineOption={widthLineOption}
  widthJumpEvents={widthJumpEvents}
  onLocate={handleLocateWidthJump}
/>
```

| Prop | 类型 | 说明 |
|------|------|------|
| `widthJumps` | `WidthJumpItem[]` | 宽度跳跃数据 |
| `widthLineOption` | `EChartsOption` | 柱状图配置 |
| `widthJumpEvents` | `Record<string, fn>` | 图表点击事件 |
| `onLocate` | `(row: WidthJumpItem) => void` | 定位到工作台回调 |

内置虚拟滚动（200+ 条自动启用）。双击行可触发定位。

---

### WaitingForecastRow

交期风险分布饼图 + 待温转适温趋势线 + 预测明细表。

```tsx
<WaitingForecastRow
  analysis={analysis}
  waitingForecast={waitingForecast}
  forecastDays={7}
  duePieOption={duePieOption}
  duePieEvents={duePieEvents}
  waitingForecastOption={waitingForecastOption}
  waitingForecastEvents={waitingForecastEvents}
  onViewDetail={handleViewDetail}
/>
```

| Prop | 类型 | 说明 |
|------|------|------|
| `analysis` | `RiskAnalysis` | 风险分析数据 |
| `waitingForecast` | `WaitingForecastItem[]` | 待温预测数据 |
| `forecastDays` | `number` | 预测天数 |
| `duePieOption` | `EChartsOption` | 交期饼图配置 |
| `duePieEvents` | `Record<string, fn>` | 饼图点击事件 |
| `waitingForecastOption` | `EChartsOption` | 趋势图配置 |
| `waitingForecastEvents` | `Record<string, fn>` | 趋势图点击事件 |
| `onViewDetail` | `(readyDate: string) => void` | 查看详情回调 |

内置虚拟滚动（200+ 条自动启用）。

---

## GanttView (`src/pages/Workbench/GanttView.tsx`)

排程甘特图视图，支持拖拽排序和多选。

```tsx
<GanttView
  scheduleItems={scheduleItems}
  selectedItemIds={selectedItemIds}
  ganttZoom={ganttZoom}
  setGanttZoom={setGanttZoom}
  dragOverScheduleItemId={dragOverId}
  dragOverSchedulePlacement={placement}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDragEnd={handleDragEnd}
  onDrop={handleDrop}
  onClick={handleClick}
/>
```

已包裹 `React.memo`。支持缩放（0.6x ~ 3x）。

---

## Workbench 页面级 Hooks (`src/pages/Workbench/`)

以下 Hooks 从 Workbench 主组件拆分而来，每个聚焦单一职责。

### useWorkbenchData

负责加载和管理工作台所需的全部数据（排程方案、物料列表、配置等）。

```typescript
const {
  plans, currentPlan, scheduleItems, materials,
  loading, fetchAll, fetchScheduleItems,
} = useWorkbenchData();
```

### useWorkbenchFilters

管理工作台的搜索和筛选状态，包括物料搜索、状态筛选、交期筛选等。

```typescript
const {
  searchText, setSearchText,
  statusFilter, setStatusFilter,
  filteredMaterials, filteredScheduleItems,
} = useWorkbenchFilters(materials, scheduleItems);
```

### useScheduleOperations

封装所有排程操作：添加/移除物料、锁定/解锁、移动位置、自动排程。

```typescript
const {
  handleAddToSchedule, handleRemoveFromSchedule,
  handleLockItems, handleMoveItem, handleAutoSchedule,
} = useScheduleOperations(currentPlan);
```

### usePriorityHit

通过 Web Worker 异步计算物料的优先级规则命中情况，用于列表高亮展示。

```typescript
const priorityHitMap = usePriorityHit(scheduleItems, priorityConfigs);
// priorityHitMap: Map<itemId, PriorityHitResult>
```

### useKeyboardShortcuts

注册工作台键盘快捷键（`Ctrl+S` 保存、`Ctrl+Z` 撤销、`Ctrl+Y` 重做、`Ctrl+A` 全选）。

```typescript
useKeyboardShortcuts({ onSave, onUndo, onRedo, onSelectAll });
```

### useDragDrop

管理甘特图/列表的拖拽排序状态，处理 `dragStart`/`dragOver`/`drop` 事件并触发移动操作。

```typescript
const {
  dragOverScheduleItemId, dragOverSchedulePlacement,
  handleDragStart, handleDragOver, handleDragLeave,
  handleDragEnd, handleDrop,
} = useDragDrop({ scheduleItems, onMove });
```

### useWorkbenchModals

管理工作台各弹窗（导入物料、创建方案、策略选择等）的显示状态。

```typescript
const {
  importVisible, setImportVisible,
  createPlanVisible, setCreatePlanVisible,
} = useWorkbenchModals();
```

---

## Strategy 页面组件 (`src/pages/Strategy/`)

策略配置页面拆分出的展示/编辑组件，均为独立文件。

| 组件 | 文件 | 功能 |
|------|------|------|
| `TemplateListPanel` | `TemplateListPanel.tsx` | 策略模板列表（增/删/导入/导出/设为默认） |
| `StrategyDetailView` | `StrategyDetailView.tsx` | 模板详情只读视图，展示所有配置项 |
| `StrategyEditModal` | `StrategyEditModal.tsx` | 模板编辑弹窗，含 4 个配置 Tab |
| `SortWeightsEditor` | `SortWeightsEditor.tsx` | 排序权重编辑器（6 维优先级权重滑块） |
| `HardConstraintsEditor` | `HardConstraintsEditor.tsx` | 硬约束配置编辑器 |
| `SoftConstraintsEditor` | `SoftConstraintsEditor.tsx` | 软约束配置编辑器 |
| `TemperRulesEditor` | `TemperRulesEditor.tsx` | 适温规则编辑器 |
| `TemperRulesViewer` | `TemperRulesViewer.tsx` | 适温规则只读视图 |
| `EvalWeightsViewer` | `EvalWeightsViewer.tsx` | 方案评估权重只读视图 |
| `useStrategyData` | `useStrategyData.ts` | Strategy 页面数据加载和 CRUD Hook |
| `validateStrategy` | `validateStrategy.ts` | 策略配置的前端校验函数 |

---

## Settings 页面组件 (`src/pages/Settings/`)

设置中心页面包含 4 个 Tab 和 1 个独立面板。

| 组件/Tab | 文件 | 功能 |
|----------|------|------|
| **系统配置 Tab** | `ConfigPanel.tsx` | 系统参数配置（产能上限、换辊阈值等） |
| **检修计划 Tab** | `MaintenanceTab.tsx` | 检修计划的增删改查 |
| **性能监控 Tab** | `PerformanceTab.tsx` | 显示性能统计图表和告警列表 |
| **错误日志 Tab** | `ErrorLogsTab.tsx` | 前后端错误日志查看和管理 |
| **优先级配置面板** | `PriorityConfigPanel/` | 6 维优先级配置（权重/维度/客户/批次/品种） |

---

## Web Workers (`src/workers/`)

| Worker 文件 | 触发方 | 处理内容 | 返回 |
|------------|--------|----------|------|
| `priorityHit.worker.ts` | `usePriorityHit` Hook | 计算每行排程项命中哪些优先级规则 | `Map<id, PriorityHitResult>` |
| `riskConfigHit.worker.ts` | 风险分析相关 Hook | 计算每行排程项命中哪些风险配置规则 | `Map<id, RiskHitResult>` |
| `logFilter.worker.ts` | Logs 页面 | 对大量操作日志进行多条件过滤 | `OperationLogEntry[]` |

**注意**: Worker 在初始化时接收配置数据（规则/权重），后续每次数据变化只传递需要计算的数据，避免重复传输配置。
