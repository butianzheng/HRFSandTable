# API Reference

SPM Simulator 前端 Service 层 API 接口文档。所有方法通过 Tauri `invoke` 调用 Rust 后端 Command。

> 缓存策略说明：标记 `cached` 的方法使用 `invokeDeduped` 去重+缓存（TTL 见表）；标记 `mutation` 的方法调用后自动清除全部缓存。

---

## scheduleApi (排程核心)

来源: `src/services/scheduleApi.ts`

### 方案管理

| 方法 | Tauri Command | 参数 | 返回类型 | 缓存 |
|------|---------------|------|----------|------|
| `createPlan(input)` | `create_plan` | `input: CreatePlanInput` | `SchedulePlan` | mutation |
| `getPlan(id)` | `get_plan` | `id: number` | `SchedulePlan` | 5s |
| `getPlans(filter?)` | `get_plans` | `filter?: PlanFilter` | `SchedulePlan[]` | 10s |
| `savePlan(id)` | `save_plan` | `id: number` | `SchedulePlan` | mutation |
| `deletePlan(id)` | `delete_plan` | `id: number` | `void` | mutation |
| `updatePlanStatus(id, status)` | `update_plan_status` | `id: number, status: string` | `SchedulePlan` | mutation |

### 排程操作

| 方法 | Tauri Command | 参数 | 返回类型 | 缓存 |
|------|---------------|------|----------|------|
| `autoSchedule(planId, strategyId)` | `auto_schedule` | `planId: number, strategyId: number` | `ScheduleResult` | mutation |
| `addToSchedule(planId, materialIds, position?)` | `add_to_schedule` | `planId: number, materialIds: number[], position?: number` | `ScheduleItem[]` | mutation |
| `removeFromSchedule(planId, itemIds)` | `remove_from_schedule` | `planId: number, itemIds: number[]` | `number` | mutation |
| `moveScheduleItem(planId, itemId, newPosition)` | `move_schedule_item` | `planId: number, itemId: number, newPosition: number` | `void` | mutation |
| `lockScheduleItems(planId, itemIds, locked)` | `lock_schedule_items` | `planId: number, itemIds: number[], locked: boolean` | `number` | mutation |
| `getScheduleItems(planId)` | `get_schedule_items` | `planId: number` | `ScheduleItem[]` | 3s |

### 撤销/重做

| 方法 | Tauri Command | 参数 | 返回类型 | 缓存 |
|------|---------------|------|----------|------|
| `pushUndo(planId, actionType, beforeState, afterState)` | `push_undo` | 4 个 string 参数 | `void` | mutation |
| `undoAction(planId)` | `undo_action` | `planId: number` | `UndoRedoResult` | mutation |
| `redoAction(planId)` | `redo_action` | `planId: number` | `UndoRedoResult` | mutation |
| `getUndoRedoCount(planId)` | `get_undo_redo_count` | `planId: number` | `[number, number]` | 3s |
| `clearUndoStack(planId?)` | `clear_undo_stack` | `planId?: number` | `number` | mutation |

### 风险分析

| 方法 | Tauri Command | 参数 | 返回类型 | 缓存 |
|------|---------------|------|----------|------|
| `getRiskAnalysis(planId)` | `get_risk_analysis` | `planId: number` | `RiskAnalysis` | 5s |
| `evaluateRisks(planId)` | `evaluate_risks` | `planId: number` | `RiskAnalysis` | mutation |
| `applyRiskSuggestion(planId, riskId)` | `apply_risk_suggestion` | `planId: number, riskId: string` | `ApplyRiskSuggestionResult` | mutation |
| `getWaitingForecast(forecastDays?)` | `get_waiting_forecast` | `forecastDays?: number` | `WaitingForecastItem[]` | 5s |
| `getWaitingForecastDetails(readyDate)` | `get_waiting_forecast_details` | `readyDate: string` | `WaitingForecastDetailItem[]` | 3s |

### 方案对比

| 方法 | Tauri Command | 参数 | 返回类型 | 缓存 |
|------|---------------|------|----------|------|
| `comparePlans(planAId, planBId)` | `compare_plans` | `planAId: number, planBId: number` | `PlanComparisonResult` | 10s |
| `comparePlansMulti(planIds)` | `compare_plans_multi` | `planIds: number[]` | `MultiPlanComparisonResult` | 10s |
| `exportCompareSequenceCsv(planAId, planBId, filePath)` | `export_compare_sequence_csv` | 3 参数 | `number` | - |
| `exportCompareSequenceExcel(planAId, planBId, filePath)` | `export_compare_sequence_excel` | 3 参数 | `number` | - |

