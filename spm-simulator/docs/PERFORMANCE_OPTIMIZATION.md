# 大数据量场景性能优化指南

## 概述

本文档提供 SPM Simulator 在大数据量场景下的性能优化指南，包括性能测试方法、优化策略和最佳实践。

## 当前性能状态

### 已实现的优化

1. **数据库索引优化**
   - 材料表：status, temp_status, is_tempered, width, coiling_time, due_date 等字段已添加索引
   - 复合索引：(status, is_tempered, width) 用于常见查询组合
   - 性能监控表和错误日志表也已添加相应索引

2. **分页查询**
   - 材料列表支持分页（默认 50 条/页）
   - 排程项支持分页加载
   - 操作日志支持分页查询

3. **性能监控系统**
   - 已集成运行时性能监控
   - 可追踪页面渲染、API 调用、算法执行时间
   - 支持性能基线和告警

## 性能测试方法

### 1. 创建测试数据

使用材料导入功能创建大量测试数据：

```typescript
// 生成测试数据脚本
async function generateTestData(count: number) {
  const materials = [];
  const baseDate = new Date('2024-01-01');

  for (let i = 0; i < count; i++) {
    materials.push({
      coil_id: `TEST-${String(i).padStart(6, '0')}`,
      steel_grade: ['Q235', 'Q345', 'SPCC', 'SPHC'][i % 4],
      thickness: 2.0 + (i % 10) * 0.5,
      width: 1000 + (i % 20) * 50,
      weight: 10 + (i % 50),
      coiling_time: new Date(baseDate.getTime() + i * 3600000).toISOString(),
      // ... 其他字段
    });
  }

  // 批量导入
  await materialApi.importMaterials(materials);
}
```

### 2. 性能测试场景

#### 场景 1: 材料列表加载
- 数据量：1000 条材料
- 测试指标：首次加载时间、滚动流畅度、内存使用
- 目标：< 1s 加载时间

#### 场景 2: 排程页面渲染
- 数据量：500 条排程项
- 测试指标：页面渲染时间、拖拽响应、内存使用
- 目标：< 2s 渲染时间

#### 场景 3: 自动排程算法
- 数据量：500 条待排程材料
- 测试指标：算法执行时间、CPU 使用率
- 目标：< 10s 执行时间

#### 场景 4: 数据过滤和搜索
- 数据量：1000 条材料
- 测试指标：过滤响应时间、搜索响应时间
- 目标：< 500ms 响应时间

### 3. 性能测试工具

使用已集成的性能监控系统：

```typescript
import { createTimer } from '../services/performanceApi';

// 测试材料列表加载
const timer = createTimer('page_render', 'materials_large_dataset');
// ... 加载材料列表
const elapsed = await timer.finish();
console.log(`材料列表加载耗时: ${elapsed}ms`);
```

## 优化策略

### 1. 数据库查询优化

#### 当前状态
- ✅ 已添加常用字段索引
- ✅ 使用分页查询
- ⚠️ 部分复杂查询可能需要优化

#### 优化建议

**添加更多复合索引**:
```sql
-- 材料列表常用查询
CREATE INDEX idx_material_list_query
ON material(status, temp_status, is_tempered, coiling_time DESC);

-- 排程查询
CREATE INDEX idx_schedule_plan_query
ON schedule_item(plan_id, sequence, locked);
```

**优化查询语句**:
```rust
// 避免 SELECT *，只查询需要的字段
let materials = material::Entity::find()
    .select_only()
    .column(material::Column::Id)
    .column(material::Column::CoilId)
    .column(material::Column::Status)
    // ... 只选择需要的列
    .all(db)
    .await?;
```

**使用查询缓存**:
```rust
// 缓存不常变化的配置数据
static CONFIG_CACHE: OnceLock<SystemConfig> = OnceLock::new();
```

### 2. 前端渲染优化

#### 虚拟滚动

对于大列表，使用虚拟滚动只渲染可见区域：

