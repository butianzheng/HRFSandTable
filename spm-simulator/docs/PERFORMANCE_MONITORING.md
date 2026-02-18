# 性能监控系统文档

## 概述

SPM Simulator 集成了轻量级的运行时性能监控系统，用于收集、分析和展示应用的性能指标。该系统可以帮助开发团队识别性能瓶颈，优化用户体验。

## 功能特性

### 1. 性能指标收集

系统自动收集以下类型的性能指标：

- **应用启动时间** (`app_startup`): 应用初始化和启动耗时
- **页面渲染时间** (`page_render`): 各页面的渲染性能
- **API 调用时间** (`api_call`): 后端 API 响应时间
- **算法执行时间** (`algorithm_execution`): 排程算法等核心算法的执行时间
- **内存使用情况** (`memory_usage`): JavaScript 堆内存使用
- **数据库查询时间** (`database_query`): 数据库操作耗时

### 2. 性能统计分析

对收集的性能数据进行统计分析，提供以下指标：

- **样本数**: 指标采集次数
- **平均值**: 所有样本的平均值
- **P50/P95/P99**: 百分位数，反映性能分布
- **最小值/最大值**: 性能范围

### 3. 性能基线和告警

系统预设了性能基线，当实际性能超过基线阈值时会触发告警：

- **警告阈值**: 性能超过基线 1.5-2 倍
- **严重阈值**: 性能超过基线 2-3 倍

### 4. 数据管理

- **时间范围过滤**: 支持查看最近 1 小时、6 小时、24 小时、7 天的数据
- **自动清理**: 可手动清理 30 天前的历史数据
- **数据持久化**: 性能数据存储在 SQLite 数据库中

## 使用指南

### 前端使用

#### 1. 记录性能指标

```typescript
import { performanceApi, createTimer } from '../services/performanceApi';

// 方式 1: 使用计时器
const timer = createTimer('api_call', 'get_materials');
// ... 执行操作
await timer.finish(); // 自动记录耗时

// 方式 2: 直接记录
await performanceApi.recordMetric({
  metric_type: 'page_render',
  metric_name: 'materials',
  value: 523.5,
  unit: 'ms',
});
```

#### 2. 查看性能数据

在设置页面的"性能监控"标签中可以查看：

- 性能统计概览（总样本数、监控指标数、平均响应时间等）
- 性能告警列表
- 详细的性能统计表格

#### 3. 使用 Performance Store

```typescript
import { usePerformanceStore } from '../stores/performanceStore';

function MyComponent() {
  const { stats, alerts, fetchStats, setHours } = usePerformanceStore();

  useEffect(() => {
    fetchStats(); // 获取性能统计
  }, []);

  return (
    <div>
      {alerts.length > 0 && <Alert>发现 {alerts.length} 个性能告警</Alert>}
    </div>
  );
}
```

### 后端使用

#### 1. 记录性能指标

```rust
use crate::services::performance_service::{PerformanceService, PerformanceTimer};
use crate::models::performance_metric::MetricType;

// 方式 1: 使用计时器
let timer = PerformanceTimer::new(MetricType::AlgorithmExecution, "auto_schedule");
// ... 执行算法
timer.finish(&app).await?;

// 方式 2: 直接记录
PerformanceService::record_metric(
    &app,
    MetricType::ApiCall,
    "get_materials",
    125.5,
    "ms",
    None,
).await?;
```

#### 2. 查询性能统计

```rust
// 获取最近 24 小时的统计数据
let stats = PerformanceService::get_stats(&app, None, None, Some(24)).await?;

// 检查性能告警
let alerts = PerformanceService::check_alerts(&app, Some(24)).await?;

// 清理 30 天前的数据
let deleted = PerformanceService::cleanup_old_metrics(&app, 30).await?;
```

## 性能基线配置

当前系统预设的性能基线如下：

| 指标类型 | 指标名称 | 平均值基线 | P95 基线 | 警告阈值 | 严重阈值 |
|---------|---------|-----------|---------|---------|---------|
| 应用启动 | total | 2000ms | 3000ms | 1.5x | 2.0x |
| 页面渲染 | materials | 500ms | 1000ms | 2.0x | 3.0x |
| 页面渲染 | schedule | 800ms | 1500ms | 2.0x | 3.0x |
| 算法执行 | auto_schedule | 5000ms | 10000ms | 1.5x | 2.0x |
| API 调用 | get_materials | 200ms | 500ms | 2.0x | 3.0x |

## 数据库结构

性能指标存储在 `performance_metrics` 表中：

```sql
CREATE TABLE performance_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type     TEXT NOT NULL,      -- 指标类型
    metric_name     TEXT NOT NULL,      -- 指标名称
    value           REAL NOT NULL,      -- 指标值
    unit            TEXT NOT NULL,      -- 单位
    metadata        TEXT,               -- 元数据 (JSON)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_perf_type ON performance_metrics(metric_type);
CREATE INDEX idx_perf_name ON performance_metrics(metric_name);
CREATE INDEX idx_perf_created ON performance_metrics(created_at);
CREATE INDEX idx_perf_composite ON performance_metrics(metric_type, metric_name, created_at);
```

## API 接口

### Tauri 命令

- `record_performance_metric`: 记录性能指标
- `get_performance_stats`: 获取性能统计数据
- `get_performance_baselines`: 获取性能基线配置
- `check_performance_alerts`: 检查性能告警
- `cleanup_performance_metrics`: 清理旧的性能数据

## 最佳实践

### 1. 合理使用性能监控

- 在关键路径上添加性能监控（如页面加载、API 调用、算法执行）
- 避免在高频操作中记录性能（如鼠标移动、滚动事件）
- 使用有意义的指标名称，便于后续分析

### 2. 性能优化建议

当发现性能告警时，可以采取以下措施：

- **页面渲染慢**: 检查组件渲染次数，使用 React.memo 优化
- **API 调用慢**: 检查数据库查询，添加索引或优化查询
- **算法执行慢**: 优化算法逻辑，考虑并行处理
- **内存使用高**: 检查内存泄漏，及时清理不用的对象

### 3. 数据管理

- 定期清理旧的性能数据（建议保留 30 天）
- 根据实际情况调整性能基线
- 关注 P95 和 P99 指标，它们更能反映用户体验

## 故障排查

### 问题：性能数据未显示

**可能原因**:
1. 数据库未初始化
2. 性能指标未记录
3. 时间范围过滤不当

**解决方案**:
1. 检查数据库是否正常初始化
2. 确���代码中已添加性能监控
3. 调整时间范围过滤器

### 问题：性能告警过多

**可能原因**:
1. 性能基线设置过低
2. 系统负载过高
3. 存在性能瓶颈

**解决方案**:
1. 根据实际情况调整基线
2. 检查系统资源使用情况
3. 分析性能瓶颈并优化

## 未来改进

- [ ] 支持自定义性能基线
- [ ] 添加性能趋势图表
- [ ] 支持性能数据导出
- [ ] 集成第三方监控服务（如 Sentry）
- [ ] 添加性能对比功能
- [ ] 支持实时性能监控

## 参考资料

- [Performance API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Web Performance Metrics](https://web.dev/metrics/)
- [Rust Performance Book](https://nnethercote.github.io/perf-book/)