### 历史与日志

| 方法 | Tauri Command | 参数 | 返回类型 | 缓存 |
|------|---------------|------|----------|------|
| `getPlanVersions(planId)` | `get_plan_versions` | `planId: number` | `PlanVersionItem[]` | 5s |
| `rollbackPlanVersion(planId, targetPlanId)` | `rollback_plan_version` | 2 个 number | `SchedulePlan` | mutation |
| `getOperationLogs(filter?)` | `get_operation_logs` | `filter?: OperationLogFilter` | `OperationLogEntry[]` | 3s |
| `getOperationLogEstimate(filter?, cap?)` | `get_operation_log_estimate` | `filter?: OperationLogFilter, cap?: number` | `OperationLogEstimate` | 3s |
| `exportLogs(filePath, filter?)` | `export_logs` | `filePath: string, filter?: OperationLogFilter` | `number` | - |
| `exportLogsExcel(filePath, filter?)` | `export_logs_excel` | 同上 | `number` | - |
| `exportPlanHistoryReport(planId, filePath)` | `export_plan_history_report` | 2 参数 | `number` | - |

### 导出模板

| 方法 | Tauri Command | 参数 | 返回类型 | 缓存 |
|------|---------------|------|----------|------|
| `getExportTemplates()` | `get_export_templates` | - | `ExportTemplate[]` | 10s |
| `createExportTemplate(input)` | `create_export_template` | `input: CreateExportTemplateInput` | `ExportTemplate` | mutation |
| `updateExportTemplate(id, input)` | `update_export_template` | `id: number, input: UpdateExportTemplateInput` | `ExportTemplate` | mutation |
| `deleteExportTemplate(id)` | `delete_export_template` | `id: number` | `void` | mutation |
| `exportPlanExcel(planId, filePath, templateId?)` | `export_plan_excel` | 3 参数 | `ExportResult` | - |
| `exportPlanCsv(planId, filePath, templateId?)` | `export_plan_csv` | 3 参数 | `ExportResult` | - |
| `exportMaterialsExcel(filePath, status?)` | `export_materials_excel` | `filePath: string, status?: string` | `ExportResult` | - |

### 数据维护

| 方法 | Tauri Command | 参数 | 返回类型 | 缓存 |
|------|---------------|------|----------|------|
| `getMaterialStats()` | `get_material_stats` | - | `MaterialStats` | 5s |
| `getCleanupEstimate(olderThanDays?)` | `get_cleanup_estimate` | `olderThanDays?: number` | `CleanupEstimate` | 3s |
| `backupDatabase()` | `backup_database` | - | `BackupFileInfo` | mutation |
| `getBackups()` | `get_backups` | - | `BackupFileInfo[]` | 10s |
| `restoreDatabase(filePath)` | `restore_database` | `filePath: string` | `void` | mutation |
| `deleteBackup(filePath)` | `delete_backup` | `filePath: string` | `void` | mutation |
| `clearLogs(keepDays?)` | `clear_logs` | `keepDays?: number` | `number` | mutation |
| `cleanHistoryPlans(olderThanDays?)` | `clean_history_plans` | `olderThanDays?: number` | `number` | mutation |
| `cleanMaterials(olderThanDays?)` | `clean_materials` | `olderThanDays?: number` | `number` | mutation |

---

## materialApi (材料管理)

来源: `src/services/materialApi.ts`

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `importMaterials(filePath, mappingId?)` | `import_materials` | `filePath: string, mappingId?: number` | `ImportResult` |
| `testImportMaterials(filePath, mappingId?, mappingsJson?, valueTransforms?, sampleLimit?)` | `test_import_materials` | 5 个可选参数 | `ImportTestResult` |
| `getMaterials(filter?, pagination?)` | `get_materials` | `filter?: MaterialFilter, pagination?: Pagination` | `PagedResult<Material>` |
| `updateMaterialStatus(ids, status)` | `update_material_status` | `ids: number[], status: string` | `number` |
| `updateMaterialPriority(ids, priority)` | `update_material_priority` | `ids: number[], priority: number` | `number` |
| `refreshTemperStatus()` | `refresh_temper_status` | - | `RefreshResult` |
| `deleteMaterials(ids)` | `delete_materials` | `ids: number[]` | `number` |

---

## configApi (配置管理)

来源: `src/services/configApi.ts`

