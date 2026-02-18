# 热轧平整机组排程沙盘模拟系统 V1.4 开发方案（整合版）

---

## 文档信息

| 项目     | 内容                                |
| -------- | ----------------------------------- |
| 项目名称 | 热轧平整机组排程沙盘模拟系统        |
| 文档版本 | V1.4（整合版）                      |
| 编制日期 | 2026年2月12日                       |
| 文档性质 | 完整开发方案文档                    |
| 整合说明 | 基于V1.1业务规则 + V1.2技术实现整合 |

## 版本修订记录

| 版本 | 日期          | 修订内容                                                                                                                                                                                                                                                            | 修订人 |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| V1.1 | 2026年2月10日 | 初版业务规则                                                                                                                                                                                                                                                        | -      |
| V1.2 | 2026年2月11日 | 技术实现方案                                                                                                                                                                                                                                                        | -      |
| V1.3 | 2026年2月12日 | 整合业务规则与技术实现                                                                                                                                                                                                                                              | -      |
| V1.4 | 2026年2月12日 | 1. 统一时间字段为卷取产出时间；`<br>`2. 删除排序因子中的合同属性（避免与人工优先级维度重复）；`<br>`3. 新增人工优先级因子细化管理规则（6个维度）；`<br>`4. 新增5个优先级配置数据表；`<br>`5. 扩展材料表字段（新增客户代码、合同性质、出口标识、集批代码等） | Claude |

---

## 一、项目概述

### 1.1 项目背景

本项目面向钢铁制造企业热轧精整工序，开发一套离线排程模拟应用系统。系统聚焦于**平整机组（单机架干平整）**的排程管理，为计划人员提供策略驱动的自动排程、手工调整、风险评估、方案对比等功能，实现排程方案的模拟优化。

系统采用"沙盒模拟"理念，允许用户在离线环境下进行策略验证、方案对比和风险评估，为实际生产决策提供数据支撑。

### 1.2 核心价值

| 价值维度           | 描述                                       |
| ------------------ | ------------------------------------------ |
| **策略验证** | 离线测试多种排程策略，无需影响实际生产     |
| **风险预判** | 提前识别宽度跳跃、换辊时机、产能超限等风险 |
| **方案优选** | 多方案并行对比，量化评估排程质量           |
| **经验沉淀** | 历史方案追溯，支持排程知识积累             |

### 1.3 项目范围

| 范围项   | 说明                            |
| -------- | ------------------------------- |
| 业务范围 | 热轧精整工序 - 平整机组排程     |
| 工艺类型 | 单机架干平整                    |
| 部署方式 | 离线桌面应用，单用户沙盘模拟    |
| 排程规模 | 常规300-400卷，峰值1000-2000卷  |
| 排程周期 | 日计划/周计划/月计划/自定义周期 |
| 班次设置 | 两班制，每班12小时              |
| 运行环境 | Windows / macOS                 |

### 1.4 技术选型

| 层级     | 技术选型              | 说明               |
| -------- | --------------------- | ------------------ |
| 应用框架 | Tauri 2.x             | 跨平台桌面应用框架 |
| 后端语言 | Rust                  | 高性能、内存安全   |
| 数据库   | SQLite                | 轻量级嵌入式数据库 |
| ORM框架  | SeaORM                | Rust异步ORM框架    |
| 前端框架 | React 18 + TypeScript | 组件化前端开发     |
| UI组件库 | Ant Design 5.x        | 企业级UI组件       |
| 图表库   | ECharts 5.x           | 数据可视化         |
| 状态管理 | Zustand               | 轻量级状态管理     |
| 虚拟滚动 | react-window          | 大列表性能优化     |
| 构建工具 | Vite                  | 现代前端构建工具   |

---

## 二、系统架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           表现层 (Presentation Layer)                    │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    React + TypeScript + Ant Design                  ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │  │计划工作台│ │策略配置 │ │风险概览 │ │方案对比 │ │历史追溯 │       ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                   ││
│  │  │数据映射 │ │设置中心 │ │日志管理 │ │数据管理 │                   ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              ↕ Tauri IPC Commands                       │
├─────────────────────────────────────────────────────────────────────────┤
│                           业务层 (Business Layer)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                           Rust Core Engine                          ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             ││
│  │  │   排程引擎    │ │   规则引擎    │ │   风险评估    │             ││
│  │  │ ScheduleEngine│ │  RuleEngine   │ │ RiskAssessor  │             ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘             ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             ││
│  │  │   数据导入    │ │   方案管理    │ │   配置服务    │             ││
│  │  │ DataImporter  │ │ PlanManager   │ │ ConfigService │             ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘             ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             ││
│  │  │   数据导出    │ │   撤销服务    │ │  适温计算     │             ││
│  │  │ DataExporter  │ │ UndoService   │ │ TempCalculator│             ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              ↕ SeaORM                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                           数据层 (Data Layer)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                             SQLite                                  ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       ││
│  │  │材料主数据│ │排程方案 │ │策略模板 │ │配置参数 │ │操作日志 │       ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                               ││
│  │  │导出模板 │ │检修计划 │ │撤销栈   │                               ││
│  │  └─────────┘ └─────────┘ └─────────┘                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 项目结构

```
spm-simulator/
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs              # 入口
│   │   ├── lib.rs               # 库入口
│   │   ├── commands/            # Tauri Commands 接口
│   │   │   ├── mod.rs
│   │   │   ├── material.rs      # 材料管理命令
│   │   │   ├── schedule.rs      # 排程操作命令
│   │   │   ├── strategy.rs      # 策略配置命令
│   │   │   ├── config.rs        # 系统配置命令
│   │   │   ├── export.rs        # 导出相关命令
│   │   │   ├── log.rs           # 日志管理命令
│   │   │   └── backup.rs        # 备份相关命令
│   │   ├── engine/              # 排程引擎核心
│   │   │   ├── mod.rs
│   │   │   ├── scheduler.rs     # 自动排程算法
│   │   │   ├── validator.rs     # 约束校验器
│   │   │   ├── evaluator.rs     # 方案评估器
│   │   │   ├── sorter.rs        # 多维度排序器
│   │   │   └── temp_calc.rs     # 适温状态计算
│   │   ├── models/              # SeaORM 数据模型
│   │   │   ├── mod.rs
│   │   │   ├── material.rs
│   │   │   ├── schedule_plan.rs
│   │   │   ├── schedule_item.rs
│   │   │   ├── strategy_template.rs
│   │   │   ├── field_mapping.rs
│   │   │   ├── export_template.rs
│   │   │   ├── system_config.rs
│   │   │   ├── maintenance_plan.rs
│   │   │   ├── operation_log.rs
│   │   │   └── undo_stack.rs
│   │   ├── services/            # 业务服务层
│   │   │   ├── mod.rs
│   │   │   ├── import_service.rs
│   │   │   ├── export_service.rs
│   │   │   ├── undo_service.rs
│   │   │   ├── temp_service.rs
│   │   │   └── backup_service.rs
│   │   └── utils/               # 工具函数
│   │       ├── mod.rs
│   │       ├── datetime.rs
│   │       ├── temperature.rs
│   │       └── season.rs
│   ├── migrations/              # 数据库迁移
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                         # React 前端
│   ├── main.tsx                 # 入口
│   ├── App.tsx                  # 根组件
│   ├── routes/                  # 路由配置
│   ├── layouts/                 # 布局组件
│   │   └── MainLayout.tsx
│   ├── pages/                   # 页面组件
│   │   ├── Workbench/           # M01 计划工作台
│   │   │   ├── index.tsx
│   │   │   ├── MaterialPool.tsx
│   │   │   ├── ReadyMaterials.tsx
│   │   │   ├── WaitingMaterials.tsx
│   │   │   ├── ScheduleQueue.tsx
│   │   │   ├── GanttView.tsx
│   │   │   └── ToolBar.tsx
│   │   ├── Strategy/            # M02 策略配置
│   │   │   ├── index.tsx
│   │   │   ├── TempRuleConfig.tsx
│   │   │   ├── SortRuleConfig.tsx
│   │   │   ├── HardConstraints.tsx
│   │   │   └── SoftConstraints.tsx
│   │   ├── RiskOverview/        # M03 风险概览
│   │   │   ├── index.tsx
│   │   │   ├── ScoreCard.tsx
│   │   │   ├── CapacityChart.tsx
│   │   │   ├── TempStatusChart.tsx
│   │   │   ├── WaitingForecast.tsx
│   │   │   └── RiskList.tsx
│   │   ├── Compare/             # M04 方案对比
│   │   ├── History/             # M05 历史追溯
│   │   ├── FieldMapping/        # M06 数据映射
│   │   ├── Settings/            # M07 设置中心
│   │   │   ├── index.tsx
│   │   │   ├── TempSettings.tsx
│   │   │   ├── CapacitySettings.tsx
│   │   │   ├── ShiftSettings.tsx
│   │   │   ├── MaintenanceSettings.tsx
│   │   │   └── BackupSettings.tsx
│   │   ├── Logs/                # M08 日志管理
│   │   └── DataManage/          # M09 数据管理
│   ├── components/              # 通用组件
│   │   ├── MaterialTable/
│   │   ├── ScheduleBoard/
│   │   ├── GanttChart/
│   │   ├── DragDrop/
│   │   ├── Charts/
│   │   ├── Risk/
│   │   ├── TempStatusBadge/
│   │   └── Common/
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useUndo.ts
│   │   ├── useSchedule.ts
│   │   ├── useTempStatus.ts
│   │   ├── useShortcuts.ts
│   │   └── useConfig.ts
│   ├── stores/                  # Zustand 状态管理
│   │   ├── index.ts
│   │   ├── materialStore.ts
│   │   ├── scheduleStore.ts
│   │   └── configStore.ts
│   ├── services/                # Tauri API 封装
│   │   ├── index.ts
│   │   ├── materialApi.ts
│   │   ├── scheduleApi.ts
│   │   ├── tempApi.ts
│   │   └── configApi.ts
│   ├── types/                   # TypeScript 类型定义
│   │   ├── index.ts
│   │   ├── material.ts
│   │   ├── schedule.ts
│   │   ├── temp.ts
│   │   └── config.ts
│   ├── utils/                   # 工具函数
│   ├── constants/               # 常量定义
│   └── styles/                  # 全局样式
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 三、核心业务规则

### 3.1 适温材料规则（重要）

#### 3.1.1 业务背景

热轧钢卷在轧制产出后温度较高，需要经过一定时间的冷却才能进行平整加工。不同季节由于环境温度差异，所需的冷却时间不同。只有达到适温状态的材料才可以进入排程。

#### 3.1.2 适温判定规则

| 季节 | 月份范围        | 适温条件        | 说明                    |
| ---- | --------------- | --------------- | ----------------------- |
| 春季 | 3月、4月、5月   | 产出时间 ≥ 3天 | 待温时间3天及以上为适温 |
| 夏季 | 6月、7月、8月   | 产出时间 ≥ 4天 | 待温时间4天及以上为适温 |
| 秋季 | 9月、10月、11月 | 产出时间 ≥ 4天 | 待温时间4天及以上为适温 |
| 冬季 | 12月、1月、2月  | 产出时间 ≥ 3天 | 待温时间3天及以上为适温 |

#### 3.1.3 温度状态分类

| 状态           | 说明                   | 可否排程        |
| -------------- | ---------------------- | --------------- |
| **适温** | 已达到可加工温度条件   | ✓ 可进入排程   |
| **待温** | 尚未达到可加工温度条件 | ✗ 不可进入排程 |

#### 3.1.4 计算逻辑

```
产出时间 = 卷取产出时间
待温天数 = 当前日期 - 产出时间
当前季节 = 根据当前月份判定

if (当前季节 in [夏季, 秋季]) {
    适温阈值 = 4天（可配置）
} else {
    适温阈值 = 3天（可配置）
}

if (待温天数 >= 适温阈值) {
    温度状态 = 适温
} else {
    温度状态 = 待温
}
```

#### 3.1.5 适温状态判定流程图

```
                    ┌─────────────────┐
                    │     开始        │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ 获取材料卷取产出 │
                    │     时间        │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ 计算待温天数    │
                    │ = 当前日期      │
                    │   - 产出时间    │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ 获取当前月份    │
                    └────────┬────────┘
                             ▼
           ┌─────────────────────────────┐
           │    判断当前季节              │
           └──────────────┬──────────────┘
                          │
         ┌────────────────┴────────────────────┐
         ▼                                     ▼
┌─────────────────┐                  ┌─────────────────┐
│ 春季(3,4,5月)   │                  │ 夏季(6,7,8月)   │
│ 冬季(12,1,2月)  │                  │ 秋季(9,10,11月) │
│ 阈值 = 3天      │                  │ 阈值 = 4天      │
└────────┬────────┘                  └────────┬────────┘
         │                                     │
         └────────────────┬────────────────────┘
                          ▼
                ┌─────────────────┐
                │ 待温天数 ≥ 阈值？│
                └────────┬────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
    ┌───────────┐                 ┌───────────┐
    │    是     │                 │    否     │
    │ 状态=适温  │                 │ 状态=待温  │
    │ 可进入排程 │                 │ 不可排程   │
    └─────┬─────┘                 └─────┬─────┘
          │                             │
          └──────────────┬──────────────┘
                         ▼
                ┌─────────────────┐
                │     结束        │
                └─────────────────┘
```

#### 3.1.6 配置参数

| 参数名称     | 默认值  | 单位 | 说明           |
| ------------ | ------- | ---- | -------------- |
| 春季月份     | 3,4,5   | -    | 春季包含的月份 |
| 夏季月份     | 6,7,8   | -    | 夏季包含的月份 |
| 秋季月份     | 9,10,11 | -    | 秋季包含的月份 |
| 冬季月份     | 12,1,2  | -    | 冬季包含的月份 |
| 春季适温天数 | 3       | 天   | 春季适温阈值   |
| 夏季适温天数 | 4       | 天   | 夏季适温阈值   |
| 秋季适温天数 | 4       | 天   | 秋季适温阈值   |
| 冬季适温天数 | 3       | 天   | 冬季适温阈值   |

### 3.2 排序优先级规则

排程时对适温材料按以下优先级顺序进行排序：

| 优先级      | 排序因子           | 方向           | 权重          | 分组 | 说明                                             |
| ----------- | ------------------ | -------------- | ------------- | ---- | ------------------------------------------------ |
| **1** | **适温状态** | **降序** | **100** | 否   | **适温材料优先（前置条件，内置不可删除）** |
| 2           | 宽度               | 降序（宽→窄） | 95            | 是   | 减少辊型调整频次                                 |
| 3           | 人工干预优先级     | 降序（高优先） | 90            | 否   | 人工调整权重                                     |
| 4           | 硬度等级           | 升序（软→硬） | 85            | 是   | 轧制力平稳过渡                                   |
| 5           | 厚度               | 升序           | 80            | 否   | 减少压下调整                                     |
| 6           | 表面等级           | 降序（FA优先） | 75            | 否   | 新辊优先高要求                                   |
| 7           | 产品大类           | 升序           | 65            | 是   | 产品分类聚集                                     |
| 8           | 库龄               | 降序（久优先） | 60            | 否   | 库存周转                                         |
| 9           | 钢种               | 升序           | 55            | 是   | 减少质量风险                                     |

> **注意**：适温状态是排程的前置条件，待温材料不会出现在排程队列中，只会显示在待排池（标记为"待温"状态）。
> **说明**：人工干预优先级由多维度因子组合计算得出，详见[3.6 人工优先级因子管理规则](#36-人工优先级因子管理规则)。

### 3.3 硬约束规则

| 约束类型               | 参数      | 默认值 | 说明                     |
| ---------------------- | --------- | ------ | ------------------------ |
| **适温材料筛选** | enabled   | true   | 只有适温材料可进入排程   |
| 宽度跳跃限制           | max_value | 100    | 相邻材料宽度差上限(mm)   |
| 换辊吨位阈值           | max_value | 800    | 累计吨位达到后换辊(吨)   |
| 班次产能上限           | max_value | 1200   | 单班最大排产量(吨)       |
| 超期强制优先           | enabled   | true   | 超期材料是否强制优先排产 |
| 换辊时长               | duration  | 30     | 换辊占用时间(分钟)       |

### 3.4 软约束规则

| 约束类型       | 参数              | 默认值  | 说明                    |
| -------------- | ----------------- | ------- | ----------------------- |
| 钢种切换惩罚   | penalty           | 10      | 钢种变化的惩罚分值      |
| 厚度跳跃惩罚   | threshold/penalty | 1.0mm/5 | 超过阈值的惩罚分值      |
| 高表面换辊优先 | bonus             | 20      | FA/FB在换辊后优先的加分 |
| 合同集中奖励   | bonus             | 10      | 同合同材料连续的加分    |

### 3.5 换辊逻辑

```
触发条件: 累计处理吨位 ≥ 换辊阈值（默认800吨）

换辊原则:
1. 换辊点应在"自然断点"（宽度跳跃处）
2. 换辊后从新宽度段开始
3. 整卷收尾：换辊点确定后，当前材料处理完毕再换辊

