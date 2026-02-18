# 错误追踪系统文档

## 概述

SPM Simulator 集成了轻量级的错误追踪系统，用于自动捕获、记录和管理应用运行时的错误。该系统可以帮助开发团队快速发现和修复问题，提升应用稳定性。

## 功能特性

### 1. 自动错误捕获

系统自动捕获以下类型的错误：

- **前端错误** (`frontend`):
  - 全局 JavaScript 错误（window.onerror）
  - 未处理的 Promise 拒绝（unhandledrejection）
  - React 错误边界捕获的组件错误

- **后端错误** (`backend`):
  - Rust 应用错误
  - 数据库操作错误
  - API 调用错误

- **Panic 错误** (`panic`):
  - Rust panic 错误

### 2. 错误去重

系统使用错误指纹（fingerprint）机制自动去重：

- 基于错误类型、消息和堆栈跟踪生成唯一指纹
- 相同错误只记录一次，累计出现次数
- 记录首次和最后出现时间

### 3. 错误分类

错误按严重程度分类：

- **错误** (`error`): 严重错误，需要立即处理
- **警告** (`warning`): 潜在问题，需要关注
- **信息** (`info`): 一般信息，供参考

### 4. 错误管理

- **查看错误列表**: 支持分页、过滤、搜索
- **查看错误详情**: 包括堆栈跟踪、上下文信息、用户环境
- **标记已解决**: 将错误标记为已解决
- **删除错误**: 删除不需要的错误记录
- **清理旧错误**: 批量清理已解决的旧错误

### 5. 错误统计

- 总错误数
- 未解决错误数
- 按类型统计（前端/后端/panic）
- 按严重程度统计（错误/警告/信息）
- 最近错误列表

## 使用指南

### 前端使用

#### 1. 自动错误捕获

系统已在 `main.tsx` 中自动设置全局错误处理器，无需额外配置：

```typescript
import { setupGlobalErrorHandler } from './services/errorTrackingApi';

// 设置全局错误处理器
setupGlobalErrorHandler();
```

#### 2. 手动记录错误

在需要的地方手动记录错误：

```typescript
import { logError, logWarning } from '../services/errorTrackingApi';

try {
  // 可能出错的代码
  await someOperation();
} catch (error) {
  // 记录错误
  await logError('操作失败', error as Error, {
    operation: 'someOperation',
    userId: currentUser.id,
  });
}

// 记录警告
await logWarning('数据可能不完整', {
  dataSource: 'api',
  recordCount: 0,
});
```

#### 3. React 错误边界

项目已有 `ErrorBoundary` 组件，它会自动捕获组件树中的错误。可以在需要的地方使用：

```typescript
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

#### 4. 查看错误日志

在设置页面的"错误日志"标签中可以：

- 查看所有错误列表
- 按类型、严重程度、状态过滤
- 搜索错误消息
- 查看错误详情（堆栈跟踪、上下文等）
- 标记错误为已解决
- 删除错误记录
- 清理旧错误

#### 5. 使用 Error Tracking Store

```typescript
import { useErrorTrackingStore } from '../stores/errorTrackingStore';

function MyComponent() {
  const { errors, stats, fetchErrors, resolveError } = useErrorTrackingStore();

  useEffect(() => {
    fetchErrors(); // 获取错误列表
  }, []);

  const handleResolve = async (errorId: number) => {
    await resolveError(errorId);
  };

  return (
    <div>
      {stats && <div>未解决错误: {stats.unresolved_errors}</div>}
      {errors.map((error) => (
        <div key={error.id}>
          {error.message}
          <button onClick={() => handleResolve(error.id)}>解决</button>
        </div>
      ))}
    </div>
  );
}
```

### 后端使用

#### 1. 记录错误

```rust
use crate::services::error_tracking_service::ErrorTrackingService;
use crate::models::error_log::{ErrorType, ErrorSeverity};

// 记录错误
ErrorTrackingService::log_error(
    &app,
    ErrorType::Backend,
    ErrorSeverity::Error,
    "数据库操作失败",
    Some(format!("{:?}", error)),
    Some(serde_json::json!({
        "operation": "insert",
        "table": "materials",
    })),
    None,
    None,
).await?;
```

#### 2. 查询错误

```rust
use crate::models::error_log::ErrorFilter;

// 获取错误列表
let filter = ErrorFilter {
    error_type: Some("backend".to_string()),
    severity: Some("error".to_string()),
    resolved: Some(false),
    ..Default::default()
};

let (errors, total) = ErrorTrackingService::get_errors(&app, filter, 1, 20).await?;

// 获取错误统计
let stats = ErrorTrackingService::get_stats(&app).await?;
```

#### 3. 管理错误

```rust
// 标记错误为已解决
ErrorTrackingService::resolve_error(&app, error_id).await?;