### 系统配置

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getSystemConfig()` | `get_system_config` | - | `SystemConfig` |
| `updateSystemConfig(group, key, value)` | `update_system_config` | `group: string, key: string, value: string` | `void` |
| `getShiftConfig()` | `get_shift_config` | - | `ShiftConfig[]` |
| `updateShiftConfig(shifts)` | `update_shift_config` | `shifts: ShiftConfig[]` | `void` |

### 优先级权重

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getPriorityWeightConfigs()` | `get_priority_weight_configs` | - | `PriorityWeightConfig[]` |
| `upsertPriorityWeightConfigs(inputs)` | `upsert_priority_weight_configs` | `inputs: PriorityWeightUpsertInput[]` | `PriorityWeightConfig[]` |

### 优先级维度

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getPriorityDimensionConfigs(dimensionType?)` | `get_priority_dimension_configs` | `dimensionType?: string` | `PriorityDimensionConfig[]` |
| `upsertPriorityDimensionConfig(input)` | `upsert_priority_dimension_config` | `input: PriorityDimensionUpsertInput` | `PriorityDimensionConfig` |
| `deletePriorityDimensionConfig(id)` | `delete_priority_dimension_config` | `id: number` | `void` |

### 客户优先级

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getCustomerPriorityConfigs()` | `get_customer_priority_configs` | - | `CustomerPriorityConfig[]` |
| `upsertCustomerPriorityConfig(input)` | `upsert_customer_priority_config` | `input: CustomerPriorityUpsertInput` | `CustomerPriorityConfig` |
| `deleteCustomerPriorityConfig(id)` | `delete_customer_priority_config` | `id: number` | `void` |

### 批次优先级

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getBatchPriorityConfigs()` | `get_batch_priority_configs` | - | `BatchPriorityConfig[]` |
| `upsertBatchPriorityConfig(input)` | `upsert_batch_priority_config` | `input: BatchPriorityUpsertInput` | `BatchPriorityConfig` |
| `deleteBatchPriorityConfig(id)` | `delete_batch_priority_config` | `id: number` | `void` |

### 品种优先级

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getProductTypePriorityConfigs()` | `get_product_type_priority_configs` | - | `ProductTypePriorityConfig[]` |
| `upsertProductTypePriorityConfig(input)` | `upsert_product_type_priority_config` | `input: ProductTypePriorityUpsertInput` | `ProductTypePriorityConfig` |
| `deleteProductTypePriorityConfig(id)` | `delete_product_type_priority_config` | `id: number` | `void` |

### 优先级配置导入/导出

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `importPriorityConfigs(filePath, dryRun?)` | `import_priority_configs` | `filePath: string, dryRun?: boolean` | `PriorityConfigImportResult` |
| `exportPriorityConfigsCsv(filePath)` | `export_priority_configs_csv` | `filePath: string` | `number` |
| `exportPriorityConfigsExcel(filePath)` | `export_priority_configs_excel` | `filePath: string` | `number` |
| `exportPriorityConfigTemplateCsv(filePath)` | `export_priority_config_template_csv` | `filePath: string` | `number` |
| `exportPriorityConfigTemplateExcel(filePath)` | `export_priority_config_template_excel` | `filePath: string` | `number` |

### 策略模板

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getStrategyTemplates()` | `get_strategy_templates` | - | `StrategyTemplate[]` |
| `createStrategyTemplate(input)` | `create_strategy_template` | `input: CreateStrategyInput` | `StrategyTemplate` |
| `updateStrategyTemplate(id, input)` | `update_strategy_template` | `id: number, input: UpdateStrategyInput` | `StrategyTemplate` |
| `deleteStrategyTemplate(id)` | `delete_strategy_template` | `id: number` | `void` |
| `setDefaultStrategy(id)` | `set_default_strategy` | `id: number` | `StrategyTemplate` |
| `exportStrategyTemplate(id, filePath)` | `export_strategy_template` | `id: number, filePath: string` | `void` |
| `importStrategyTemplate(filePath)` | `import_strategy_template` | `filePath: string` | `StrategyTemplate` |

### 维护计划

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getMaintenancePlans()` | `get_maintenance_plans` | - | `MaintenancePlan[]` |
| `createMaintenancePlan(input)` | `create_maintenance_plan` | `input: CreateMaintenancePlanInput` | `MaintenancePlan` |
| `updateMaintenancePlan(id, input)` | `update_maintenance_plan` | `id: number, input: UpdateMaintenancePlanInput` | `MaintenancePlan` |
| `deleteMaintenancePlan(id)` | `delete_maintenance_plan` | `id: number` | `void` |

---

## fieldMappingApi (字段映射)