换辊时间: 默认30分钟，计入排程时间
```

### 3.6 人工优先级因子管理规则

#### 3.6.1 业务背景

人工优先级是排序因子中的重要组成部分（权重90），用于体现业务层面的综合优先级考量。为满足复杂业务场景，人工优先级由多个维度因子组合计算得出，支持灵活配置和扩展。

#### 3.6.2 优先级计算公式

```
人工优先级分值 = 合同考核权重 × 合同考核分值
                + 交期属性权重 × 交期属性分值
                + 合同属性权重 × 合同属性分值
                + 客户优先级权重 × 客户优先级分值
                + 集批优先级权重 × 集批优先级分值
                + 产品大类权重 × 产品大类分值
                + 人工调整值
```

#### 3.6.3 维度因子定义

##### **维度1：合同考核**

根据合同性质和交期属性判定是否为考核合同。

| 考核类型         | 分值 | 计算规则                                                 |
| ---------------- | ---- | -------------------------------------------------------- |
| **考核**   | 100  | 合同性质 IN ['订单','框架订单'] AND 交期属性 != '无要求' |
| **非考核** | 0    | 其他情况                                                 |

##### **维度2：交期属性**

根据合同性质、合同交期和按周交货标识组合计算。以下分类为默认配置，可自定义修改扩展。

| 交期属性           | 分值 | 计算规则                     | 说明       |
| ------------------ | ---- | ---------------------------- | ---------- |
| **D+0**      | 1000 | 合同交期 = 当前日期          | 当天必交   |
| **D+7**      | 900  | 合同交期 ≤ 当前日期+7天     | 7天内必交  |
| **超级前欠** | 800  | 当前日期 - 合同交期 > 30天   | 严重逾期   |
| **双前欠**   | 700  | 当前日期 - 合同交期 > 60天   | 逾期两个月 |
| **前欠**     | 600  | 当前日期 > 合同交期          | 已逾期     |
| **本期**     | 500  | 合同交期在本月内             | 本月到期   |
| **本月延期** | 400  | 合同交期在本月且晚于计划日期 | 本月延后   |
| **次月本期** | 300  | 合同交期在次月               | 次月到期   |
| **次月延期** | 200  | 合同交期在次月且晚于常规周期 | 次月延后   |
| **无要求**   | 0    | 无合同交期或现货             | 无交期约束 |

**配置说明**：

- 交期属性的分类和分值可在前端配置界面自定义修改
- 支持新增自定义交期类型
- 计算规则支持规则引擎配置

##### **维度3：合同属性**

根据合同性质和出口标识组合计算。以下分类为示例，支持规则引擎自定义配置。

| 合同属性             | 分值 | 示例规则                        |
| -------------------- | ---- | ------------------------------- |
| **出口合同**   | 100  | 合同性质='订单' AND 出口标识=是 |
| **期货合同**   | 90   | 合同性质='期货'                 |
| **现货合同**   | 80   | 合同性质='现货'                 |
| **过渡材合同** | 70   | 合同性质='过渡材'               |
| **其他**       | 0    | 其他情况                        |

**配置说明**：

- 合同属性分类和计算规则完全由规则引擎自定义配置
- 用户可根据实际业务需求定义新的合同属性类型
- 规则引擎支持复杂条件组合（AND/OR/NOT逻辑）

##### **维度4：客户优先级**

根据客户代码查找客户优先级配置表获取分值。

| 客户等级           | 分值 | 配置方式             |
| ------------------ | ---- | -------------------- |
| **VIP客户**  | 100  | 前端配置客户代码列表 |
| **重点客户** | 80   | 前端配置客户代码列表 |
| **普通客户** | 50   | 默认                 |
| **黑名单**   | 0    | 前端配置客户代码列表 |

**配置说明**：

- 支持前端界面配置客户代码及对应优先级
- 支持批量导入客户配置
- 未配置的客户默认为"普通客户"

##### **维度5：集批优先级**

根据集批代码查找集批优先级配置表获取分值。

| 集批类型           | 分值 | 配置方式         |
| ------------------ | ---- | ---------------- |
| **紧急集批** | 100  | 前端配置集批代码 |
| **计划集批** | 50   | 前端配置集批代码 |
| **普通**     | 0    | 默认             |

**配置说明**：

- 支持前端界面配置集批代码及对应优先级
- 未配置的集批默认为"普通"

##### **维度6：产品大类**

根据产品大类字段（product_type）查找产品大类优先级配置表获取分值。

| 产品大类           | 分值 | 配置方式             |
| ------------------ | ---- | -------------------- |
| **优先产品** | 100  | 前端配置产品大类列表 |
| **常规产品** | 50   | 前端配置产品大类列表 |
| **普通**     | 0    | 默认                 |

**配置说明**：

- 支持前端界面配置产品大类及对应优先级
- 未配置的产品大类默认为"普通"

#### 3.6.4 权重配置

各维度因子的权重系数可在前端配置界面调整：

| 维度类型   | 默认权重 | 调整范围 | 说明             |
| ---------- | -------- | -------- | ---------------- |
| 合同考核   | 1.0      | 0.0-1.0  | 是否为考核合同   |
| 交期属性   | 0.9      | 0.0-1.0  | D+0/D+7/前欠等   |
| 合同属性   | 0.5      | 0.0-1.0  | 出口/期货/现货等 |
| 客户优先级 | 0.6      | 0.0-1.0  | VIP/重点/普通    |
| 集批优先级 | 0.4      | 0.0-1.0  | 紧急/计划/普通   |
| 产品大类   | 0.5      | 0.0-1.0  | 优先产品类别     |

#### 3.6.5 人工调整

支持计划员在自动计算的基础上进行人工微调：

- **调整范围**：-100 ~ +100
- **调整方式**：前端界面直接输入或使用滑块
- **调整记录**：需填写调整原因，便于追溯
- **最终分值**：自动计算分值 + 人工调整值

#### 3.6.6 配置管理

所有维度配置均支持前端界面管理：

- **权重配置**：滑块调整各维度权重系数
- **交期属性配置**：表格形式配置交期类型、分值、计算规则
- **合同属性配置**：规则引擎配置合同属性分类和规则
- **客户优先级配置**：表格形式配置客户代码、等级、分值
- **集批优先级配置**：表格形式配置集批代码、类型、分值
- **产品大类配置**：表格形式配置产品大类、优先级、分值

#### 3.6.7 计算示例

**示例材料：**

- 合同性质：订单
- 交期属性：D+7（分值900）
- 合同属性：出口合同（分值100）
- 客户代码：VIP客户（分值100）
- 集批代码：紧急集批（分值100）
- 产品大类：优先产品（分值100）
- 人工调整：+10

**计算过程：**

```
自动计算分值 = 1.0 × 100  (合同考核)
             + 0.9 × 900  (交期属性)
             + 0.5 × 100  (合同属性)
             + 0.6 × 100  (客户优先级)
             + 0.4 × 100  (集批优先级)
             + 0.5 × 100  (产品大类)
             = 100 + 810 + 50 + 60 + 40 + 50
             = 1110

最终优先级分值 = 1110 + 10 = 1120
```

---

## 四、数据模型设计

### 4.1 核心实体关系

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    material     │       │  schedule_plan  │       │  schedule_item  │
│   材料主数据     │       │   排程方案       │       │   排程明细       │
└──────┬──────────┘       └──────┬──────────┘       └──────┬──────────┘
       │                         │                         │
       │                         │ 1:N                     │
       │                         ├─────────────────────────┤
       │                         │
       │                         │ N:1
       │     ┌───────────────────┴───────────────┐
       │     │                                   │
       │     ▼                                   │
       │ ┌─────────────────┐                     │
       └─│  schedule_item  │◄────────────────────┘
         │  (材料引用)      │
         └─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│strategy_template│       │  field_mapping  │       │ export_template │
│   策略模板       │       │   字段映射       │       │   导出模板       │
└─────────────────┘       └─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  system_config  │       │maintenance_plan │       │  operation_log  │
│   系统配置       │       │   检修计划       │       │   操作日志       │
└─────────────────┘       └─────────────────┘       └─────────────────┘

┌─────────────────┐
│   undo_stack    │
│   撤销栈        │
└─────────────────┘
```

### 4.2 数据表结构设计

#### 4.2.1 材料主数据表 (material)

```sql
CREATE TABLE material (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    coil_id         TEXT NOT NULL UNIQUE,           -- 材料编号/卷号
    contract_no     TEXT,                           -- 合同号
    customer_name   TEXT,                           -- 客户名称
    customer_code   TEXT,                           -- 客户代码
    steel_grade     TEXT NOT NULL,                  -- 钢种代码
    thickness       REAL NOT NULL,                  -- 厚度(mm)
    width           REAL NOT NULL,                  -- 宽度(mm)
    weight          REAL NOT NULL,                  -- 重量(吨)
    hardness_level  TEXT,                           -- 硬度等级(软/中/硬)
    surface_level   TEXT,                           -- 表面等级(FA/FB/FC/FD)
    roughness_req   TEXT,                           -- 粗糙度要求
    elongation_req  REAL,                           -- 延伸率要求(%)
    product_type    TEXT,                           -- 产品大类
    contract_attr   TEXT,                           -- 合同属性(出口合同/期货合同/现货合同/过渡材合同等)
    contract_nature TEXT,                           -- 合同性质(订单/现货/框架等)
    export_flag     BOOLEAN DEFAULT FALSE,          -- 出口标识
    weekly_delivery BOOLEAN DEFAULT FALSE,          -- 按周交货标识
    batch_code      TEXT,                           -- 集批代码
    coiling_time    DATETIME NOT NULL,              -- 卷取产出时间
    temp_status     TEXT DEFAULT 'waiting',         -- 温度状态(ready/waiting)
    temp_wait_days  INTEGER DEFAULT 0,              -- 待温天数
    is_tempered     BOOLEAN DEFAULT FALSE,          -- 是否已适温
    tempered_at     DATETIME,                       -- 适温时间
    storage_days    INTEGER DEFAULT 0,              -- 库龄天数
    storage_loc     TEXT,                           -- 库位
    due_date        DATETIME,                       -- 交货期限
    status          TEXT DEFAULT 'pending',         -- 状态(pending/frozen)
    priority_auto   INTEGER DEFAULT 0,              -- 自动计算优先级
    priority_manual_adjust INTEGER DEFAULT 0,       -- 人工调整值
    priority_final  INTEGER DEFAULT 0,              -- 最终优先级
    priority_detail TEXT,                           -- 优先级明细(JSON)
    priority_reason TEXT,                           -- 优先级调整原因
    remarks         TEXT,                           -- 备注
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_material_status ON material(status);
CREATE INDEX idx_material_temp_status ON material(temp_status);
CREATE INDEX idx_material_is_tempered ON material(is_tempered);
CREATE INDEX idx_material_width ON material(width);
CREATE INDEX idx_material_coiling_time ON material(coiling_time);
CREATE INDEX idx_material_due_date ON material(due_date);
CREATE INDEX idx_material_customer_code ON material(customer_code);
CREATE INDEX idx_material_batch_code ON material(batch_code);
CREATE INDEX idx_material_composite ON material(status, is_tempered, width);
```

#### 4.2.2 排程方案表 (schedule_plan)

```sql
CREATE TABLE schedule_plan (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_no         TEXT NOT NULL UNIQUE,           -- 方案编号
    name            TEXT NOT NULL,                  -- 方案名称
    period_type     TEXT NOT NULL,                  -- 周期类型(daily/weekly/monthly/custom)
    start_date      DATE NOT NULL,                  -- 开始日期
    end_date        DATE NOT NULL,                  -- 结束日期
    strategy_id     INTEGER,                        -- 关联策略模板
    status          TEXT DEFAULT 'draft',           -- 状态(draft/saved/confirmed/archived)
    version         INTEGER DEFAULT 1,              -- 版本号
    parent_id       INTEGER,                        -- 父版本ID
    total_count     INTEGER DEFAULT 0,              -- 材料数量
    total_weight    REAL DEFAULT 0,                 -- 总重量(吨)
    roll_change_count INTEGER DEFAULT 0,            -- 换辊次数
    score_overall   INTEGER,                        -- 综合评分(0-100)
    score_sequence  INTEGER,                        -- 排序合理性评分
    score_delivery  INTEGER,                        -- 交期达成率评分
    score_efficiency INTEGER,                       -- 换辊效率评分
    risk_count_high INTEGER DEFAULT 0,              -- 高风险项数量
    risk_count_medium INTEGER DEFAULT 0,            -- 中风险项数量
    risk_count_low  INTEGER DEFAULT 0,              -- 低风险项数量
    risk_summary    TEXT,                           -- 风险摘要(JSON)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks         TEXT,                           -- 备注
    FOREIGN KEY (strategy_id) REFERENCES strategy_template(id),
    FOREIGN KEY (parent_id) REFERENCES schedule_plan(id)
);
```

#### 4.2.3 排程明细表 (schedule_item)

```sql
CREATE TABLE schedule_item (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id         INTEGER NOT NULL,               -- 所属方案ID
    material_id     INTEGER NOT NULL,               -- 材料ID
    sequence        INTEGER NOT NULL,               -- 排程顺序
    shift_date      DATE NOT NULL,                  -- 所属日期
    shift_no        INTEGER NOT NULL,               -- 班次号(1=白班,2=夜班)
    shift_type      TEXT NOT NULL,                  -- 班次类型(day/night)
    planned_start   DATETIME,                       -- 计划开始时间
    planned_end     DATETIME,                       -- 计划结束时间
    cumulative_weight REAL DEFAULT 0,               -- 累计轧制重量(本换辊周期)
    is_roll_change  BOOLEAN DEFAULT FALSE,          -- 换辊标记
    is_locked       BOOLEAN DEFAULT FALSE,          -- 是否锁定位置
    lock_reason     TEXT,                           -- 锁定原因
    risk_flags      TEXT,                           -- 风险标记(JSON)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES schedule_plan(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES material(id),
    UNIQUE(plan_id, sequence)
);

CREATE INDEX idx_schedule_item_plan ON schedule_item(plan_id);
CREATE INDEX idx_schedule_item_plan_seq ON schedule_item(plan_id, sequence);
CREATE INDEX idx_schedule_item_shift ON schedule_item(shift_no);
```

#### 4.2.4 策略模板表 (strategy_template)

