# 调度压测与回放（B主+A兜底）

## 1. 运行 10k 压测

在 `spm-simulator/src-tauri` 目录执行：

```bash
cargo run --bin scheduler_benchmark -- --materials 10000 --days 7 --runs 3
```

可选参数：

- `--db /tmp/spm_scheduler_bench.db`：压测数据库路径（默认 `/tmp/spm_scheduler_bench.db`）
- `--materials 10000`：造数条数
- `--days 7`：计划天数
- `--runs 3`：每个方案重复次数
- `--strategy-id 1`：强制使用指定策略

## 1.1 回放真实方案（不造数）

先复制业务库到临时文件，再执行：

```bash
cargo run --bin scheduler_benchmark -- \
  --db /tmp/spm_simulator_real_replay.db \
  --plan-id 7 \
  --runs 3
```

说明：

- 指定 `--plan-id` 后进入“回放模式”，不会清空/重建数据
- 默认使用方案自身 `strategy_id`；可用 `--strategy-id` 覆盖

## 2. 输出说明

输出会给出 A/B/C（含 B 调优）方案的：

- 平均耗时 / P95 / 最小 / 最大
- 平均排入块数
- 大于 30 分钟空档数量均值
- 最大空档分钟

并自动给出一个“混合方案推荐参数”（在排入量不显著下降前提下，平均耗时最短）。

## 3. 业务回放验收

后端新增命令：`analyze_schedule_idle_gaps(planId, thresholdMinutes)`

- 用于分析当前方案中同班次相邻任务之间的空档
- 默认阈值 30 分钟
- 返回超阈值空档明细与统计（数量、最大值、均值）
