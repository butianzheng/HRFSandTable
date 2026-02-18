import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const BASELINE_PATH = path.resolve(process.cwd(), 'scripts/perf/risk-chip-baseline.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'dist/perf-risk-chip-benchmark.json');

const CASES = [
  { key: '1k', label: '1k 风险记录', size: 1000 },
  { key: '5k', label: '5k 风险记录', size: 5000 },
];

const WARMUP_ROUNDS = 8;
const SAMPLE_ROUNDS = 40;
const REGRESSION_RATIO = 1.2;
const ABS_P95_TOLERANCE_MS = 0.08;
const ABS_AVG_TOLERANCE_MS = 0.06;

const CONSTRAINT_TYPES = [
  'temp_status_filter',
  'width_jump',
  'shift_capacity',
  'overdue_priority',
  'roll_change_tonnage',
];

const DUE_BUCKETS = ['overdue', 'in3', 'in7', 'later', 'none'];

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function generateRows(size, seed) {
  const rand = createRng(seed);
  const rows = [];
  for (let i = 0; i < size; i += 1) {
    const constraintType = CONSTRAINT_TYPES[Math.floor(rand() * CONSTRAINT_TYPES.length)];
    const dueBucket = DUE_BUCKETS[Math.floor(rand() * DUE_BUCKETS.length)];
    // 通过 material_id 重复制造去重场景，贴近页面统计逻辑
    const materialId = Math.floor(i * 0.72 + rand() * 80);
    rows.push({
      constraint_type: constraintType,
      material_id: materialId,
      due_bucket: dueBucket,
    });
  }
  return rows;
}

function collectRiskChipEntries(rows) {
  const constraintMaterialMap = new Map();
  const dueMaterialMap = new Map();
  rows.forEach((row) => {
    const constraintSet = constraintMaterialMap.get(row.constraint_type) ?? new Set();
    constraintSet.add(row.material_id);
    constraintMaterialMap.set(row.constraint_type, constraintSet);

    const bucket = row.due_bucket ?? 'none';
    const dueSet = dueMaterialMap.get(bucket) ?? new Set();
    dueSet.add(row.material_id);
    dueMaterialMap.set(bucket, dueSet);
  });

  const constraintEntries = Array.from(constraintMaterialMap.entries())
    .map(([constraintType, set]) => [`constraint:${constraintType}`, set.size])
    .sort((a, b) => b[1] - a[1]);
  const dueEntries = Array.from(dueMaterialMap.entries())
    .map(([bucket, set]) => [`due:${bucket}`, set.size])
    .sort((a, b) => b[1] - a[1]);
  return [...constraintEntries, ...dueEntries];
}

function calcPercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * percentile) - 1);
  return sorted[index];
}

function toFixedNumber(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function runOneCase({ key, label, size }) {
  const rows = generateRows(size, size + 20260213);
  for (let i = 0; i < WARMUP_ROUNDS; i += 1) {
    collectRiskChipEntries(rows);
  }

  const samples = [];
  let entryCount = 0;
  for (let i = 0; i < SAMPLE_ROUNDS; i += 1) {
    const start = performance.now();
    const entries = collectRiskChipEntries(rows);
    const cost = performance.now() - start;
    samples.push(cost);
    entryCount = entries.length;
  }

  const avgMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const minMs = Math.min(...samples);
  const maxMs = Math.max(...samples);
  const p95Ms = calcPercentile(samples, 0.95);

  return {
    key,
    label,
    size,
    sampleCount: SAMPLE_ROUNDS,
    avgMs: toFixedNumber(avgMs),
    p95Ms: toFixedNumber(p95Ms),
    minMs: toFixedNumber(minMs),
    maxMs: toFixedNumber(maxMs),
    entryCount,
  };
}

async function loadBaseline() {
  try {
    const raw = await fs.readFile(BASELINE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function compareWithBaseline(currentCases, baselineCases) {
  if (!baselineCases) return { regressions: [], notes: ['未找到基线文件，已跳过对比'] };
  const baselineMap = new Map(baselineCases.map((item) => [item.key, item]));
  const regressions = [];
  currentCases.forEach((item) => {
    const base = baselineMap.get(item.key);
    if (!base) return;
    const p95Limit = Math.max(base.p95Ms * REGRESSION_RATIO, base.p95Ms + ABS_P95_TOLERANCE_MS);
    if (item.p95Ms > p95Limit) {
      regressions.push(
        `${item.label} P95 ${item.p95Ms}ms 超过阈值 ${toFixedNumber(p95Limit)}ms（基线 ${base.p95Ms}ms）`
      );
    }
    const avgLimit = Math.max(base.avgMs * REGRESSION_RATIO, base.avgMs + ABS_AVG_TOLERANCE_MS);
    if (item.avgMs > avgLimit) {
      regressions.push(
        `${item.label} 均值 ${item.avgMs}ms 超过阈值 ${toFixedNumber(avgLimit)}ms（基线 ${base.avgMs}ms）`
      );
    }
  });
  return { regressions, notes: [] };
}

async function main() {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const baseline = await loadBaseline();
  const caseResults = CASES.map(runOneCase);
  const comparison = compareWithBaseline(caseResults, baseline?.cases ?? null);

  const report = {
    generatedAt: new Date().toISOString(),
    env: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    benchmark: {
      warmupRounds: WARMUP_ROUNDS,
      sampleRounds: SAMPLE_ROUNDS,
      regressionRatio: REGRESSION_RATIO,
      absP95ToleranceMs: ABS_P95_TOLERANCE_MS,
      absAvgToleranceMs: ABS_AVG_TOLERANCE_MS,
    },
    baseline: baseline
      ? {
        source: path.relative(process.cwd(), BASELINE_PATH),
        generatedAt: baseline.generatedAt ?? null,
      }
      : null,
    cases: caseResults,
    regressions: comparison.regressions,
    notes: comparison.notes,
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[perf] 风险命中基准报告: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  caseResults.forEach((item) => {
    console.log(`[perf] ${item.label}: avg=${item.avgMs}ms p95=${item.p95Ms}ms max=${item.maxMs}ms`);
  });
  if (comparison.regressions.length > 0) {
    console.warn('[perf] 检测到基准回归:');
    comparison.regressions.forEach((line) => console.warn(`  - ${line}`));
  } else {
    console.log('[perf] 风险命中基准对比通过');
  }
}

await main();