```sql
CREATE TABLE strategy_template (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,           -- 模板名称
    description     TEXT,                           -- 策略说明
    is_default      BOOLEAN DEFAULT FALSE,          -- 是否默认策略
    is_system       BOOLEAN DEFAULT FALSE,          -- 是否系统内置
    sort_weights    TEXT NOT NULL,                  -- 排序权重配置(JSON)
    constraints     TEXT NOT NULL,                  -- 约束配置(JSON)
    soft_constraints TEXT,                          -- 软约束配置(JSON)
    eval_weights    TEXT NOT NULL,                  -- 评估权重(JSON)
    temper_rules    TEXT NOT NULL,                  -- 适温规则配置(JSON)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2.5 字段映射配置表 (field_mapping)

```sql
CREATE TABLE field_mapping (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name   TEXT NOT NULL,                  -- 映射模板名称
    is_default      BOOLEAN DEFAULT FALSE,          -- 是否默认模板
    source_type     TEXT NOT NULL,                  -- 源文件类型(Excel/CSV)
    mappings        TEXT NOT NULL,                  -- 映射规则(JSON)
    value_transforms TEXT,                          -- 值转换字典(JSON)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2.6 导出模板表 (export_template)

```sql
CREATE TABLE export_template (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,           -- 模板名称
    description     TEXT,                           -- 描述
    columns         TEXT NOT NULL,                  -- 导出列配置(JSON)
    format_rules    TEXT,                           -- 格式化规则(JSON)
    is_default      BOOLEAN DEFAULT FALSE,          -- 是否默认
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2.7 系统配置表 (system_config)

```sql
CREATE TABLE system_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    config_group    TEXT NOT NULL,                  -- 配置分组
    config_key      TEXT NOT NULL,                  -- 配置键
    config_value    TEXT NOT NULL,                  -- 配置值
    value_type      TEXT NOT NULL,                  -- 值类型(string/number/boolean/json)
    description     TEXT,                           -- 配置说明
    is_editable     BOOLEAN DEFAULT TRUE,           -- 是否可编辑
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_group, config_key)
);
```

#### 4.2.8 检修计划表 (maintenance_plan)

```sql
CREATE TABLE maintenance_plan (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,                  -- 检修标题
    start_time      DATETIME NOT NULL,              -- 开始时间
    end_time        DATETIME NOT NULL,              -- 结束时间
    maintenance_type TEXT NOT NULL,                 -- 检修类型
    recurrence      TEXT,                           -- 重复规则(JSON)
    is_active       BOOLEAN DEFAULT TRUE,           -- 是否启用
    description     TEXT,                           -- 描述
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2.9 操作日志表 (operation_log)

```sql
CREATE TABLE operation_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type        TEXT NOT NULL,                  -- 日志类型
    action          TEXT NOT NULL,                  -- 操作动作
    target_type     TEXT,                           -- 目标类型
    target_id       INTEGER,                        -- 目标ID
    detail          TEXT,                           -- 操作详情(JSON)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operation_log_time ON operation_log(created_at DESC);
CREATE INDEX idx_operation_log_type ON operation_log(log_type, created_at DESC);
```

#### 4.2.10 撤销栈表 (undo_stack)

```sql
CREATE TABLE undo_stack (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id         INTEGER NOT NULL,               -- 关联方案
    action_type     TEXT NOT NULL,                  -- 操作类型
    before_state    TEXT NOT NULL,                  -- 操作前状态(JSON)
    after_state     TEXT NOT NULL,                  -- 操作后状态(JSON)
    is_undone       BOOLEAN DEFAULT FALSE,          -- 是否已撤销
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES schedule_plan(id) ON DELETE CASCADE
);

CREATE INDEX idx_undo_stack_plan ON undo_stack(plan_id, created_at);
```

#### 4.2.11 优先级维度配置表 (priority_dimension_config)

```sql
CREATE TABLE priority_dimension_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dimension_type  TEXT NOT NULL,                  -- 维度类型(delivery/contract/assessment)
    dimension_code  TEXT NOT NULL,                  -- 维度代码
    dimension_name  TEXT NOT NULL,                  -- 维度名称
    score           INTEGER NOT NULL DEFAULT 0,     -- 分值
    enabled         BOOLEAN NOT NULL DEFAULT 1,     -- 是否启用
    sort_order      INTEGER DEFAULT 0,              -- 排序
    rule_config     TEXT,                           -- 规则配置(JSON)
    description     TEXT,                           -- 说明
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dimension_type, dimension_code)
);

CREATE INDEX idx_priority_dimension_type ON priority_dimension_config(dimension_type, enabled);

-- 初始数据：交期属性维度（默认配置，可自定义修改扩展）
INSERT INTO priority_dimension_config (dimension_type, dimension_code, dimension_name, score, sort_order, description) VALUES
('delivery', 'D+0', 'D+0', 1000, 1, '当天必交'),
('delivery', 'D+7', 'D+7', 900, 2, '7天内必交'),
('delivery', 'super_overdue', '超级前欠', 800, 3, '逾期超过30天'),
('delivery', 'double_overdue', '双前欠', 700, 4, '逾期超过60天'),
('delivery', 'overdue', '前欠', 600, 5, '已逾期'),
('delivery', 'current_period', '本期', 500, 6, '本月到期'),
('delivery', 'current_delayed', '本月延期', 400, 7, '本月延后'),
('delivery', 'next_period', '次月本期', 300, 8, '次月到期'),
('delivery', 'next_delayed', '次月延期', 200, 9, '次月延后'),
('delivery', 'no_requirement', '无要求', 0, 10, '无交期约束');

-- 初始数据：合同属性维度（示例配置，支持规则引擎自定义）
INSERT INTO priority_dimension_config (dimension_type, dimension_code, dimension_name, score, sort_order, description) VALUES
('contract', 'export_contract', '出口合同', 100, 1, '出口订单合同'),
('contract', 'futures_contract', '期货合同', 90, 2, '期货合同'),
('contract', 'spot_contract', '现货合同', 80, 3, '现货合同'),
('contract', 'transition_contract', '过渡材合同', 70, 4, '过渡材料合同'),
('contract', 'other', '其他', 0, 5, '其他合同类型');
```

#### 4.2.12 客户优先级配置表 (customer_priority_config)

```sql
CREATE TABLE customer_priority_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code   TEXT NOT NULL UNIQUE,           -- 客户代码
    customer_name   TEXT NOT NULL,                  -- 客户名称
    priority_level  TEXT NOT NULL DEFAULT 'normal', -- 优先级等级(vip/key/normal/blacklist)
    priority_score  INTEGER NOT NULL DEFAULT 50,    -- 优先级分值
    enabled         BOOLEAN NOT NULL DEFAULT 1,     -- 是否启用
    remarks         TEXT,                           -- 备注
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_priority_code ON customer_priority_config(customer_code, enabled);
CREATE INDEX idx_customer_priority_level ON customer_priority_config(priority_level);
```

#### 4.2.13 集批优先级配置表 (batch_priority_config)

```sql
CREATE TABLE batch_priority_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_code      TEXT NOT NULL UNIQUE,           -- 集批代码
    batch_name      TEXT NOT NULL,                  -- 集批名称
    priority_type   TEXT NOT NULL DEFAULT 'normal', -- 优先级类型(urgent/planned/normal)
    priority_score  INTEGER NOT NULL DEFAULT 0,     -- 优先级分值
    enabled         BOOLEAN NOT NULL DEFAULT 1,     -- 是否启用
    remarks         TEXT,                           -- 备注
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batch_priority_code ON batch_priority_config(batch_code, enabled);
CREATE INDEX idx_batch_priority_type ON batch_priority_config(priority_type);
```

#### 4.2.14 产品大类优先级配置表 (product_type_priority_config)

```sql
CREATE TABLE product_type_priority_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_type    TEXT NOT NULL UNIQUE,           -- 产品大类
    product_name    TEXT NOT NULL,                  -- 产品名称
    priority_level  TEXT NOT NULL DEFAULT 'normal', -- 优先级等级(priority/regular/normal)
    priority_score  INTEGER NOT NULL DEFAULT 0,     -- 优先级分值
    enabled         BOOLEAN NOT NULL DEFAULT 1,     -- 是否启用
    remarks         TEXT,                           -- 备注
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_type_priority ON product_type_priority_config(product_type, enabled);
CREATE INDEX idx_product_type_level ON product_type_priority_config(priority_level);
```

#### 4.2.15 优先级权重配置表 (priority_weight_config)

```sql
CREATE TABLE priority_weight_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dimension_type  TEXT NOT NULL UNIQUE,           -- 维度类型(assessment/delivery/contract/customer/batch/product_type)
    dimension_name  TEXT NOT NULL,                  -- 维度名称
    weight          REAL NOT NULL DEFAULT 1.0,      -- 权重系数(0.0-1.0)
    enabled         BOOLEAN NOT NULL DEFAULT 1,     -- 是否启用
    sort_order      INTEGER DEFAULT 0,              -- 排序
    description     TEXT,                           -- 说明
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始数据：默认权重配置
INSERT INTO priority_weight_config (dimension_type, dimension_name, weight, sort_order, description) VALUES
('assessment', '合同考核', 1.0, 1, '考核/非考核'),
('delivery', '交期属性', 0.9, 2, 'D+0/D+7/前欠等'),
('contract', '合同属性', 0.5, 3, '出口/期货/现货等'),
('customer', '客户优先级', 0.6, 4, 'VIP/重点/普通'),
('batch', '集批优先级', 0.4, 5, '紧急/计划/普通'),
('product_type', '产品大类', 0.5, 6, '优先产品类别');
```

### 4.3 JSON配置结构定义

#### 4.3.1 排序规则配置 (sort_weights)

```json
{
  "priorities": [
    {
      "field": "temp_status",
      "order": "desc",
      "weight": 100,
      "enabled": true,
      "group": false,
      "description": "适温状态优先（前置条件）",
      "sort_map": {"ready": 1, "waiting": 0},
      "is_prerequisite": true
    },
    {
      "field": "width",
      "order": "desc",
      "weight": 95,
      "enabled": true,
      "group": true,
      "description": "宽度优先，宽→窄"
    },
    {
      "field": "priority",
      "order": "desc",
      "weight": 90,
      "enabled": true,
      "group": false,
      "description": "人工干预优先级"
    },
    {
      "field": "hardness_level",
      "order": "asc",
      "weight": 85,
      "enabled": true,
      "group": true,
      "description": "硬度等级，软→硬",
      "sort_map": {"软": 1, "中": 2, "硬": 3}
    },
    {
      "field": "thickness",
      "order": "asc",
      "weight": 80,
      "enabled": true,
      "group": false,
      "description": "厚度"
    },
    {
      "field": "surface_level",
      "order": "desc",
      "weight": 75,
      "enabled": true,
      "group": false,
      "description": "表面等级",
      "sort_map": {"FA": 4, "FB": 3, "FC": 2, "FD": 1}
    },
    {
      "field": "contract_attr",
      "order": "asc",
      "weight": 70,
      "enabled": true,
      "group": true,
      "description": "合同属性"
    },
    {
      "field": "product_type",
      "order": "asc",
      "weight": 65,
      "enabled": true,
      "group": true,
      "description": "产品大类"
    },
    {
      "field": "storage_days",
      "order": "desc",
      "weight": 60,
      "enabled": true,
      "group": false,
      "description": "库龄，久→新"
    },
    {
      "field": "steel_grade",
      "order": "asc",
      "weight": 55,
      "enabled": true,
      "group": true,
      "description": "钢种"
    }
  ]
}
```

#### 4.3.2 适温规则配置 (temper_rules)

```json
{
  "enabled": true,
  "description": "适温材料判定规则",
  "seasons": {
    "spring": {
      "months": [3, 4, 5],
      "min_days": 3,
      "description": "春季：3天及以上为适温"
    },
    "summer": {
      "months": [6, 7, 8],
      "min_days": 4,
      "description": "夏季：4天及以上为适温"
    },
    "autumn": {
      "months": [9, 10, 11],
      "min_days": 4,
      "description": "秋季：4天及以上为适温"
    },
    "winter": {
      "months": [12, 1, 2],
      "min_days": 3,
      "description": "冬季：3天及以上为适温"
    }
  }
}
```

#### 4.3.3 硬约束配置 (constraints)

```json
{
  "constraints": [
    {
      "type": "temp_status_filter",
      "name": "适温材料筛选",
      "enabled": true,
      "description": "只有适温材料才可进入排程队列"
    },
    {
      "type": "width_jump",
      "name": "宽度跳跃限制",
      "max_value": 100,
      "unit": "mm",
      "enabled": true,
      "error_message": "相邻材料宽度差超过{max_value}mm限制"
    },
    {
      "type": "roll_change_tonnage",
      "name": "换辊吨位阈值",
      "max_value": 800,
      "unit": "吨",
      "enabled": true,
      "finish_last_coil": true,
      "description": "达到阈值后当前卷完成后换辊"
    },
    {
      "type": "shift_capacity",
      "name": "班次产能上限",
      "max_value": 1200,
      "unit": "吨",
      "enabled": true
    },
    {
      "type": "roll_change_duration",
      "name": "换辊时长",
      "value": 30,
      "unit": "分钟",
      "enabled": true
    },
    {
      "type": "overdue_priority",
      "name": "超期材料强制优先",
      "max_days": 0,
      "enabled": true,
      "description": "超期材料必须优先安排"
    }
  ]
}
```

#### 4.3.4 软约束配置 (soft_constraints)

```json
{
  "constraints": [
    {
      "type": "steel_grade_switch",
      "name": "钢种切换惩罚",
      "penalty": 10,
      "enabled": true
    },
    {
      "type": "thickness_jump",
      "name": "厚度跳跃惩罚",
      "threshold": 1.0,
      "penalty": 5,
      "unit": "mm",
      "enabled": true
    },
    {
      "type": "surface_after_roll_change",
      "name": "高表面等级换辊后优先",
      "target_levels": ["FA", "FB"],
      "within_coils": 5,
      "bonus": 20,
      "enabled": true
    },
    {
      "type": "contract_grouping",
      "name": "合同材料集中",
      "bonus": 10,
      "enabled": true
    }
  ]
}
```

#### 4.3.5 评估权重配置 (eval_weights)

```json
{
  "weights": {
    "width_jump_count": {
      "weight": 30,
      "description": "宽度跳跃次数"
    },
    "roll_change_count": {
      "weight": 25,
      "description": "换辊次数"
    },
    "capacity_utilization": {
      "weight": 20,
      "description": "产能利用率"
    },
    "tempered_ratio": {
      "weight": 15,
      "description": "适温材料比例"
    },
    "urgent_completion": {
      "weight": 10,
      "description": "紧急订单完成率"
    }
  }
}
```

#### 4.3.6 字段映射配置 (mappings)

```json
{
  "mappings": [
    {
      "target_field": "coil_id",
      "source_field": "COIL_ID",
      "mapping_type": "direct",
      "required": true
    },
    {
      "target_field": "weight",
      "source_field": "WGT_KG",
      "mapping_type": "calculate",
      "expression": "VALUE / 1000",
      "required": true
    },
    {
      "target_field": "hardness_level",
      "source_field": "HARDNESS_CD",
      "mapping_type": "transform",
      "transform_name": "hardness_mapping",
      "required": true
    },
    {
      "target_field": "surface_level",
      "source_field": "SURF_GRD",
      "mapping_type": "transform",
      "transform_name": "surface_mapping",
      "required": true
    },
    {
      "target_field": "coiling_time",
      "source_field": "COIL_DATE",
      "mapping_type": "date",
      "source_format": "YYYY-MM-DD HH:mm:ss",
      "required": true
    },
    {
      "target_field": "due_date",
      "source_field": "DLV_DATE",
      "mapping_type": "date",
      "source_format": "YYYYMMDD",
      "required": false
    }
  ],
  "value_transforms": {
    "hardness_mapping": {
      "1": "软", "S": "软", "SOFT": "软",
      "2": "中", "M": "中", "MEDIUM": "中",
      "3": "硬", "H": "硬", "HARD": "硬",
      "_default": "中"
    },
    "surface_mapping": {
      "A": "FA", "1": "FA",
      "B": "FB", "2": "FB",
      "C": "FC", "3": "FC",
      "D": "FD", "4": "FD",
      "_default": "FC"
    }
  }
}
```

---

## 五、功能模块详细设计

### 5.1 模块总览

| 模块编号 | 模块名称       | 优先级 | 核心功能         |
| -------- | -------------- | ------ | ---------------- |
| M01      | 计划工作台     | P0     | 排程核心操作界面 |
| M02      | 策略模板配置   | P0     | 排程规则管理     |
| M03      | 风险概览仪表盘 | P0     | 方案质量分析     |
| M04      | 方案对比功能   | P1     | 多版本比较       |
| M05      | 历史追溯分析   | P1     | 版本演进追踪     |
| M06      | 数据映射配置   | P1     | 导入规则管理     |
| M07      | 设置中心       | P0     | 系统参数配置     |
| M08      | 日志管理       | P2     | 操作日志查询     |
| M09      | 数据管理       | P2     | 备份恢复与清理   |

### 5.2 M01 计划工作台

#### 5.2.1 功能描述

计划工作台是系统核心操作界面，提供材料排程的全流程管理，包括待排材料管理、自动排程、手工调整、排程确认等功能。待排材料池中会区分显示适温材料和待温材料，只有适温材料才可拖入排程队列。

#### 5.2.2 界面布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  计划工作台                                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 工具栏                                                              │ │
│ │ [新建方案] [导入材料] [自动排程] [保存] [撤销] [重做] [导出]        │ │
│ │ 当前方案: [日计划0212-v1 ▼] | 策略: [默认模板 ▼]                    │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────┬───────────────────────────────────────────────────┐ │
│ │                 │                                                   │ │
│ │   待排材料池    │              排程结果区                            │ │
│ │   (左侧面板)    │              (主操作区)                            │ │
│ │                 │                                                   │ │
│ │ ┌─────────────┐ │   ┌─────────────────────────────────────────┐    │ │
│ │ │ 筛选条件    │ │   │  [甘特图视图] / [列表视图]  切换         │    │ │
│ │ │ 钢种|宽度|状态│ │   ├─────────────────────────────────────────┤    │ │
│ │ ├─────────────┤ │   │  2026-02-12 白班 (08:00-20:00)          │    │ │
│ │ │ 适温材料    │ │   │  ████ A001 ████ A002 ████ A003 ...     │    │ │
│ │ │ (可排程) 🟢 │ │   │  [产能: 850t/1200t 71%]                  │    │ │
│ │ │ 156卷       │ │   ├─────────────────────────────────────────┤    │ │
│ │ ├─────────────┤ │   │  ═══ 换辊点 ═══ (累计800t)               │    │ │
│ │ │ 待温材料    │ │   ├─────────────────────────────────────────┤    │ │
│ │ │ (不可排) 🔵 │ │   │  2026-02-12 夜班 (20:00-08:00)          │    │ │
│ │ │ 28卷        │ │   │  ████ A015 ████ A016 ████ A017 ...     │    │ │
│ │ └─────────────┘ │   │  [产能: 620t/1200t 52%]                  │    │ │
│ │                 │   └─────────────────────────────────────────┘    │ │
│ │ [刷新适温状态]  │                                                   │ │
│ └─────────────────┴───────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 操作栏: [上移↑] [下移↓] [置顶] [锁定🔒] [解锁] [撤回] [删除]       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 状态栏: 已排:350卷/8,560t | 适温待排:156卷 | 待温:28卷 | 评分:85   │ │
│ │        风险: 🔴2 🟠5 🟡8 | 换辊:3次 | 撤销栈:12步                   │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.2.3 功能清单

**材料管理**

| 功能点         | 说明                               | 操作方式            |
| -------------- | ---------------------------------- | ------------------- |
| 导入材料       | 导入待排材料数据                   | 文件选择 + 映射预览 |
| 刷新适温状态   | 重新计算所有材料的适温状态         | 按钮触发            |
| 材料筛选       | 按钢种、宽度、厚度、适温状态等筛选 | 筛选面板            |
| 批量冻结/解冻  | 设置材料是否参与自动排程           | 多选 + 按钮         |
| 批量设置优先级 | 调整材料人工干预优先级             | 多选 + 弹窗         |

**排程操作**

| 功能点   | 说明                                   | 操作方式            |
| -------- | -------------------------------------- | ------------------- |
| 新建方案 | 创建新的排程方案                       | 弹窗表单            |
| 自动排程 | 基于策略模板自动生成排程（仅适温材料） | 按钮触发 + 进度显示 |
| 手工拖拽 | 拖拽调整材料顺序（仅适温材料可拖入）   | 拖放操作            |
| 批量添加 | 多选材料批量添加到排程                 | 多选 + 按钮         |
| 位置锁定 | 锁定材料位置不被自动排程调整           | 按钮/右键菜单       |
| 撤回材料 | 将已排材料撤回待排池                   | 按钮/右键菜单       |
| 插单     | 在指定位置插入材料（仅适温材料）       | 对话框选择          |

**方案管理**

| 功能点   | 说明                 | 操作方式        |
| -------- | -------------------- | --------------- |
| 保存方案 | 保存当前排程状态     | 按钮触发        |
| 另存为   | 保存为新方案         | 按钮 + 弹窗     |
| 切换方案 | 切换到其他方案       | 下拉选择        |
| 方案确认 | 确认方案锁定不再修改 | 按钮 + 二次确认 |
| 导出排程 | 导出排程结果Excel    | 按钮触发        |

**撤销重做**

| 功能点 | 说明                 | 操作方式      |
| ------ | -------------------- | ------------- |
| 撤销   | 撤销上一步操作       | Ctrl+Z / 按钮 |
| 重做   | 重做已撤销操作       | Ctrl+Y / 按钮 |
| 撤销栈 | 最大保留50步操作历史 | 自动管理      |

#### 5.2.4 待排材料池

**分组显示：**

```
待排材料池
├── 适温材料 (156卷) 🟢 ──────────────────
│   ├── [筛选条件...]
│   ├── ☑ HC2402-0012  Q235B  1500×2.5  24.5t  待温5天 ✓
│   ├── ☑ HC2402-0018  Q345B  1450×3.0  28.2t  待温7天 ✓
│   └── ...
│
└── 待温材料 (28卷) 🔵 ───────────────────
    ├── [筛选条件...]
    ├── ☐ HC2402-0045  Q235B  1520×2.0  22.1t  待温1天 (还需2天)
    ├── ☐ HC2402-0052  Q345B  1480×2.5  25.3t  待温2天 (还需1天)
    └── ...
```

**筛选条件：**

- 温度状态：全部/适温/待温
- 材料状态：全部/待排/冻结
- 钢种筛选：下拉多选
- 宽度范围：输入框
- 厚度范围：输入框
- 交期筛选：全部/已超期/3天内/7天内/7天后
- 关键字搜索：材料编号/合同号

**列表字段：**

- 勾选框
- 材料编号
- 钢种
- 宽度 × 厚度
- 重量
- 温度状态图标（🟢适温 / 🔵待温）
- 待温天数
- 交期状态图标
- 人工优先级

#### 5.2.5 排程队列区域

**材料信息行字段：**

| 字段       | 说明                         |
| ---------- | ---------------------------- |
| 序号       | 当前班次内序号               |
| 材料编号   | 点击可查看详情               |
| 钢种       | 钢种代码                     |
| 宽度       | mm                           |
| 厚度       | mm                           |
| 重量       | 吨                           |
| 待温天数   | 显示已待温天数               |
| 人工优先级 | 1-10，可内联编辑             |
| 状态标识   | 图标：🔒锁定 ⚡紧急 ⚠️风险 |
| 操作       | 更多操作下拉菜单             |

**风险标识规则：**

- 🔴 红色：硬约束违规（宽度跳跃超限等）
- 🟠 橙色：交期超期或即将超期
- 🟡 黄色：软约束违规（钢种频繁切换等）
- 🔒 锁定：位置已锁定

#### 5.2.6 快捷键

| 快捷键   | 功能                 |
| -------- | -------------------- |
| Ctrl + Z | 撤销                 |
| Ctrl + Y | 重做                 |
| Ctrl + S | 保存方案             |
| Ctrl + F | 搜索材料             |
| ↑ / ↓  | 移动选中材料位置     |
| Space    | 锁定/解锁选中材料    |
| Delete   | 撤回选中材料到待排池 |
| F5       | 刷新适温状态         |
| Ctrl + A | 全选                 |
| Esc      | 取消选择             |

### 5.3 M02 策略模板配置

#### 5.3.1 功能描述

管理排程策略模板，包括适温规则、排序规则、硬约束、软约束的配置，支持创建多套策略模板适应不同场景。

#### 5.3.2 界面布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  策略模板配置                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┬───────────────────────────────────────────────────┐ │
│ │ 模板列表        │ 模板详情                                          │ │
│ │                 │ ┌───────────────────────────────────────────────┐ │ │
│ │ [+ 新建模板]    │ │ 基本信息                                      │ │ │
│ │                 │ │ 模板名称: [________________]                  │ │ │
│ │ ● 标准排序策略  │ │ 描述说明: [________________]                  │ │ │
│ │   (默认) ✓     │ │ 设为默认: [√]                                 │ │ │
│ │                 │ └───────────────────────────────────────────────┘ │ │
│ │ ○ 交期优先策略  │ ┌───────────────────────────────────────────────┐ │ │
│ │                 │ │ 适温规则配置                                  │ │ │
│ │ ○ 宽度严格策略  │ │ ☑ 启用适温筛选                                │ │ │
│ │                 │ │                                               │ │ │
│ │                 │ │ 季节设置:                                     │ │ │
│ │                 │ │ ┌─────────┬──────────┬────────────┐           │ │ │
│ │                 │ │ │ 季节    │ 月份     │ 适温天数   │           │ │ │
│ │                 │ │ ├─────────┼──────────┼────────────┤           │ │ │
│ │                 │ │ │ 春季    │ 3,4,5    │ [3] 天     │           │ │ │
│ │                 │ │ │ 夏季    │ 6,7,8    │ [4] 天     │           │ │ │
│ │                 │ │ │ 秋季    │ 9,10,11  │ [4] 天     │           │ │ │
│ │                 │ │ │ 冬季    │ 12,1,2   │ [3] 天     │           │ │ │
│ │                 │ │ └─────────┴──────────┴────────────┘           │ │ │
│ │                 │ └───────────────────────────────────────────────┘ │ │
│ │                 │ ┌───────────────────────────────────────────────┐ │ │
│ │                 │ │ 排序规则 (拖拽调整顺序)                       │ │ │
│ │                 │ │ ≡ 1. 适温状态   [降序▼] 权重[100] [✓] 🔒    │ │ │
│ │                 │ │ ≡ 2. 宽度      [降序▼] 权重[95]  [✓]        │ │ │
│ │                 │ │ ≡ 3. 人工优先级 [降序▼] 权重[90]  [✓]        │ │ │
│ │                 │ │ ...                                           │ │ │
│ │                 │ └───────────────────────────────────────────────┘ │ │
│ │                 │ ┌───────────────────────────────────────────────┐ │ │
│ │                 │ │ 硬约束规则                                    │ │ │
│ │                 │ │ ☑ 适温材料筛选    只有适温材料可进入排程      │ │ │
│ │                 │ │ ☑ 宽度跳跃限制    最大值: [100] mm           │ │ │
│ │                 │ │ ☑ 换辊吨位阈值    最大值: [800] 吨           │ │ │
│ │                 │ │ ☑ 班次产能上限    最大值: [1200] 吨          │ │ │
│ │                 │ └───────────────────────────────────────────────┘ │ │
│ │                 │ ┌───────────────────────────────────────────────┐ │ │
│ │                 │ │ 软约束规则                                    │ │ │
│ │                 │ │ ☑ 钢种切换惩罚    惩罚分: [10]               │ │ │
│ │                 │ │ ☑ 厚度跳跃惩罚    阈值: [1.0]mm 惩罚: [5]    │ │ │
│ │                 │ └───────────────────────────────────────────────┘ │ │
│ │                 │                                                   │ │
│ │ [删除] [导出]   │                        [重置] [保存]              │ │
│ └─────────────────┴───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.3.3 模板管理功能

- 新建模板（可基于已有模板复制）
- 编辑模板
- 删除模板（系统默认模板不可删除）
- 导入/导出模板（JSON 格式）
- 设为默认模板

### 5.4 M03 风险概览仪表盘

#### 5.4.1 功能描述

多维度可视化展示排程方案的质量评估结果，包括产能分析、交期风险、换辊计划、适温材料统计、风险问题清单等。

#### 5.4.2 界面布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  风险概览                                          当前方案: xxx v3     │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ 综合评分                      │ │ 关键指标                          │ │
│ │        ┌─────┐                │ │                                   │ │
│ │        │ 85  │                │ │  排程总量: 350卷 / 8,560t         │ │
│ │        │/100 │                │ │  计划天数: 7天                    │ │
│ │        └─────┘                │ │  换辊次数: 8次                    │ │
│ │   排序: 92  交期: 78 ⚠️        │ │  平均日产: 1,223t                 │ │
│ │   效率: 88  质量: 85          │ │  风险项数: 15项                   │ │
│ └───────────────────────────────┘ └───────────────────────────────────┘ │
│ ┌───────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ 产能利用率趋势                │ │ 材料温度状态分布                  │ │
│ │  (柱状图/折线图)              │ │  (饼图)                           │ │
│ │                               │ │                                   │ │
│ │  ██████████░░ 87%  2/12       │ │     已排程  350卷 🟢 (适温)       │ │
│ │  ████████░░░░ 72%  2/13 ⚠️    │ │     适温待排 156卷 🟢              │ │
│ │  █████████████ 92%  2/14       │ │     待温中   28卷 🔵              │ │
│ └───────────────────────────────┘ └───────────────────────────────────┘ │
│ ┌───────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │ 交期风险分布                  │ │ 待温材料预测                      │ │
│ │  (饼图)                       │ │  (时间轴)                         │ │
│ │                               │ │                                   │ │
│ │     已超期 12卷 🔴            │ │  明天适温: 8卷                    │ │
│ │     3天内  28卷 🟠            │ │  后天适温: 12卷                   │ │
│ │     7天内  45卷 🟡            │ │  3天后适温: 8卷                   │ │
│ │     7天后  265卷 🟢           │ │                                   │ │
│ └───────────────────────────────┘ └───────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 风险问题清单                                               共15项   │ │
│ │─────────────────────────────────────────────────────────────────────│ │
│ │ 级别 │ 类型     │ 描述                       │ 建议操作             │ │
│ │──────┼──────────┼────────────────────────────┼──────────────────────│ │
│ │ 🔴   │ 交期超期 │ HC-0089等12卷已超交货期    │ [立即处理]           │ │
│ │ 🔴   │ 宽度跳跃 │ #35位置宽度差180mm>100mm   │ [调整顺序]           │ │
│ │ 🟠   │ 产能不足 │ 2/13产能利用率仅72%        │ [补充排产]           │ │
│ │ 🟡   │ 待温预警 │ 28卷材料处于待温状态       │ [查看详情]           │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.4.3 风险类型

| 风险类型     | 风险等级 | 触发条件                 | 处理建议              |
| ------------ | -------- | ------------------------ | --------------------- |
| 交期超期     | 🔴 高    | 材料已超过交货期         | 立即处理/提升优先级   |
| 宽度跳跃违规 | 🔴 高    | 相邻材料宽度差超限       | 调整顺序/插入过渡材料 |
| 班次产能超限 | 🔴 高    | 班次产量超过上限         | 移除材料/调整班次     |
| 待温材料入排 | 🔴 高    | 未达适温天数材料进入排程 | 移除或等待适温        |
| 产能不足     | 🟠 中    | 班次产能利用率<70%       | 补充排产/调整分配     |
| 临期预警     | 🟠 中    | 材料将在3天内到期        | 提升优先级            |
| 换辊位置不佳 | 🟠 中    | 换辊点打断连续性         | 调整换辊位置          |
| 待温预警     | 🟡 低    | 存在待温材料未能排程     | 查看待温材料列表      |
| 库龄超期     | 🟡 低    | 库龄超过预警天数         | 优先安排              |
| 钢种频繁切换 | 🟡 低    | 单班钢种切换>5次         | 优化分组              |

#### 5.4.4 待温材料预测

展示待温材料预计达到适温状态的时间：

| 预计适温日期 | 卷数 | 总重量 | 操作       |
| ------------ | ---- | ------ | ---------- |
| 明天 (2/13)  | 8卷  | 195t   | [查看详情] |
| 后天 (2/14)  | 12卷 | 287t   | [查看详情] |
| 2/15         | 8卷  | 192t   | [查看详情] |

### 5.5 M04 方案对比功能

#### 5.5.1 功能描述

支持选择2-3个排程方案进行并排对比，展示指标差异和材料位置变化。

#### 5.5.2 界面布局

```
┌──────────────────────────────────────────────────────────────────┐
│  方案对比                              [选择方案A] [选择方案B]    │
├──────────────────────────────────────────────────────────────────┤
│         方案A: 日计划0210-v1        vs      方案B: 日计划0210-v2 │
├───────────────┬─────────────────────┬────────────────────────────┤
│    指标       │       方案A         │          方案B             │
├───────────────┼─────────────────────┼────────────────────────────┤
│  材料数量     │        156          │           162   (+6)       │
│  总重量       │      1850 吨        │         1920 吨 (+70)      │
│  换辊次数     │         2           │            3    (+1)       │
│  宽度跳跃     │         3           │            1    (-2) ✓     │
│  产能利用率   │       92.5%         │          96.0%  (+3.5%)    │
│  高风险数     │         2           │            0    (-2) ✓     │
├───────────────┴─────────────────────┴────────────────────────────┤
│  综合评分            78.5                      85.2   ← 推荐     │
├──────────────────────────────────────────────────────────────────┤
│  材料差异分析                                                     │
│  仅A包含: A003, A015, A028                                       │
│  仅B包含: A003, A015, A028, A102, A103, A108, A112, A115, A118  │
│  顺序变化: A012(#5→#8), A025(#12→#3), ...                       │
└──────────────────────────────────────────────────────────────────┘
```

#### 5.5.3 对比维度

| 对比项   | 说明                       |
| -------- | -------------------------- |
| 基础指标 | 材料数量、总重量、换辊次数 |
| 效率指标 | 产能利用率、平均节奏时间   |
| 质量指标 | 宽度跳跃次数、适温比例     |
| 风险指标 | 高/中/低风险数量           |
| 材料差异 | 两方案的材料差集           |
| 顺序差异 | 相同材料的位置变化         |

### 5.6 M05 历史追溯分析

#### 5.6.1 功能描述

展示排程方案的版本演进历史，支持查看每次变更的详细内容，可回滚到历史版本。

#### 5.6.2 界面布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  历史追溯                                    方案: 2月第2周计划          │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 版本时间线                                                          │ │
│ │                                                                     │ │
│ │ 02-10 09:00      02-10 14:30     02-11 09:15     02-11 16:45       │ │
│ │     ●────────────────●───────────────●───────────────●  当前        │ │
│ │     │                │               │               │             │ │
│ │     v1              v2              v3              v4             │ │
│ │   初始方案        调整交期        优化换辊        确认版            │ │
│ │  [自动生成]      [人工调整]      [人工调整]      [已确认]           │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌───────────────────────────┐ ┌───────────────────────────────────────┐ │
│ │ 版本列表                  │ │ 变更详情                              │ │
│ │                           │ │                                       │ │
│ │ ● v4 02-11 16:45 [当前]   │ │ v3 → v4 变更记录                      │ │
│ │   已确认                  │ │ ─────────────────────────────────     │ │
│ │                           │ │ 操作时间: 02-11 16:45                 │ │
│ │ ○ v3 02-11 09:15          │ │ 变更类型: 人工调整                    │ │
│ │   人工调整                │ │                                       │ │
│ │                           │ │ 变更内容:                             │ │
│ │ ○ v2 02-10 14:30          │ │ • 锁定HC-0089, HC-0156位置            │ │
│ │   人工调整                │ │ • HC-0892: #35 → #38                  │ │
│ │                           │ │ • 新增5卷紧急插单                     │ │
│ │ ○ v1 02-10 09:00          │ │                                       │ │
│ │   自动生成                │ │ 指标变化:                             │ │
│ │                           │ │ • 综合评分: 85 → 87 (+2)              │ │
│ │                           │ │ • 交期达成率: 78% → 82%               │ │
│ │                           │ │                                       │ │
│ │                           │ │ [查看完整对比] [回滚到此版本]         │ │
│ └───────────────────────────┘ └───────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ 统计分析                                                            │ │
│ │ [日产量趋势图] [换辊次数分布] [风险类型分布] [产能利用率趋势]       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.6.3 追溯功能

| 功能     | 说明                     |
| -------- | ------------------------ |
| 版本列表 | 展示方案所有历史版本     |
| 版本对比 | 选择两个版本进行对比     |
| 变更详情 | 查看版本间的具体变更内容 |
| 操作日志 | 详细记录每次操作         |
| 版本回滚 | 恢复到指定历史版本       |
| 导出报告 | 导出版本变更报告         |
| 统计图表 | 产量趋势、换辊频率等     |

### 5.7 M06 数据映射配置

#### 5.7.1 功能描述

配置外部数据文件（Excel/CSV）与系统字段的映射关系，支持多种转换规则。

#### 5.7.2 映射类型

| 映射类型 | 说明               | 示例                 |
| -------- | ------------------ | -------------------- |
| 直接映射 | 直接使用源字段值   | COIL_ID → coil_id   |
| 计算映射 | 对源值进行计算转换 | VALUE / 1000         |
| 值域转换 | 使用字典进行值转换 | 1→软, 2→中, 3→硬  |
| 日期转换 | 日期格式转换       | YYYYMMDD → DateTime |
| 默认值   | 使用固定默认值     | 默认优先级=5         |
| 组合映射 | 多字段组合         | CONCAT(A, '-', B)    |

#### 5.7.3 测试导入功能

- 选择测试文件
- 显示映射预览（前20行）
- 显示适温状态计算结果预览
- 标识映射错误和警告
- 显示字段匹配情况

### 5.8 M07 设置中心

#### 5.8.1 功能描述

集中管理系统所有可配置参数，包括适温参数、产能参数、约束阈值、班次设置、预警阈值、检修计划等。

#### 5.8.2 配置参数清单

**适温参数：**

| 参数名称     | 默认值   | 单位 | 说明                       |
| ------------ | -------- | ---- | -------------------------- |
| 启用适温筛选 | 是       | -    | 是否启用适温材料筛选       |
| 春季月份     | 3,4,5    | -    | 春季包含的月份             |
| 夏季月份     | 6,7,8    | -    | 夏季包含的月份             |
| 秋季月份     | 9,10,11  | -    | 秋季包含的月份             |
| 冬季月份     | 12,1,2   | -    | 冬季包含的月份             |
| 春季适温天数 | 3        | 天   | 春季适温阈值               |
| 夏季适温天数 | 4        | 天   | 夏季适温阈值               |
| 秋季适温天数 | 4        | 天   | 秋季适温阈值               |
| 冬季适温天数 | 3        | 天   | 冬季适温阈值               |
| 产出时间取值 | 取较早者 | -    | 轧制时间/卷取时间/取较早者 |

**产能参数：**

| 参数名称     | 默认值 | 单位    | 说明             |
| ------------ | ------ | ------- | ---------------- |
| 单班产能上限 | 1200   | 吨      | 每班次最大排产量 |
| 日产能目标   | 2400   | 吨      | 两班制日目标产量 |
| 平均轧制节奏 | 3.5    | 分钟/卷 | 单卷平均处理时间 |

**班次设置：**

| 参数名称     | 默认值    | 说明               |
| ------------ | --------- | ------------------ |
| 白班开始时间 | 08:00     | 白班起始时间       |
| 白班结束时间 | 20:00     | 白班结束时间       |
| 夜班开始时间 | 20:00     | 夜班起始时间       |
| 夜班结束时间 | 08:00(+1) | 夜班结束时间(次日) |

**换辊参数：**

| 参数名称     | 默认值 | 单位 | 说明                       |
| ------------ | ------ | ---- | -------------------------- |
| 换辊吨位阈值 | 800    | 吨   | 累计轧制吨位达到后换辊     |
| 换辊作业时长 | 30     | 分钟 | 换辊占用时间               |
| 整卷收尾     | 是     | -    | 达到阈值后完成当前卷再换辊 |

**约束阈值：**

| 参数名称     | 默认值 | 单位 | 说明                         |
| ------------ | ------ | ---- | ---------------------------- |
| 最大宽度跳跃 | 100    | mm   | 相邻材料宽度差上限           |
| 最大厚度跳跃 | 1.0    | mm   | 相邻材料厚度差上限（软约束） |

**预警设置：**

| 参数名称       | 默认值 | 说明             |
| -------------- | ------ | ---------------- |
| 产能利用率黄灯 | 85%    | 低于此值黄色预警 |
| 产能利用率红灯 | 70%    | 低于此值红色预警 |
| 交期预警天数   | 3      | 临期预警触发天数 |
| 库龄预警天数   | 7      | 库龄预警触发天数 |
| 库龄严重预警   | 14     | 库龄严重预警天数 |

**撤销设置：**

| 参数名称     | 默认值 | 说明           |
| ------------ | ------ | -------------- |
| 最大撤销步数 | 50     | 撤销栈最大容量 |

### 5.9 M08 日志管理

#### 5.9.1 日志类型

| 日志类型 | 记录内容                      |
| -------- | ----------------------------- |
| 导入日志 | 材料导入时间、数量、成功/失败 |
| 排程日志 | 自动排程执行、手工调整操作    |
| 方案日志 | 方案创建、保存、删除          |
| 配置日志 | 策略模板、系统配置变更        |
| 系统日志 | 应用启动、错误异常            |

#### 5.9.2 功能清单

- 日志查询（按时间范围、类型、关键词）
- 日志导出（Excel/CSV）
- 日志清理（按时间范围删除）
- 日志详情查看

### 5.10 M09 数据管理

#### 5.10.1 备份恢复

| 功能     | 说明                    |
| -------- | ----------------------- |
| 手动备份 | 立即创建数据库备份      |
| 自动备份 | 可配置周期（每日/每周） |
| 备份管理 | 查看、删除备份文件      |
| 数据恢复 | 从备份文件恢复数据      |
| 备份路径 | 配置备份文件存储位置    |

#### 5.10.2 数据清理

| 清理类型     | 说明                      |
| ------------ | ------------------------- |
| 历史方案清理 | 删除指定时间前的历史方案  |
| 材料数据清理 | 删除已完成/过期的材料记录 |
| 日志清理     | 删除指定时间前的操作日志  |
| 撤销栈清理   | 清空撤销/重做历史         |

---

## 六、接口设计

### 6.1 Tauri Commands 概览

#### 6.1.1 材料管理

```rust
#[tauri::command]
async fn import_materials(file_path: String, mapping_id: i32) -> Result<ImportResult, AppError>;

#[tauri::command]
async fn get_materials(filter: MaterialFilter, pagination: Pagination) -> Result<PagedResult<Material>, AppError>;

#[tauri::command]
async fn update_material_status(ids: Vec<i32>, status: String) -> Result<i32, AppError>;

#[tauri::command]
async fn update_material_priority(ids: Vec<i32>, priority: i32) -> Result<i32, AppError>;

#[tauri::command]
async fn refresh_temper_status() -> Result<RefreshResult, AppError>;

#[tauri::command]
async fn delete_materials(ids: Vec<i32>) -> Result<i32, AppError>;
```

#### 6.1.2 排程操作

```rust
#[tauri::command]
async fn create_plan(input: CreatePlanInput) -> Result<SchedulePlan, AppError>;

#[tauri::command]
async fn get_plan(id: i32) -> Result<PlanDetail, AppError>;

#[tauri::command]
async fn get_plans(filter: PlanFilter) -> Result<Vec<SchedulePlan>, AppError>;

#[tauri::command]
async fn save_plan(id: i32) -> Result<SchedulePlan, AppError>;

#[tauri::command]
async fn delete_plan(id: i32) -> Result<(), AppError>;

#[tauri::command]
async fn auto_schedule(plan_id: i32, strategy_id: i32) -> Result<ScheduleResult, AppError>;

#[tauri::command]
async fn add_to_schedule(plan_id: i32, material_ids: Vec<i32>, position: Option<i32>) -> Result<Vec<ScheduleItem>, AppError>;

#[tauri::command]
async fn remove_from_schedule(plan_id: i32, item_ids: Vec<i32>) -> Result<i32, AppError>;

#[tauri::command]
async fn move_schedule_item(plan_id: i32, item_id: i32, new_position: i32) -> Result<(), AppError>;

#[tauri::command]
async fn lock_schedule_items(plan_id: i32, item_ids: Vec<i32>, locked: bool) -> Result<i32, AppError>;

#[tauri::command]
async fn get_schedule_items(plan_id: i32) -> Result<Vec<ScheduleItem>, AppError>;
```

#### 6.1.3 撤销重做

```rust
#[tauri::command]
async fn undo(plan_id: i32) -> Result<UndoResult, AppError>;

#[tauri::command]
async fn redo(plan_id: i32) -> Result<UndoResult, AppError>;

#[tauri::command]
async fn get_undo_stack(plan_id: i32) -> Result<UndoStackInfo, AppError>;

#[tauri::command]
async fn clear_undo_stack(plan_id: i32) -> Result<(), AppError>;
```

#### 6.1.4 策略配置

```rust
#[tauri::command]
async fn get_strategy_templates() -> Result<Vec<StrategyTemplate>, AppError>;

#[tauri::command]
async fn create_strategy_template(input: CreateStrategyInput) -> Result<StrategyTemplate, AppError>;

#[tauri::command]
async fn update_strategy_template(id: i32, input: UpdateStrategyInput) -> Result<StrategyTemplate, AppError>;

#[tauri::command]
async fn delete_strategy_template(id: i32) -> Result<(), AppError>;

#[tauri::command]
async fn set_default_strategy(id: i32) -> Result<(), AppError>;

#[tauri::command]
async fn export_strategy_template(id: i32) -> Result<String, AppError>;

#[tauri::command]
async fn import_strategy_template(json: String) -> Result<StrategyTemplate, AppError>;
```

#### 6.1.5 风险评估

```rust
#[tauri::command]
async fn evaluate_risks(plan_id: i32) -> Result<Vec<Risk>, AppError>;

#[tauri::command]
async fn apply_risk_suggestion(plan_id: i32, risk_id: String) -> Result<(), AppError>;

#[tauri::command]
async fn get_waiting_forecast() -> Result<Vec<WaitingForecast>, AppError>;
```

#### 6.1.6 方案对比

```rust
#[tauri::command]
async fn compare_plans(plan_id_a: i32, plan_id_b: i32) -> Result<CompareResult, AppError>;
```

#### 6.1.7 导出功能

```rust
#[tauri::command]
async fn export_plan(plan_id: i32, template_id: i32, file_path: String) -> Result<(), AppError>;

#[tauri::command]
async fn get_export_templates() -> Result<Vec<ExportTemplate>, AppError>;

#[tauri::command]
async fn create_export_template(input: CreateExportTemplateInput) -> Result<ExportTemplate, AppError>;

#[tauri::command]
async fn update_export_template(id: i32, input: UpdateExportTemplateInput) -> Result<ExportTemplate, AppError>;

#[tauri::command]
async fn delete_export_template(id: i32) -> Result<(), AppError>;
```

#### 6.1.8 系统配置

```rust
#[tauri::command]
async fn get_system_config() -> Result<HashMap<String, ConfigValue>, AppError>;

#[tauri::command]
async fn update_system_config(key: String, value: ConfigValue) -> Result<(), AppError>;

#[tauri::command]
async fn get_shift_config() -> Result<Vec<ShiftConfig>, AppError>;

#[tauri::command]
async fn update_shift_config(shifts: Vec<ShiftConfig>) -> Result<(), AppError>;

#[tauri::command]
async fn get_maintenance_plans() -> Result<Vec<MaintenancePlan>, AppError>;

#[tauri::command]
async fn create_maintenance_plan(input: CreateMaintenanceInput) -> Result<MaintenancePlan, AppError>;

#[tauri::command]
async fn update_maintenance_plan(id: i32, input: UpdateMaintenanceInput) -> Result<MaintenancePlan, AppError>;

#[tauri::command]
async fn delete_maintenance_plan(id: i32) -> Result<(), AppError>;
```

#### 6.1.9 日志管理

```rust
#[tauri::command]
async fn get_operation_logs(filter: LogFilter, pagination: Pagination) -> Result<PagedResult<OperationLog>, AppError>;

#[tauri::command]
async fn export_logs(filter: LogFilter, file_path: String) -> Result<(), AppError>;

#[tauri::command]
async fn clear_logs(before_date: DateTime) -> Result<i32, AppError>;
```

#### 6.1.10 数据管理

```rust
#[tauri::command]
async fn backup_database(file_path: String) -> Result<BackupInfo, AppError>;

#[tauri::command]
async fn restore_database(file_path: String) -> Result<(), AppError>;

#[tauri::command]
async fn get_backups() -> Result<Vec<BackupInfo>, AppError>;

#[tauri::command]
async fn delete_backup(file_path: String) -> Result<(), AppError>;

#[tauri::command]
async fn clean_history_plans(before_date: DateTime) -> Result<i32, AppError>;

#[tauri::command]
async fn clean_materials(before_date: DateTime) -> Result<i32, AppError>;
```

### 6.2 错误码规范

| 错误码范围 | 模块     | 示例                                         |
| ---------- | -------- | -------------------------------------------- |
| E1xxx      | 导入模块 | E1001: 文件格式错误, E1002: 字段映射缺失     |
| E2xxx      | 排程模块 | E2001: 方案不存在, E2002: 材料未适温         |
| E3xxx      | 配置模块 | E3001: 模板名称重复, E3002: 系统模板不可删除 |
| E4xxx      | 系统模块 | E4001: 数据库连接失败, E4002: 文件写入失败   |
| E5xxx      | 撤销重做 | E5001: 无可撤销操作, E5002: 无可重做操作     |

---

## 七、排程引擎设计

### 7.1 排程算法流程

```
┌─────────────┐
│  开始排程   │
└──────┬──────┘
       ▼
┌─────────────────────────────────────────────────────────────┐
│  1. 数据准备                                                 │
│  - 加载待排材料列表                                          │
│  - 加载策略模板配置（含适温规则）                            │
│  - 加载系统参数配置                                          │
│  - 加载检修计划                                              │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 适温状态计算                                             │
│  - 获取当前日期和季节                                        │
│  - 计算每个材料的待温天数                                    │
│  - 判定适温/待温状态                                         │
│  - 筛选出适温材料进入排程池                                  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 预处理                                                   │
│  - 移除冻结状态材料                                          │
│  - 识别锁定材料（保持位置不变）                              │
│  - 识别超期材料（强制优先）                                  │
│  - 计算派生字段（库龄等）                                    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 多因子排序                                               │
│  - 按策略模板的排序规则计算综合排序分值                      │
│  - 排序优先级: 适温>宽度>人工优先级>硬度>厚度>...            │
│  - 生成初始排序序列                                          │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  5. 硬约束校验与调整                                         │
│  - 检查宽度跳跃是否超限                                      │
│  - 如超限，尝试微调顺序或标记风险                            │
│  - 检查班次产能是否超限                                      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  6. 换辊点计算                                               │
│  - 累计轧制吨位                                              │
│  - 达到阈值时，当前卷完成后插入换辊点                        │
│  - 优先在宽度跳跃处换辊                                      │
│  - 考虑检修时间窗口                                          │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  7. 班次分配                                                 │
│  - 按班次产能上限分配材料到各班次                            │
│  - 计算各材料的计划开始/结束时间                             │
│  - 避开检修时间窗口                                          │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  8. 方案评估                                                 │
│  - 计算各维度评分                                            │
│  - 识别风险问题                                              │
│  - 生成优化建议                                              │
│  - 统计待温材料预计适温时间                                  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────┐
│  排程完成   │
└─────────────┘
```

### 7.2 适温状态计算算法

```rust
// Rust 实现
use chrono::{DateTime, Utc, Datelike, Duration};

#[derive(Debug, Clone)]
pub struct TemperRules {
    pub seasons: HashMap<String, SeasonRule>,
    pub time_field_rule: TimeFieldRule,
}

#[derive(Debug, Clone)]
pub struct SeasonRule {
    pub months: Vec<u32>,
    pub min_days: i64,
}

#[derive(Debug, Clone)]
pub enum TimeFieldRule {
    RollingOnly,
    CoilingOnly,
    Earliest,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TempStatus {
    Ready,    // 适温
    Waiting,  // 待温
}

pub fn calculate_temp_status(
    coiling_time: DateTime<Utc>,
    rules: &TemperRules,
) -> (TempStatus, i64) {
    let now = Utc::now();

    // 1. 计算待温天数（基于卷取产出时间）
    let wait_days = (now - coiling_time).num_days();

    // 2. 判断当前季节
    let current_month = now.month();
    let mut threshold_days = 3i64; // 默认值

    for (_, season_rule) in &rules.seasons {
        if season_rule.months.contains(&current_month) {
            threshold_days = season_rule.min_days;
            break;
        }
    }

    // 3. 判定适温状态
    let status = if wait_days >= threshold_days {
        TempStatus::Ready
    } else {
        TempStatus::Waiting
    };

    (status, wait_days)
}

pub fn filter_ready_materials(
    materials: &[Material],
    rules: &TemperRules,
) -> (Vec<Material>, Vec<Material>) {
    let mut ready_materials = Vec::new();
    let mut waiting_materials = Vec::new();

    for material in materials {
        let (status, wait_days) = calculate_temp_status(
            material.coiling_time,
            rules,
        );

        let mut m = material.clone();
        m.temp_status = match status {
            TempStatus::Ready => "ready".to_string(),
            TempStatus::Waiting => "waiting".to_string(),
        };
        m.temp_wait_days = wait_days as i32;
        m.is_tempered = status == TempStatus::Ready;
      
        match status {
            TempStatus::Ready => ready_materials.push(m),
            TempStatus::Waiting => waiting_materials.push(m),
        }
    }
  
    (ready_materials, waiting_materials)
}
```

### 7.3 多因子排序算法

```rust
pub fn calculate_sort_score(material: &Material, rules: &SortRules) -> f64 {
    let mut total_score = 0.0;
  
    for rule in rules.priorities.iter().filter(|r| r.enabled) {
        let field_value = get_field_value(material, &rule.field);
        let normalized_value = normalize_value(field_value, &rule);
      
        let direction_factor = match rule.order.as_str() {
            "asc" => normalized_value,
            "desc" => 1.0 - normalized_value,
            _ => normalized_value,
        };
      
        total_score += direction_factor * rule.weight as f64;
    }
  
    total_score
}

pub fn sort_materials(materials: &mut Vec<Material>, rules: &SortRules) {
    // 分离锁定材料
    let (locked, mut unlocked): (Vec<_>, Vec<_>) = 
        materials.drain(..).partition(|m| m.is_locked.unwrap_or(false));
  
    // 对非锁定材料排序
    unlocked.sort_by(|a, b| {
        let score_a = calculate_sort_score(a, rules);
        let score_b = calculate_sort_score(b, rules);
        score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
    });
  
    // 将锁定材料插回原位置
    *materials = merge_locked_materials(unlocked, locked);
}
```

### 7.4 换辊点计算逻辑

```rust
pub fn calculate_roll_changes(
    items: &mut Vec<ScheduleItem>,
    materials: &HashMap<i32, Material>,
    config: &RollChangeConfig,
) {
    let mut cumulative_weight = 0.0;
    let mut last_width: Option<f64> = None;
  
    for item in items.iter_mut() {
        let material = materials.get(&item.material_id).unwrap();
        cumulative_weight += material.weight;
        item.cumulative_weight = cumulative_weight;
      
        // 检查是否达到换辊阈值
        if cumulative_weight >= config.tonnage_threshold {
            // 优先在宽度跳跃处换辊
            let is_good_position = match last_width {
                Some(width) => (material.width - width).abs() >= config.width_jump_threshold * 0.5,
                None => true,
            };
          
            // 整卷收尾：当前卷完成后换辊
            item.is_roll_change = is_good_position || cumulative_weight >= config.tonnage_threshold * 1.1;
          
            if item.is_roll_change {
                cumulative_weight = 0.0;
            }
        }
      
        last_width = Some(material.width);
    }
}
```

### 7.5 风险评估算法

```rust
pub fn evaluate_risks(
    items: &[ScheduleItem],
    materials: &HashMap<i32, Material>,
    waiting_materials: &[Material],
    constraints: &Constraints,
) -> Vec<Risk> {
    let mut risks = Vec::new();
  
    // 1. 检查交期风险
    let today = Utc::now().date_naive();
    for item in items {
        if let Some(material) = materials.get(&item.material_id) {
            if let Some(due_date) = material.due_date {
                if due_date.date_naive() < today {
                    risks.push(Risk {
                        id: format!("overdue_{}", item.id),
                        risk_type: "overdue".to_string(),
                        level: RiskLevel::High,
                        description: format!("材料 {} 已超交货期", material.coil_id),
                        target_item_id: Some(item.id),
                        suggestion: "立即处理/提升优先级".to_string(),
                    });
                }
            }
        }
    }
  
    // 2. 检查宽度跳跃
    for i in 1..items.len() {
        let prev_item = &items[i - 1];
        let curr_item = &items[i];
      
        // 跨班次不检查
        if prev_item.shift_no != curr_item.shift_no {
            continue;
        }
      
        if let (Some(prev_mat), Some(curr_mat)) = (
            materials.get(&prev_item.material_id),
            materials.get(&curr_item.material_id),
        ) {
            let width_diff = (curr_mat.width - prev_mat.width).abs();
            if width_diff > constraints.width_jump_threshold {
                risks.push(Risk {
                    id: format!("width_jump_{}_{}", prev_item.id, curr_item.id),
                    risk_type: "width_jump".to_string(),
                    level: RiskLevel::High,
                    description: format!(
                        "材料 {} 到 {} 宽度跳跃 {:.0}mm 超过限制 {:.0}mm",
                        prev_mat.coil_id, curr_mat.coil_id, width_diff, constraints.width_jump_threshold
                    ),
                    target_item_id: Some(curr_item.id),
                    suggestion: "调整顺序或插入过渡材料".to_string(),
                });
            }
        }
    }
  
    // 3. 检查班次产能
    let mut shift_weights: HashMap<i32, f64> = HashMap::new();
    for item in items {
        if let Some(mat) = materials.get(&item.material_id) {
            *shift_weights.entry(item.shift_no).or_insert(0.0) += mat.weight;
        }
    }
  
    for (shift_no, weight) in shift_weights {
        if weight > constraints.shift_capacity {
            risks.push(Risk {
                id: format!("capacity_shift_{}", shift_no),
                risk_type: "capacity_overflow".to_string(),
                level: RiskLevel::High,
                description: format!("班次 {} 产量 {:.1}t 超过上限 {:.1}t", shift_no, weight, constraints.shift_capacity),
                target_item_id: None,
                suggestion: "移除部分材料或调整到其他班次".to_string(),
            });
        } else if weight < constraints.shift_capacity * 0.7 {
            risks.push(Risk {
                id: format!("capacity_low_shift_{}", shift_no),
                risk_type: "capacity_low".to_string(),
                level: RiskLevel::Medium,
                description: format!("班次 {} 产能利用率仅 {:.1}%", shift_no, weight / constraints.shift_capacity * 100.0),
                target_item_id: None,
                suggestion: "补充排产/调整分配".to_string(),
            });
        }
    }
  
    // 4. 检查待温材料
    if !waiting_materials.is_empty() {
        risks.push(Risk {
            id: "waiting_materials".to_string(),
            risk_type: "waiting_warning".to_string(),
            level: RiskLevel::Low,
            description: format!("{} 卷材料处于待温状态，无法排程", waiting_materials.len()),
            target_item_id: None,
            suggestion: "查看待温材料列表".to_string(),
        });
    }
  
    risks
}
```

---

## 八、界面设计规范

### 8.1 设计原则

- **简洁现代**：采用扁平化设计，减少视觉干扰
- **高效操作**：核心操作一步直达，支持快捷键
- **信息层次**：重要信息突出显示，次要信息适度弱化
- **一致性**：全局统一的设计语言和交互

### 8.2 配色方案

| 用途     | 色值    | 说明                     |
| -------- | ------- | ------------------------ |
| 主色调   | #1890FF | Ant Design 默认蓝        |
| 成功色   | #52C41A | 成功、完成状态、适温状态 |
| 警告色   | #FAAD14 | 警告、提醒               |
| 错误色   | #FF4D4F | 错误、高风险             |
| 待温色   | #1677FF | 待温状态标识             |
| 中性色   | #8C8C8C | 次要文字                 |
| 背景色   | #F5F5F5 | 页面背景                 |
| 卡片背景 | #FFFFFF | 卡片、面板背景           |

### 8.3 状态图标

| 状态   | 图标 | 颜色    | 说明               |
| ------ | ---- | ------- | ------------------ |
| 高风险 | 🔴   | #FF4D4F | 红色圆点           |
| 中风险 | 🟠   | #FAAD14 | 橙色圆点           |
| 低风险 | 🟡   | #FADB14 | 黄色圆点           |
| 正常   | 🟢   | #52C41A | 绿色圆点           |
| 适温   | 🟢   | #52C41A | 绿色圆点，可排程   |
| 待温   | 🔵   | #1677FF | 蓝色圆点，不可排程 |
| 锁定   | 🔒   | #8C8C8C | 锁图标             |
| 紧急   | ⚡   | #FF4D4F | 闪电图标           |
| 警告   | ⚠️ | #FAAD14 | 警告图标           |

### 8.4 布局规范

- 页面内边距：24px
- 卡片间距：16px
- 组件间距：8px / 16px
- 表格行高：54px
- 按钮最小宽度：80px
- 输入框高度：32px

### 8.5 交互规范

| 交互类型     | 规范                                 |
| ------------ | ------------------------------------ |
| 表单提交     | 显示加载状态，成功后显示提示         |
| 删除操作     | 二次确认弹窗                         |
| 批量操作     | 显示操作数量确认                     |
| 拖拽排序     | 显示拖拽预览和目标位置指示           |
| 待温材料拖拽 | 显示禁止图标和提示"待温材料不可排程" |
| 数据加载     | 显示骨架屏或加载指示器               |
| 错误处理     | 显示错误提示，提供重试选项           |

---

## 九、前端组件设计

### 9.1 核心组件架构

```
src/components/
├── Layout/                       # 布局组件
│   ├── AppLayout.tsx            # 主布局
│   ├── Sidebar.tsx              # 侧边导航
│   └── Header.tsx               # 顶部栏
│
├── MaterialTable/                # 材料表格组件
│   ├── index.tsx                # 主组件（虚拟滚动）
│   ├── MaterialRow.tsx          # 行组件
│   ├── FilterPanel.tsx          # 筛选面板
│   ├── BatchActions.tsx         # 批量操作栏
│   └── columns.tsx              # 列定义
│
├── ScheduleBoard/                # 排程看板组件
│   ├── index.tsx                # 主组件
│   ├── GanttView.tsx            # 甘特图视图
│   ├── ListView.tsx             # 列表视图
│   ├── ShiftSection.tsx         # 班次区块
│   ├── ScheduleCard.tsx         # 材料卡片
│   └── RollChangeMarker.tsx     # 换辊标记
│
├── DragDrop/                     # 拖拽组件
│   ├── DragContainer.tsx        # 拖拽容器
│   ├── DragItem.tsx             # 可拖拽项
│   ├── DropZone.tsx             # 放置区域
│   └── DragOverlay.tsx          # 拖拽预览
│
├── Charts/                       # 图表组件
│   ├── ProductionTrend.tsx      # 产量趋势图
│   ├── RiskDistribution.tsx     # 风险分布图
│   ├── CapacityGauge.tsx        # 产能仪表盘
│   ├── TempStatusPie.tsx        # 温度状态饼图
│   ├── WaitingForecast.tsx      # 待温预测时间轴
│   └── CompareRadar.tsx         # 对比雷达图
│
├── Risk/                         # 风险组件
│   ├── RiskBadge.tsx            # 风险徽章
│   ├── RiskCard.tsx             # 风险卡片
│   ├── RiskList.tsx             # 风险列表
│   └── RiskSuggestion.tsx       # 处理建议
│
├── TempStatus/                   # 温度状态组件
│   ├── TempStatusBadge.tsx      # 温度状态徽章
│   ├── TempStatusTag.tsx        # 温度状态标签
│   └── WaitDaysIndicator.tsx    # 待温天数指示器
│
├── Form/                         # 表单组件
│   ├── StrategyForm.tsx         # 策略配置表单
│   ├── MappingForm.tsx          # 映射配置表单
│   ├── ShiftForm.tsx            # 班次配置表单
│   ├── TempRuleForm.tsx         # 适温规则表单
│   └── ExportForm.tsx           # 导出配置表单
│
└── Common/                       # 通用组件
    ├── SearchInput.tsx          # 搜索框
    ├── StatusTag.tsx            # 状态标签
    ├── ConfirmModal.tsx         # 确认弹窗
    ├── LoadingOverlay.tsx       # 加载遮罩
    ├── EmptyState.tsx           # 空状态
    └── KeyboardShortcuts.tsx    # 快捷键提示
```

### 9.2 虚拟滚动材料表格

```typescript
// src/components/MaterialTable/index.tsx
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface MaterialTableProps {
  materials: Material[];
  selectedIds: Set<number>;
  onSelect: (ids: number[]) => void;
  onDragStart: (material: Material) => void;
}

export const MaterialTable: React.FC<MaterialTableProps> = ({
  materials,
  selectedIds,
  onSelect,
  onDragStart,
}) => {
  const ROW_HEIGHT = 48;
  const OVERSCAN_COUNT = 10;

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const material = materials[index];
    const isSelected = selectedIds.has(material.id);
    const canDrag = material.tempStatus === 'ready';

    return (
      <div
        style={style}
        className={`material-row ${isSelected ? 'selected' : ''} ${!canDrag ? 'disabled' : ''}`}
        draggable={canDrag}
        onDragStart={() => canDrag && onDragStart(material)}
        onClick={(e) => handleRowClick(e, material.id)}
      >
        <MaterialRow material={material} isSelected={isSelected} />
      </div>
    );
  };

  return (
    <div className="material-table">
      <div className="table-header">
        <TableHeader columns={columns} />
      </div>
      <div className="table-body">
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              width={width}
              itemCount={materials.length}
              itemSize={ROW_HEIGHT}
              overscanCount={OVERSCAN_COUNT}
            >
              {Row}
            </List>
          )}
        </AutoSizer>
      </div>
    </div>
  );
};
```

### 9.3 拖拽排序实现

```typescript
// src/components/DragDrop/DragContainer.tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export const DragContainer: React.FC<DragContainerProps> = ({
  items,
  onReorder,
  onAddFromPool,
}) => {
  const [activeItem, setActiveItem] = useState<ScheduleItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = items.find((i) => i.id === active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      if (oldIndex !== -1) {
        onReorder(oldIndex, newIndex);
      } else {
        onAddFromPool(active.id as number, newIndex);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableItem key={item.id} item={item} />
        ))}
      </SortableContext>

      <DragOverlay>
        {activeItem ? <ScheduleCard item={activeItem} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
};
```

### 9.4 自定义 Hooks

#### 9.4.1 撤销重做 Hook

```typescript
// src/hooks/useUndo.ts
export const useUndo = ({ planId, enabled = true }: UseUndoOptions): UseUndoResult => {
  const { undoStack, setUndoStack, refreshSchedule } = useScheduleStore();

  const loadUndoStack = useCallback(async () => {
    if (!planId) return;
    const stack = await getUndoStack(planId);
    setUndoStack(stack);
  }, [planId, setUndoStack]);

  useEffect(() => {
    loadUndoStack();
  }, [loadUndoStack]);

  const undoAction = useCallback(async () => {
    if (!planId || !undoStack.canUndo) return;
    try {
      await undo(planId);
      await loadUndoStack();
      await refreshSchedule();
    } catch (error) {
      console.error('Undo failed:', error);
    }
  }, [planId, undoStack.canUndo, loadUndoStack, refreshSchedule]);

  const redoAction = useCallback(async () => {
    if (!planId || !undoStack.canRedo) return;
    try {
      await redo(planId);
      await loadUndoStack();
      await refreshSchedule();
    } catch (error) {
      console.error('Redo failed:', error);
    }
  }, [planId, undoStack.canRedo, loadUndoStack, refreshSchedule]);

  // 快捷键绑定
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undoAction();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redoAction();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, undoAction, redoAction]);

  return {
    canUndo: undoStack.canUndo,
    canRedo: undoStack.canRedo,
    undoAction,
    redoAction,
    undoCount: undoStack.undoCount,
    redoCount: undoStack.redoCount,
  };
};
```

#### 9.4.2 快捷键 Hook

```typescript
// src/hooks/useShortcuts.ts
type ShortcutHandler = (e: KeyboardEvent) => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
}

export const useShortcuts = (shortcuts: ShortcutConfig[], enabled = true) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault();
          shortcut.handler(e);
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return shortcuts.map((s) => ({
    key: formatShortcutKey(s),
    description: s.description,
  }));
};
```

#### 9.4.3 适温状态 Hook

```typescript
// src/hooks/useTempStatus.ts
export const useTempStatus = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { setMaterials } = useMaterialStore();

  const refreshTempStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshTemperStatus();
      message.success(`已更新 ${result.updatedCount} 个材料的适温状态`);
      // 重新加载材料列表
      const materials = await getMaterials({});
      setMaterials(materials);
    } catch (error: any) {
      message.error(error.message || '刷新失败');
    } finally {
      setIsRefreshing(false);
    }
  }, [setMaterials]);

  const getWaitingForecast = useCallback(async () => {
    try {
      return await api.getWaitingForecast();
    } catch (error) {
      console.error('获取待温预测失败:', error);
      return [];
    }
  }, []);

  return {
    isRefreshing,
    refreshTempStatus,
    getWaitingForecast,
  };
};
```

### 9.5 TypeScript 类型定义

```typescript
// src/types/material.ts
export interface Material {
  id: number;
  coilId: string;
  contractNo?: string;
  customerName?: string;
  steelGrade: string;
  thickness: number;
  width: number;
  weight: number;
  hardnessLevel?: string;
  surfaceLevel?: string;
  roughnessReq?: string;
  elongationReq?: number;
  productType?: string;
  contractAttr?: string;
  rollingTime: string;
  coilingTime?: string;
  produceTime: string;
  tempStatus: 'ready' | 'waiting';
  tempWaitDays: number;
  isTempered: boolean;
  temperedAt?: string;
  entryTime: string;
  storageDays: number;
  storageLoc?: string;
  dueDate?: string;
  status: 'pending' | 'frozen';
  priority: number;
  priorityReason?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

// src/types/schedule.ts
export interface SchedulePlan {
  id: number;
  planNo: string;
  name: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate: string;
  endDate: string;
  strategyId?: number;
  status: 'draft' | 'saved' | 'confirmed' | 'archived';
  version: number;
  parentId?: number;
  totalCount: number;
  totalWeight: number;
  rollChangeCount: number;
  scoreOverall?: number;
  scoreSequence?: number;
  scoreDelivery?: number;
  scoreEfficiency?: number;
  riskCountHigh: number;
  riskCountMedium: number;
  riskCountLow: number;
  riskSummary?: RiskSummary;
  createdAt: string;
  updatedAt: string;
  remarks?: string;
}

export interface ScheduleItem {
  id: number;
  planId: number;
  materialId: number;
  material?: Material;
  sequence: number;
  shiftDate: string;
  shiftNo: number;
  shiftType: 'day' | 'night';
  plannedStart?: string;
  plannedEnd?: string;
  cumulativeWeight: number;
  isRollChange: boolean;
  isLocked: boolean;
  lockReason?: string;
  riskFlags?: RiskFlag[];
  createdAt: string;
  updatedAt: string;
}

// src/types/risk.ts
export interface Risk {
  id: string;
  type: 'overdue' | 'width_jump' | 'capacity_overflow' | 'capacity_low' | 'untempered' | 'roll_position' | 'storage_warning' | 'waiting_warning';
  level: 'high' | 'medium' | 'low';
  description: string;
  targetItemId?: number;
  suggestion: string;
}

// src/types/temp.ts
export interface TemperRules {
  enabled: boolean;
  seasons: {
    spring: SeasonRule;
    summer: SeasonRule;
    autumn: SeasonRule;
    winter: SeasonRule;
  };
  timeFieldRule: 'rolling' | 'coiling' | 'earliest';
}

export interface SeasonRule {
  months: number[];
  minDays: number;
  description: string;
}

export interface WaitingForecast {
  date: string;
  count: number;
  totalWeight: number;
  materials: Material[];
}
```

---

## 十、后端核心实现

### 10.1 撤销重做服务

```rust
// src-tauri/src/services/undo_service.rs
use crate::models::{UndoStack, ScheduleItem};
use sea_orm::*;
use serde::{Deserialize, Serialize};

const MAX_UNDO_STEPS: usize = 50;

#[derive(Debug, Serialize, Deserialize)]
pub enum ActionType {
    Add,
    Remove,
    Move,
    Lock,
    Unlock,
    BatchAdd,
    BatchRemove,
    AutoSchedule,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UndoState {
    pub items: Vec<ScheduleItemSnapshot>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduleItemSnapshot {
    pub id: i32,
    pub material_id: i32,
    pub sequence: i32,
    pub shift_no: i32,
    pub is_locked: bool,
}

pub struct UndoService {
    db: DatabaseConnection,
}

impl UndoService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn push(
        &self,
        plan_id: i32,
        action_type: ActionType,
        before_state: UndoState,
        after_state: UndoState,
    ) -> Result<(), DbErr> {
        use crate::models::undo_stack;

        // 清除已撤销的操作
        undo_stack::Entity::delete_many()
            .filter(undo_stack::Column::PlanId.eq(plan_id))
            .filter(undo_stack::Column::IsUndone.eq(true))
            .exec(&self.db)
            .await?;

        // 检查是否超过最大步数
        let count = undo_stack::Entity::find()
            .filter(undo_stack::Column::PlanId.eq(plan_id))
            .filter(undo_stack::Column::IsUndone.eq(false))
            .count(&self.db)
            .await?;

        if count >= MAX_UNDO_STEPS as u64 {
            let oldest = undo_stack::Entity::find()
                .filter(undo_stack::Column::PlanId.eq(plan_id))
                .filter(undo_stack::Column::IsUndone.eq(false))
                .order_by_asc(undo_stack::Column::CreatedAt)
                .one(&self.db)
                .await?;

            if let Some(old) = oldest {
                undo_stack::Entity::delete_by_id(old.id)
                    .exec(&self.db)
                    .await?;
            }
        }

        // 插入新记录
        let new_record = undo_stack::ActiveModel {
            plan_id: Set(plan_id),
            action_type: Set(serde_json::to_string(&action_type).unwrap()),
            before_state: Set(serde_json::to_string(&before_state).unwrap()),
            after_state: Set(serde_json::to_string(&after_state).unwrap()),
            is_undone: Set(false),
            ..Default::default()
        };

        undo_stack::Entity::insert(new_record)
            .exec(&self.db)
            .await?;

        Ok(())
    }

    pub async fn undo(&self, plan_id: i32) -> Result<UndoState, UndoError> {
        use crate::models::undo_stack;

        let latest = undo_stack::Entity::find()
            .filter(undo_stack::Column::PlanId.eq(plan_id))
            .filter(undo_stack::Column::IsUndone.eq(false))
            .order_by_desc(undo_stack::Column::CreatedAt)
            .one(&self.db)
            .await?
            .ok_or(UndoError::NoUndoAvailable)?;

        let mut record: undo_stack::ActiveModel = latest.clone().into();
        record.is_undone = Set(true);
        record.update(&self.db).await?;

        let before_state: UndoState = serde_json::from_str(&latest.before_state)?;
        Ok(before_state)
    }

    pub async fn redo(&self, plan_id: i32) -> Result<UndoState, UndoError> {
        use crate::models::undo_stack;

        let latest_undone = undo_stack::Entity::find()
            .filter(undo_stack::Column::PlanId.eq(plan_id))
            .filter(undo_stack::Column::IsUndone.eq(true))
            .order_by_desc(undo_stack::Column::CreatedAt)
            .one(&self.db)
            .await?
            .ok_or(UndoError::NoRedoAvailable)?;

        let mut record: undo_stack::ActiveModel = latest_undone.clone().into();
        record.is_undone = Set(false);
        record.update(&self.db).await?;

        let after_state: UndoState = serde_json::from_str(&latest_undone.after_state)?;
        Ok(after_state)
    }

    pub async fn get_stack_info(&self, plan_id: i32) -> Result<UndoStackInfo, DbErr> {
        use crate::models::undo_stack;

        let undo_count = undo_stack::Entity::find()
            .filter(undo_stack::Column::PlanId.eq(plan_id))
            .filter(undo_stack::Column::IsUndone.eq(false))
            .count(&self.db)
            .await? as i32;

        let redo_count = undo_stack::Entity::find()
            .filter(undo_stack::Column::PlanId.eq(plan_id))
            .filter(undo_stack::Column::IsUndone.eq(true))
            .count(&self.db)
            .await? as i32;

        Ok(UndoStackInfo {
            can_undo: undo_count > 0,
            can_redo: redo_count > 0,
            undo_count,
            redo_count,
        })
    }

    pub async fn clear(&self, plan_id: i32) -> Result<(), DbErr> {
        use crate::models::undo_stack;

        undo_stack::Entity::delete_many()
            .filter(undo_stack::Column::PlanId.eq(plan_id))
            .exec(&self.db)
            .await?;

        Ok(())
    }
}
```

### 10.2 Excel 导入服务

```rust
// src-tauri/src/services/import_service.rs
use calamine::{Reader, Xlsx, DataType};
use crate::models::{Material, FieldMapping};
use std::path::Path;
use chrono::{NaiveDateTime, DateTime, Utc};

pub struct ImportService {
    mappings: Vec<FieldMapping>,
    temper_rules: TemperRules,
}

#[derive(Debug)]
pub struct ImportResult {
    pub success_count: i32,
    pub fail_count: i32,
    pub ready_count: i32,
    pub waiting_count: i32,
    pub errors: Vec<ImportError>,
}

impl ImportService {
    pub fn new(mappings: Vec<FieldMapping>, temper_rules: TemperRules) -> Self {
        Self { mappings, temper_rules }
    }

    pub fn import<P: AsRef<Path>>(&self, path: P) -> Result<ImportResult, ImportError> {
        let mut workbook: Xlsx<_> = calamine::open_workbook(path)?;
      
        let sheet_name = workbook.sheet_names()[0].clone();
        let range = workbook.worksheet_range(&sheet_name)?;
      
        let mut materials = Vec::new();
        let mut errors = Vec::new();
        let mut ready_count = 0;
        let mut waiting_count = 0;
      
        let headers: Vec<String> = range.rows()
            .next()
            .map(|row| row.iter().map(|cell| cell.to_string()).collect())
            .unwrap_or_default();
      
        let field_indices = self.build_field_indices(&headers);
      
        for (row_idx, row) in range.rows().enumerate().skip(1) {
            match self.parse_row(row, &field_indices, row_idx as i32 + 2) {
                Ok(material) => {
                    if material.is_tempered {
                        ready_count += 1;
                    } else {
                        waiting_count += 1;
                    }
                    materials.push(material);
                }
                Err(e) => errors.push(e),
            }
        }
      
        Ok(ImportResult {
            success_count: materials.len() as i32,
            fail_count: errors.len() as i32,
            ready_count,
            waiting_count,
            errors,
        })
    }

    fn parse_row(
        &self,
        row: &[DataType],
        indices: &std::collections::HashMap<String, usize>,
        row_num: i32,
    ) -> Result<Material, ImportError> {
        // ... 解析各字段

        // 计算适温状态（基于卷取产出时间）
        let (temp_status, temp_wait_days) = crate::utils::temperature::calculate_temp_status(
            coiling_time,
            &self.temper_rules,
        );

        let is_tempered = temp_status == TempStatus::Ready;

        Ok(Material {
            // ... 其他字段
            coiling_time,
            temp_status: match temp_status {
                TempStatus::Ready => "ready".to_string(),
                TempStatus::Waiting => "waiting".to_string(),
            },
            temp_wait_days: temp_wait_days as i32,
            is_tempered,
            tempered_at: if is_tempered { Some(Utc::now()) } else { None },
            // ...
        })
    }
}
```

### 10.3 约束校验器

```rust
// src-tauri/src/engine/validator.rs
use crate::models::{ScheduleItem, Material};

pub struct Validator {
    constraints: Constraints,
}

#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub violations: Vec<Violation>,
}

#[derive(Debug, Clone)]
pub struct Violation {
    pub rule: String,
    pub severity: Severity,
    pub message: String,
    pub item_ids: Vec<i32>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Severity {
    Error,
    Warning,
    Info,
}

impl Validator {
    pub fn new(constraints: Constraints) -> Self {
        Self { constraints }
    }

    pub fn validate(&self, items: &[ScheduleItem], materials: &[Material]) -> ValidationResult {
        let mut violations = Vec::new();
      
        let material_map: std::collections::HashMap<i32, &Material> = 
            materials.iter().map(|m| (m.id, m)).collect();
      
        self.check_width_jump(items, &material_map, &mut violations);
        self.check_shift_capacity(items, &material_map, &mut violations);
        self.check_temper_status(items, &material_map, &mut violations);
        self.check_roll_change_position(items, &material_map, &mut violations);
      
        let is_valid = !violations.iter().any(|v| v.severity == Severity::Error);
      
        ValidationResult { is_valid, violations }
    }

    fn check_width_jump(
        &self,
        items: &[ScheduleItem],
        materials: &std::collections::HashMap<i32, &Material>,
        violations: &mut Vec<Violation>,
    ) {
        for i in 1..items.len() {
            let prev_item = &items[i - 1];
            let curr_item = &items[i];
          
            if prev_item.shift_no != curr_item.shift_no {
                continue;
            }
          
            if let (Some(prev_mat), Some(curr_mat)) = (
                materials.get(&prev_item.material_id),
                materials.get(&curr_item.material_id),
            ) {
                let jump = (curr_mat.width - prev_mat.width).abs();
              
                if jump > self.constraints.width_jump_threshold {
                    violations.push(Violation {
                        rule: "width_jump".to_string(),
                        severity: Severity::Error,
                        message: format!(
                            "材料 {} 到 {} 宽度跳跃 {:.0}mm，超过阈值 {:.0}mm",
                            prev_mat.coil_id, curr_mat.coil_id, jump, self.constraints.width_jump_threshold
                        ),
                        item_ids: vec![prev_item.id, curr_item.id],
                        suggestion: Some("建议调整材料顺序或插入过渡材料".to_string()),
                    });
                }
            }
        }
    }

    fn check_temper_status(
        &self,
        items: &[ScheduleItem],
        materials: &std::collections::HashMap<i32, &Material>,
        violations: &mut Vec<Violation>,
    ) {
        for item in items {
            if let Some(mat) = materials.get(&item.material_id) {
                if !mat.is_tempered {
                    violations.push(Violation {
                        rule: "temper_status".to_string(),
                        severity: Severity::Error,
                        message: format!("材料 {} 尚未适温（待温{}天），不可排程", mat.coil_id, mat.temp_wait_days),
                        item_ids: vec![item.id],
                        suggestion: Some("建议等待适温或从排程中移除".to_string()),
                    });
                }
            }
        }
    }

    // ... 其他检查方法
}
```

---

## 十一、测试策略

### 11.1 测试分层

```
┌─────────────────────────────────────────────────┐
│                   E2E 测试                       │
│         (Playwright / Tauri Driver)             │
├─────────────────────────────────────────────────┤
│                 集成测试                         │
│      (API 测试 / 组件集成测试)                   │
├─────────────────────────────────────────────────┤
│                 单元测试                         │
│   (Rust: cargo test / TS: Vitest)              │
└─────────────────────────────────────────────────┘
```

### 11.2 后端单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Utc, Duration};

    #[test]
    fn test_temp_status_winter_ready() {
        let rules = TemperRules::default();
        let now = Utc::now();

        // 冬季，4天前的材料应该已适温（冬季要求3天）
        let coiling_time = now - Duration::days(4);
        let (status, days) = calculate_temp_status(coiling_time, &rules);

        assert_eq!(status, TempStatus::Ready);
        assert_eq!(days, 4);
    }

    #[test]
    fn test_temp_status_waiting() {
        let rules = TemperRules::default();
        let now = Utc::now();

        // 1天前的材料不应该已适温
        let coiling_time = now - Duration::days(1);
        let (status, days) = calculate_temp_status(coiling_time, &rules);

        assert_eq!(status, TempStatus::Waiting);
        assert_eq!(days, 1);
    }

    #[test]
    fn test_filter_frozen_materials() {
        let strategy = create_default_strategy();
        let scheduler = Scheduler::new(strategy, create_default_shifts());
      
        let mut frozen = create_test_material(1, 1000.0, 10.0);
        frozen.status = "frozen".to_string();
      
        let materials = vec![frozen, create_test_material(2, 1000.0, 10.0)];
        let result = scheduler.schedule(materials);
      
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].material_id, 2);
    }

    #[test]
    fn test_width_jump_validation() {
        let validator = Validator::new(Constraints { width_jump_threshold: 100.0, ..Default::default() });
      
        let items = vec![
            create_schedule_item(1, 1, 1000.0),
            create_schedule_item(2, 2, 1200.0), // 跳跃200mm，超限
        ];
      
        let result = validator.validate(&items, &get_materials(&items));
      
        assert!(!result.is_valid);
        assert!(result.violations.iter().any(|v| v.rule == "width_jump"));
    }
}
```

### 11.3 前端组件测试

```typescript
// src/components/MaterialTable/__tests__/MaterialTable.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialTable } from '../index';