// 删除错误
ErrorTrackingService::delete_error(&app, error_id).await?;

// 清理30天前已解决的错误
let deleted = ErrorTrackingService::cleanup_old_errors(&app, 30).await?;
```

## 数据库结构

错误日志存储在 `error_logs` 表中：

```sql
CREATE TABLE error_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    error_type      TEXT NOT NULL,      -- 错误类型
    severity        TEXT NOT NULL,      -- 严重程度
    message         TEXT NOT NULL,      -- 错误消息
    stack_trace     TEXT,               -- 堆栈跟踪
    context         TEXT,               -- 上下文 (JSON)
    user_agent      TEXT,               -- 用户代理
    url             TEXT,               -- 发生错误的 URL
    fingerprint     TEXT NOT NULL,      -- 错误指纹
    count           INTEGER DEFAULT 1,  -- 出现次数
    first_seen      DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen       DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved        BOOLEAN DEFAULT 0,  -- 是否已解决
    resolved_at     DATETIME            -- 解决时间
);

-- 索引
CREATE INDEX idx_error_type ON error_logs(error_type);
CREATE INDEX idx_error_severity ON error_logs(severity);
CREATE INDEX idx_error_fingerprint ON error_logs(fingerprint);
CREATE INDEX idx_error_resolved ON error_logs(resolved);
CREATE INDEX idx_error_last_seen ON error_logs(last_seen);
CREATE INDEX idx_error_composite ON error_logs(error_type, severity, resolved, last_seen);
```

## API 接口

### Tauri 命令

- `log_error`: 记录错误
- `get_errors`: 获取错误列表
- `get_error_stats`: 获取错误统计
- `resolve_error`: 标记错误为已解决
- `delete_error`: 删除错误
- `cleanup_old_errors`: 清理旧错误

## 错误指纹算法

错误指纹用于识别相同的错误，算法如下：

```rust
fn generate_fingerprint(
    error_type: &str,
    message: &str,
    stack_trace: &Option<String>,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(error_type.as_bytes());
    hasher.update(message.as_bytes());

    if let Some(stack) = stack_trace {
        // 只使用堆栈的前3行，避免行号变化导致指纹不同
        let lines: Vec<&str> = stack.lines().take(3).collect();
        hasher.update(lines.join("\n").as_bytes());
    }

    format!("{:x}", hasher.finalize())
}
```

## 最佳实践

### 1. 合理使用错误追踪

- 在关键操作中添加错误捕获（如数据保存、API 调用）
- 避免记录预期的错误（如用户取消操作）
- 使用有意义的错误消息和上下文信息

### 2. 错误处理建议

当发现错误时，可以采取以下措施：

- **前端错误**: 检查组件逻辑、状态管理、API 调用
- **后端错误**: 检查数据库操作、业务逻辑、错误处理
- **Panic 错误**: 检查 Rust 代码的 unwrap、expect 调用

### 3. 错误管理

- 定期查看未解决的错误
- 及时标记已修复的错误为已解决
- 定期清理已解决的旧错误（建议保留 30 天）
- 关注错误出现次数，高频错误需要优先处理

### 4. 上下文信息

记录错误时，提供有用的上下文信息：

```typescript
await logError('保存失败', error, {
  operation: 'saveMaterial',
  materialId: material.id,
  userId: currentUser.id,
  timestamp: Date.now(),
});
```

## 隐私和安全

- 错误数据存储在本地 SQLite 数据库中
- 不会上传到外部服务器
- 注意不要在错误上下文中包含敏感信息（如密码、令牌）

## 故障排查

### 问题：错误未被捕获

**可能原因**:
1. 全局错误处理器未设置
2. 错误在 try-catch 中被吞掉
3. 异步错误未正确处理

**解决方案**:
1. 确认 `setupGlobalErrorHandler()` 已调用
2. 在 catch 块中手动记录错误
3. 使用 async/await 正确处理异步错误

### 问题：错误重复记录

**可能原因**:
1. 错误指纹生成不一致
2. 堆栈跟踪包含动态内容

**解决方案**:
1. 检查错误消息是否一致
2. 错误指纹只使用堆栈的前3行

### 问题：错误列表加载慢

**可能原因**:
1. 错误记录过多
2. 数据库查询未优化

**解决方案**:
1. 定期清理旧错误
2. 使用过滤器减少查询范围
3. 检查数据库索引是否正常

## 未来改进

- [ ] 支持错误分组和聚合
- [ ] 添加错误趋势图表
- [ ] 支持错误通知（邮件、钉钉等）
- [ ] 集成 Source Map 支持
- [ ] 添加错误重现步骤记录
- [ ] 支持错误导出和分析

## 参考资料

- [Error Handling in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Rust Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