来源: `src/services/fieldMappingApi.ts`

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `getFieldMappings()` | `get_field_mappings` | - | `FieldMapping[]` |
| `getFieldMapping(id)` | `get_field_mapping` | `id: number` | `FieldMapping` |
| `createFieldMapping(input)` | `create_field_mapping` | `input: CreateFieldMappingInput` | `FieldMapping` |
| `updateFieldMapping(id, input)` | `update_field_mapping` | `id: number, input: UpdateFieldMappingInput` | `FieldMapping` |
| `deleteFieldMapping(id)` | `delete_field_mapping` | `id: number` | `void` |
| `previewFileHeaders(filePath)` | `preview_file_headers` | `filePath: string` | `FilePreviewResult` |

---

## 缓存层 (requestCache)

来源: `src/services/requestCache.ts`

### `invokeDeduped<T>(command, args?, ttlMs?): Promise<T>`

- 相同 `command + JSON(args)` 的并发请求自动去重（仅发一次 IPC）
- 响应缓存 TTL 由调用方指定（默认不缓存）
- 缓存 key = `command:JSON.stringify(args)`

### `clearInvokeCache(commandPrefix?: string): void`

- 不传参数：清除全部缓存
- 传 `commandPrefix`：仅清除以该前缀开头的缓存

### TTL 策略

| 级别 | TTL | 适用场景 |
|------|-----|----------|
| `short` | 3s | 排程项、撤销计数、操作日志 |
| `normal` | 5s | 单方案、风险分析、材料统计、待温预测 |
| `long` | 10s | 方案列表、方案对比、导出模板、备份列表 |

---

## performanceApi (性能监控)

来源: `src/services/performanceApi.ts`

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `recordMetric(request)` | `record_performance_metric` | `request: RecordMetricRequest` | `void` |
| `getStats(metricType?, metricName?, hours?)` | `get_performance_stats` | 3 个可选参数 | `PerformanceStats[]` |
| `getBaselines()` | `get_performance_baselines` | - | `PerformanceBaseline[]` |
| `checkAlerts(hours?)` | `check_performance_alerts` | `hours?: number` | `PerformanceAlert[]` |
| `cleanupMetrics(days)` | `cleanup_performance_metrics` | `days: number` | `number` |

### 工具类与函数

| 导出 | 说明 |
|------|------|
| `PerformanceTimer` | 性能计时器类，`finish()` 结束计时并自动记录指标 |
| `createTimer(metricType, metricName, metadata?)` | 创建性能计时器的工厂函数 |
| `recordPageRender(pageName)` | 记录页面渲染耗时（基于 Performance Navigation API） |
| `recordMemoryUsage()` | 记录 JS 堆内存使用量（MB） |

### `RecordMetricRequest` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `metric_type` | `'page_render' \| 'api_call' \| 'memory_usage' \| string` | 指标类型 |
| `metric_name` | `string` | 指标名称（如页面名、命令名） |
| `value` | `number` | 指标值 |
| `unit` | `'ms' \| 'MB' \| string` | 单位 |
| `metadata` | `Record<string, unknown>?` | 附加元数据 |

---

## errorTrackingApi (错误追踪)

来源: `src/services/errorTrackingApi.ts`

| 方法 | Tauri Command | 参数 | 返回类型 |
|------|---------------|------|----------|
| `logError(request)` | `log_error` | `request: LogErrorRequest` | `void` |
| `getErrors(request)` | `get_errors` | `request: GetErrorsRequest` | `GetErrorsResponse` |
| `getStats()` | `get_error_stats` | - | `ErrorStats` |
| `resolveError(errorId)` | `resolve_error` | `errorId: number` | `void` |
| `deleteError(errorId)` | `delete_error` | `errorId: number` | `void` |
| `cleanupOldErrors(days)` | `cleanup_old_errors` | `days: number` | `number` |

### 全局工具函数

| 导出 | 说明 |
|------|------|
| `setupGlobalErrorHandler()` | 注册全局 `window.error` 和 `unhandledrejection` 监听，自动上报前端错误 |
| `logError(message, error?, context?)` | 手动记录错误（severity: `error`） |
| `logWarning(message, context?)` | 手动记录警告（severity: `warning`） |

### `LogErrorRequest` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `error_type` | `'frontend' \| 'backend' \| string` | 错误来源类型 |
| `severity` | `'error' \| 'warning' \| 'info'` | 严重度 |
| `message` | `string` | 错误信息 |
| `stack_trace` | `string?` | 堆栈信息 |
| `context` | `Record<string, unknown>?` | 上下文数据 |
| `user_agent` | `string?` | 浏览器 UA |
| `url` | `string?` | 当前页面 URL |