describe('MaterialTable', () => {
  const mockMaterials = [
    createMockMaterial({ id: 1, coilId: 'TEST001', tempStatus: 'ready' }),
    createMockMaterial({ id: 2, coilId: 'TEST002', tempStatus: 'waiting' }),
  ];

  it('renders material rows', () => {
    render(
      <MaterialTable
        materials={mockMaterials}
        selectedIds={new Set()}
        onSelect={jest.fn()}
        onDragStart={jest.fn()}
      />
    );

    expect(screen.getByText('TEST001')).toBeInTheDocument();
    expect(screen.getByText('TEST002')).toBeInTheDocument();
  });

  it('disables drag for waiting materials', () => {
    render(
      <MaterialTable
        materials={mockMaterials}
        selectedIds={new Set()}
        onSelect={jest.fn()}
        onDragStart={jest.fn()}
      />
    );

    const waitingRow = screen.getByText('TEST002').closest('.material-row');
    expect(waitingRow).toHaveClass('disabled');
  });

  it('shows temp status badge correctly', () => {
    render(
      <MaterialTable
        materials={mockMaterials}
        selectedIds={new Set()}
        onSelect={jest.fn()}
        onDragStart={jest.fn()}
      />
    );

    expect(screen.getByText('适温')).toBeInTheDocument();
    expect(screen.getByText('待温')).toBeInTheDocument();
  });
});
```

### 11.4 E2E 测试

```typescript
// e2e/workbench.spec.ts
import { test, expect } from '@playwright/test';