```typescript
import { FixedSizeList } from 'react-window';

function MaterialList({ materials }: { materials: Material[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <MaterialRow material={materials[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={materials.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

#### React 性能优化

**使用 React.memo**:
```typescript
const MaterialRow = React.memo(({ material }: { material: Material }) => {
  return <div>{material.coil_id}</div>;
}, (prevProps, nextProps) => {
  // 自定义比较逻辑
  return prevProps.material.id === nextProps.material.id;
});
```

**使用 useMemo 和 useCallback**:
```typescript
function MaterialList({ materials }: { materials: Material[] }) {
  // 缓存过滤结果
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => m.status === 'pending');
  }, [materials]);

  // 缓存回调函数
  const handleSelect = useCallback((id: number) => {
    // ...
  }, []);

  return <div>{/* ... */}</div>;
}
```

**避免不必要的重渲染**:
```typescript
// 使用 key 优化列表渲染
{materials.map(material => (
  <MaterialRow key={material.id} material={material} />
))}

// 避免在 render 中创建新对象
// ❌ 不好
<Component style={{ width: 100 }} />

// ✅ 好
const style = { width: 100 };
<Component style={style} />
```

### 3. 数据加载优化

#### 分页加载

```typescript
function usePaginatedMaterials() {
  const [page, setPage] = useState(1);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    const result = await materialApi.getMaterials({}, { page, page_size: 50 });
    setMaterials(prev => [...prev, ...result.items]);
    setHasMore(result.items.length === 50);
    setPage(prev => prev + 1);
  };

  return { materials, loadMore, hasMore };
}
```

#### 懒加载

```typescript
// 使用 React.lazy 懒加载组件
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Spin />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

#### 数据预加载

```typescript
// 在用户可能访问前预加载数据
function MaterialList() {
  const prefetchDetail = (materialId: number) => {
    // 预加载材料详情
    queryClient.prefetchQuery(['material', materialId], () =>
      materialApi.getMaterial(materialId)
    );
  };

  return (
    <div>
      {materials.map(material => (
        <div
          key={material.id}
          onMouseEnter={() => prefetchDetail(material.id)}
        >
          {material.coil_id}
        </div>
      ))}
    </div>
  );
}
```

### 4. 内存优化

#### 及时清理

```typescript
useEffect(() => {
  const subscription = someObservable.subscribe();

  return () => {
    // 清理订阅
    subscription.unsubscribe();
  };
}, []);
```

#### 避免内存泄漏

```typescript
function Component() {
  const [data, setData] = useState([]);

  useEffect(() => {
    let isMounted = true;

    fetchData().then(result => {
      if (isMounted) {
        setData(result);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);
}
```

#### 使用 WeakMap 缓存

```typescript
const cache = new WeakMap();

function getCachedValue(obj: object) {
  if (cache.has(obj)) {
    return cache.get(obj);
  }

  const value = expensiveComputation(obj);
  cache.set(obj, value);
  return value;
}
```

### 5. 算法优化

#### 排程算法优化

```rust
// 使用并行处理
use rayon::prelude::*;

let results: Vec<_> = materials
    .par_iter()
    .map(|material| calculate_priority(material))
    .collect();

// 使用更高效的数据结构
use std::collections::HashMap;
let mut material_map: HashMap<i32, Material> = HashMap::new();

// 避免重复计算
let mut cache: HashMap<String, f64> = HashMap::new();
```

## 性能监控和分析

### 1. 使用性能监控系统

```typescript
import { createTimer, recordMemoryUsage } from '../services/performanceApi';

// 监控页面加载
const timer = createTimer('page_render', 'materials');
// ... 页面渲染
await timer.finish();

// 监控内存使用
await recordMemoryUsage();
```

### 2. 使用浏览器开发工具

- **Performance 面板**: 记录和分析页面性能
- **Memory 面板**: 检查内存使用和泄漏
- **Network 面板**: 分析网络请求

### 3. React DevTools Profiler

```typescript
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
) {
  console.log(`${id} ${phase} took ${actualDuration}ms`);
}

<Profiler id="MaterialList" onRender={onRenderCallback}>
  <MaterialList />
</Profiler>
```