test.describe('计划工作台', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.workbench');
  });

  test('应正确区分适温和待温材料', async ({ page }) => {
    await page.click('[data-testid="import-btn"]');
    await page.setInputFiles('input[type="file"]', 'test-data/materials.xlsx');
    await page.waitForSelector('.ant-message-success');

    // 验证适温材料区域
    const readySection = await page.$('.ready-materials');
    expect(readySection).toBeTruthy();
  
    // 验证待温材料区域
    const waitingSection = await page.$('.waiting-materials');
    expect(waitingSection).toBeTruthy();
  });

  test('待温材料不可拖入排程区域', async ({ page }) => {
    const waitingMaterial = await page.$('.waiting-materials .material-row:first-child');
    const dropZone = await page.$('.schedule-drop-zone');
  
    await waitingMaterial?.dragTo(dropZone!);
  
    // 验证排程区域仍然为空
    const scheduleItems = await page.$$('.schedule-item');
    expect(scheduleItems.length).toBe(0);
  
    // 验证显示了禁止提示
    await expect(page.locator('.drag-forbidden-tip')).toBeVisible();
  });

  test('撤销重做功能正常工作', async ({ page }) => {
    // 添加适温材料到排程
    await page.dragAndDrop('.ready-materials .material-row:first-child', '.schedule-drop-zone');
  
    let items = await page.$$('.schedule-item');
    expect(items.length).toBe(1);
  
    // 撤销
    await page.keyboard.press('Control+z');
    items = await page.$$('.schedule-item');
    expect(items.length).toBe(0);
  
    // 重做
    await page.keyboard.press('Control+y');
    items = await page.$$('.schedule-item');
    expect(items.length).toBe(1);
  });

  test('刷新适温状态功能', async ({ page }) => {
    await page.click('[data-testid="refresh-temp-btn"]');
    await page.waitForSelector('.ant-message-success');
  
    // 验证刷新成功提示
    await expect(page.locator('.ant-message-success')).toContainText('已更新');
  });
});
```

---

## 十二、部署与发布

### 12.1 构建配置

```json
// src-tauri/tauri.conf.json
{
  "productName": "热轧平整机组排程沙盘模拟系统",
  "version": "1.3.0",
  "identifier": "com.spm.simulator",
  "build": {
    "beforeBuildCommand": "pnpm build",
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "热轧平整机组排程沙盘模拟系统",
        "width": 1440,
        "height": 900,
        "minWidth": 1200,
        "minHeight": 700,
        "resizable": true,
        "fullscreen": false,
        "center": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "dmg"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    },
    "macOS": {
      "entitlements": null,
      "minimumSystemVersion": "10.15"
    }
  }
}
```

### 12.2 构建脚本

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:debug": "tauri build --debug",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src"
  }
}
```

### 12.3 CI/CD 配置

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: macos-latest
            target: x86_64-apple-darwin
          - os: macos-latest
            target: aarch64-apple-darwin

    runs-on: ${{ matrix.os }}
  
    steps:
      - uses: actions/checkout@v4
    
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
        
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
        
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
      
      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'v__VERSION__'
          releaseBody: 'See the assets to download this version.'
          releaseDraft: true
          prerelease: false
```

---

## 十三、开发计划

### 13.1 里程碑

| 阶段                        | 周期      | 交付物                           |
| --------------------------- | --------- | -------------------------------- |
| **Phase 1: 基础框架** | 第1-2周   | 项目骨架、数据库、基础UI         |
| **Phase 2: 核心功能** | 第3-6周   | M01工作台、M02策略配置、适温计算 |
| **Phase 3: 分析功能** | 第7-9周   | M03风险、M04对比、M05历史        |
| **Phase 4: 完善优化** | 第10-11周 | M06-M09、性能优化                |
| **Phase 5: 测试上线** | 第12周    | 集成测试、用户验收               |

### 13.2 详细任务分解

#### Phase 1: 基础框架（第1-2周）

**Week 1**

- [ ] 初始化 Tauri + React 项目
- [ ] 配置 TypeScript、ESLint、Prettier
- [ ] 集成 Ant Design 5.x 主题
- [ ] 设计并实现主布局框架
- [ ] 配置 SeaORM + SQLite
- [ ] 创建数据库迁移脚本

**Week 2**

- [ ] 实现基础 CRUD Commands
- [ ] 前后端 IPC 通信调试
- [ ] 实现全局错误处理
- [ ] 实现路由导航
- [ ] 集成 Zustand 状态管理

#### Phase 2: 核心功能（第3-6周）

**Week 3-4: M01 计划工作台（基础）**

- [ ] 材料导入功能（Excel 解析）
- [ ] 适温状态计算服务
- [ ] 材料列表展示（虚拟滚动）
- [ ] 材料筛选与搜索
- [ ] 适温/待温材料分组显示
- [ ] 材料状态管理（冻结/解冻）
- [ ] 刷新适温状态功能

**Week 5: M01 计划工作台（排程）**

- [ ] 新建/保存/切换方案
- [ ] 手工拖拽排程（限制待温材料）
- [ ] 排程队列展示
- [ ] 材料锁定/解锁
- [ ] 撤销/重做功能
- [ ] 快捷键实现

**Week 6: M02 策略模板配置**

- [ ] 自动排程引擎实现
- [ ] 适温规则配置界面
- [ ] 排序权重配置界面
- [ ] 约束参数配置界面
- [ ] 模板 CRUD 功能

#### Phase 3: 分析功能（第7-9周）

**Week 7: M03 风险概览**

- [ ] 风险评估引擎
- [ ] 风险列表展示
- [ ] 待温材料预测功能
- [ ] 风险定位与处理
- [ ] 一键应用建议

**Week 8: M04 方案对比**

- [ ] 对比维度计算
- [ ] 对比界面实现
- [ ] 差异可视化
- [ ] 综合评分算法

**Week 9: M05 历史追溯**

- [ ] 历史方案列表
- [ ] 版本时间线展示
- [ ] 方案回溯功能
- [ ] 统计图表（ECharts）

#### Phase 4: 完善优化（第10-11周）

**Week 10**

- [ ] M06 数据映射配置
- [ ] M07 设置中心（含适温参数）
- [ ] 检修计划管理
- [ ] 导出功能（自定义模板）

**Week 11**

- [ ] M08 日志管理
- [ ] M09 数据管理（备份恢复）
- [ ] 性能优化
- [ ] 甘特图视图完善

#### Phase 5: 测试上线（第12周）

- [ ] 集成测试
- [ ] 性能测试
- [ ] Bug 修复
- [ ] 用户文档
- [ ] 打包发布

---

## 十四、用户操作手册

### 14.1 快速开始

```
1. 启动应用
   └── 双击应用图标启动