## 性能优化检查清单

### 数据库层面
- [ ] 为常用查询字段添加索引
- [ ] 使用复合索引优化复杂查询
- [ ] 避免 N+1 查询问题
- [ ] 使用分页查询大数据集
- [ ] 定期清理历史数据

### 后端层面
- [ ] 优化算法复杂度
- [ ] 使用缓存减少重复计算
- [ ] 使用并行处理提升性能
- [ ] 避免不必要的数据序列化
- [ ] 优化错误处理逻辑

### 前端层面
- [ ] 使用虚拟滚动渲染大列表
- [ ] 使用 React.memo 避免不必要的重渲染
- [ ] 使用 useMemo 和 useCallback 优化性能
- [ ] 实现懒加载和代码分割
- [ ] 优化图片和资源加载
- [ ] 使用 Web Workers 处理耗时任务

### 网络层面
- [ ] 减少 API 请求次数
- [ ] 使用请求合并和批处理
- [ ] 实现数据预加载
- [ ] 使用适当的缓存策略
- [ ] 压缩传输数据

## 性能基准

### 目标性能指标

| 场景 | 数据量 | 目标时间 | 当前状态 |
|------|--------|----------|----------|
| 材料列表加载 | 1000条 | < 1s | 待测试 |
| 排程页面渲染 | 500条 | < 2s | 待测试 |
| 自动排程算法 | 500条 | < 10s | 待测试 |
| 数据过滤 | 1000条 | < 500ms | 待测试 |
| 数据搜索 | 1000条 | < 500ms | 待测试 |

### 性能测试步骤

1. **准备测试环境**
   - 清空数据库
   - 导入测试数据
   - 清除浏览器缓存

2. **执行性能测试**
   - 使用性能监控系统记录指标
   - 使用浏览器开发工具分析
   - 记录测试结果

3. **分析和优化**
   - 识别性能瓶颈
   - 实施优化措施
   - 重新测试验证

4. **文档记录**
   - 记录优化前后对比
   - 更新性能基准
   - 总结优化经验

## 常见性能问题和解决方案

### 问题 1: 材料列表加载慢

**症状**: 打开材料页面需要 3-5 秒

**原因**:
- 一次性加载所有数据
- 没有使用虚拟滚动
- 渲染大量 DOM 节点

**解决方案**:
1. 实现分页加载
2. 使用虚拟滚动
3. 优化表格渲染

### 问题 2: 排程页面卡顿

**症状**: 拖拽排程项时页面卡顿

**原因**:
- 频繁的状态更新
- 不必要的组件重渲染
- 复杂的计算逻辑

**解决方案**:
1. 使用 React.memo 优化组件
2. 使用 useMemo 缓存计算结果
3. 优化拖拽事件处理

### 问题 3: 内存使用过高

**症状**: 长时间使用后内存占用持续增长

**原因**:
- 内存泄漏
- 缓存数据未清理
- 事件监听器未移除

**解决方案**:
1. 及时清理不用的数据
2. 正确清理事件监听器
3. 使用 WeakMap 存储临时数据

### 问题 4: 自动排程算法慢

**症状**: 自动排程需要 30+ 秒

**原因**:
- 算法复杂度高
- 没有使用并行处理
- 重复计算

**解决方案**:
1. 优化算法逻辑
2. 使用 Rust 的并行处理
3. 添加计算缓存

## 未来优化方向

- [ ] 实现数据虚拟化（react-window）
- [ ] 添加 Service Worker 缓存
- [ ] 使用 IndexedDB 本地缓存
- [ ] 实现增量更新
- [ ] 优化排程算法（使用更高效的算法）
- [ ] 添加性能预算和监控告警
- [ ] 实现自动性能测试

## 参考资料

- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Web Performance](https://web.dev/performance/)
- [Rust Performance Book](https://nnethercote.github.io/perf-book/)
- [Database Indexing Best Practices](https://use-the-index-luke.com/)