2. 导入材料
   └── 工作台 → 导入 → 选择 Excel 文件 → 确认字段映射 → 开始导入
   └── 导入后自动计算适温状态

3. 创建排程方案
   └── 新建方案 → 设置名称和日期范围 → 选择策略模板 → 确认

4. 执行自动排程
   └── 选择目标方案 → 点击"自动排程" → 查看排程结果
   └── 注意：只有适温材料会被自动排程

5. 手工调整
   └── 从适温材料池拖拽材料到排程区域
   └── 拖拽调整材料顺序
   └── 锁定关键位置 / 添加或移除材料
   └── 注意：待温材料（蓝色标记）不可拖入排程

6. 检查风险
   └── 查看风险概览 → 处理高风险项 → 确认方案
   └── 查看待温材料预测，了解何时可以排程

7. 保存并导出
   └── 保存方案 → 导出 Excel
```

### 14.2 常用快捷键速查

| 快捷键   | 功能     | 快捷键   | 功能         |
| -------- | -------- | -------- | ------------ |
| Ctrl + Z | 撤销     | Ctrl + Y | 重做         |
| Ctrl + S | 保存     | Ctrl + F | 搜索         |
| ↑ / ↓  | 移动位置 | Space    | 锁定/解锁    |
| Delete   | 撤回材料 | F5       | 刷新适温状态 |
| Ctrl + A | 全选     | Esc      | 取消选择     |

### 14.3 适温状态说明

| 状态图标 | 状态 | 说明                         | 可否排程    |
| -------- | ---- | ---------------------------- | ----------- |
| 🟢       | 适温 | 已达到可加工温度，可参与排程 | ✓ 可排程   |
| 🔵       | 待温 | 尚未达到可加工温度           | ✗ 不可排程 |

**适温条件（默认配置）：**

- 春季(3-5月)、冬季(12-2月)：产出后 ≥ 3天
- 夏季(6-8月)、秋季(9-11月)：产出后 ≥ 4天

---

## 十五、维护与扩展指南

### 15.1 代码规范

**Rust 代码规范**

- 使用 `rustfmt` 格式化代码
- 使用 `clippy` 进行静态分析
- 错误处理使用 `thiserror` 定义错误类型
- 异步操作使用 `tokio`

**TypeScript 代码规范**

- 使用 ESLint + Prettier
- 组件使用函数式组件 + Hooks
- 状态管理使用 Zustand
- API 调用统一封装

### 15.2 扩展点

| 扩展场景     | 扩展方式                                     |
| ------------ | -------------------------------------------- |
| 新增排序维度 | 修改 `sort_weights` JSON Schema + 排序算法 |
| 新增约束规则 | 添加 `Validator` 中的检查方法              |
| 新增风险类型 | 扩展 `Risk` 枚举和评估逻辑                 |
| 修改适温规则 | 修改 `temper_rules` 配置和计算逻辑         |
| 新增导出格式 | 实现新的 `ExportService`                   |
| 新增图表     | 添加 ECharts 组件                            |

### 15.3 性能优化建议

| 优化点     | 方案                  | 预期效果              |
| ---------- | --------------------- | --------------------- |
| 大列表渲染 | react-window 虚拟滚动 | 支持 2000+ 行流畅滚动 |
| 排程计算   | Rust 多线程 (Rayon)   | 1000卷排程 < 3s       |
| 数据库查询 | 合理索引 + 批量操作   | 查询响应 < 100ms      |
| 内存管理   | 流式处理大文件        | 支持 10MB+ Excel      |

---

## 附录

### 附录A：术语表

| 术语                   | 说明                                       |
| ---------------------- | ------------------------------------------ |
| 平整机组               | 热轧精整工序中对钢卷进行平整处理的设备     |
| 干平整                 | 不使用乳化液的平整工艺                     |
| 换辊                   | 更换工作辊，通常按轧制吨位触发             |
| 宽度跳跃               | 相邻两卷材料的宽度差值                     |
| 硬度等级               | 材料的硬度分类（软/中/硬）                 |
| 表面等级               | 材料的表面质量等级（FA/FB/FC/FD）          |
| 库龄                   | 材料在库存中的存放天数                     |
| 人工干预优先级         | 计划员手动设置的优先级                     |
| **适温材料**     | 已达到可加工温度条件的材料,可进入排程      |
| **待温材料**     | 尚未达到可加工温度条件的材料，不可进入排程 |
| **待温天数**     | 材料自卷取产出后经过的天数                 |
| **卷取产出时间** | 材料在卷取机完成卷取的时间，用于适温计算   |

### 附录B：材料数据导入字段对照表

| 系统字段               | 字段说明               | 必填         | 数据类型           | 示例值                                  |
| ---------------------- | ---------------------- | ------------ | ------------------ | --------------------------------------- |
| coil_id                | 材料编号               | ✓           | 字符串             | HC2402-0012                             |
| contract_no            | 合同号                 |              | 字符串             | CT202402001                             |
| customer_name          | 客户名称               |              | 字符串             | XX汽车公司                              |
| customer_code          | 客户代码               |              | 字符串             | C001                                    |
| steel_grade            | 钢种代码               | ✓           | 字符串             | Q235B                                   |
| thickness              | 厚度                   | ✓           | 小数               | 2.5                                     |
| width                  | 宽度                   | ✓           | 整数               | 1500                                    |
| weight                 | 重量                   | ✓           | 小数               | 24.5                                    |
| hardness_level         | 硬度等级               | ✓           | 字符串             | 软/中/硬                                |
| surface_level          | 表面等级               | ✓           | 字符串             | FA/FB/FC/FD                             |
| product_type           | 产品大类               |              | 字符串             | 冷轧基料                                |
| contract_attr          | 合同属性               |              | 字符串             | 出口合同/期货合同/现货合同/过渡材合同等 |
| contract_nature        | 合同性质               |              | 字符串             | 订单/现货/框架                          |
| export_flag            | 出口标识               |              | 布尔值             | 是/否                                   |
| weekly_delivery        | 按周交货标识           |              | 布尔值             | 是/否                                   |
| batch_code             | 集批代码               |              | 字符串             | B001                                    |
| **coiling_time** | **卷取产出时间** | **✓** | **日期时间** | **2026-02-08 14:30**              |
| due_date               | 交货期限               |              | 日期               | 2026-02-20                              |
| storage_loc            | 库位                   |              | 字符串             | A-01-02                                 |

### 附录C：默认系统参数汇总

**适温参数：**

| 参数         | 默认值  | 说明                 |
| ------------ | ------- | -------------------- |
| 启用适温筛选 | 是      | 是否启用适温材料筛选 |
| 春季月份     | 3,4,5   | 春季包含的月份       |
| 夏季月份     | 6,7,8   | 夏季包含的月份       |
| 秋季月份     | 9,10,11 | 秋季包含的月份       |
| 冬季月份     | 12,1,2  | 冬季包含的月份       |
| 春季适温天数 | 3天     | 春季适温阈值         |
| 夏季适温天数 | 4天     | 夏季适温阈值         |
| 秋季适温天数 | 4天     | 秋季适温阈值         |
| 冬季适温天数 | 3天     | 冬季适温阈值         |

**产能参数：**

| 参数         | 默认值    | 说明             |
| ------------ | --------- | ---------------- |
| 单班产能上限 | 1200吨    | 每班次最大排产量 |
| 日产能目标   | 2400吨    | 两班制日目标产量 |
| 平均轧制节奏 | 15分钟/卷 | 单卷平均处理时间 |

**换辊参数：**

| 参数         | 默认值 | 说明                       |
| ------------ | ------ | -------------------------- |
| 换辊吨位阈值 | 1500吨 | 累计轧制吨位达到后换辊     |
| 换辊作业时长 | 30分钟 | 换辊占用时间               |
| 整卷收尾     | 是     | 达到阈值后完成当前卷再换辊 |

**约束参数：**

| 参数         | 默认值 | 说明                         |
| ------------ | ------ | ---------------------------- |
| 最大宽度跳跃 | 100mm  | 相邻材料宽度差上限（硬约束） |
| 最大厚度跳跃 | 1.0mm  | 相邻材料厚度差上限（软约束） |

**班次参数：**

| 参数     | 默认值      | 说明         |
| -------- | ----------- | ------------ |
| 白班时间 | 08:00-20:00 | 白班起止时间 |
| 夜班时间 | 20:00-08:00 | 夜班起止时间 |

**预警参数：**

| 参数           | 默认值 | 说明             |
| -------------- | ------ | ---------------- |
| 产能利用率黄灯 | 85%    | 低于此值黄色预警 |
| 产能利用率红灯 | 70%    | 低于此值红色预警 |
| 交期预警天数   | 3天    | 临期预警触发天数 |
| 库龄预警天数   | 7天    | 库龄预警触发天数 |
| 库龄严重预警   | 14天   | 库龄严重预警天数 |

**撤销参数：**

| 参数         | 默认值 | 说明           |
| ------------ | ------ | -------------- |
| 最大撤销步数 | 50     | 撤销栈最大容量 |

### 附录D：风险类型与处理建议

| 风险类型     | 风险级别 | 触发条件             | 建议操作              |
| ------------ | -------- | -------------------- | --------------------- |
| 交期超期     | 🔴 高    | 材料已超过交货期限   | 立即排产/提升优先级   |
| 宽度跳跃违规 | 🔴 高    | 相邻材料宽度差>100mm | 调整顺序/插入过渡材料 |
| 班次产能超限 | 🔴 高    | 班次产量>上限        | 移除材料/调整班次     |
| 待温材料入排 | 🔴 高    | 未适温材料进入排程   | 移除/等待适温         |
| 产能不足     | 🟠 中    | 班次利用率<70%       | 补充排产/调整分配     |
| 临期预警     | 🟠 中    | 材料将在3天内到期    | 提升优先级            |
| 换辊位置不佳 | 🟠 中    | 换辊点打断连续性     | 调整换辊位置          |
| 待温预警     | 🟡 低    | 存在待温材料无法排程 | 查看待温材料列表      |
| 库龄超期     | 🟡 低    | 库龄>7天             | 优先安排              |
| 钢种频繁切换 | 🟡 低    | 单班切换>5次         | 优化分组              |

---

**文档版本**: V1.4（整合版）
**更新日期**: 2026年2月12日
**项目名称**: 热轧平整机组排程沙盘模拟系统
**整合来源**: V1.1 业务规则 + V1.2 技术实现
**文档状态**: 完整版

---

**整合说明**：本文档基于 V1.1 和 V1.2 两个版本整合而成：

- **业务规则**：采用 V1.1 的四季节独立配置（更灵活）
- **数据模型**：整合两版字段，保留 temp_status 枚举，统一使用 coiling_time（卷取产出时间）
- **界面设计**：保留 V1.1 的 ASCII 布局图和设计规范
- **技术实现**：采用 V1.2 的完整代码示例和组件架构
- **功能模块**：采用 V1.2 的 9 模块设计（新增 M08/M09）
- **测试与部署**：采用 V1.2 的完整工程化方案
- **新增功能**：保留 V1.1 的待温材料预测功能
