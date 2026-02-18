import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIST_ASSETS_DIR = path.resolve(process.cwd(), 'dist/assets');
const SUMMARY_OUTPUT = path.resolve(process.cwd(), 'dist/perf-summary.json');

const BUDGET = {
  maxTotalJsKB: 2300,
  maxLargestJsKB: 420,
  maxChunksOver350KB: 3,
};

const NAMED_BUDGETS = [
  { name: 'vendor-react', pattern: /^vendor-react-.*\.js$/, maxKB: 260 },
  { name: 'vendor-zrender', pattern: /^vendor-zrender-.*\.js$/, maxKB: 220 },
  { name: 'vendor-echarts', pattern: /^vendor-echarts-.*\.js$/, maxKB: 420 },
  { name: 'core', pattern: /^core-.*\.js$/, maxKB: 420 },
];

function toKB(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

async function readJsChunks() {
  const entries = await fs.readdir(DIST_ASSETS_DIR, { withFileTypes: true });
  const files = entries
    .filter((item) => item.isFile() && item.name.endsWith('.js'))
    .map((item) => item.name);
  const chunks = await Promise.all(
    files.map(async (name) => {
      const filePath = path.join(DIST_ASSETS_DIR, name);
      const stat = await fs.stat(filePath);
      return {
        name,
        bytes: stat.size,
        kb: toKB(stat.size),
      };
    })
  );
  return chunks.sort((a, b) => b.bytes - a.bytes);
}

function collectViolations(chunks) {
  const violations = [];
  const totalJsKB = toKB(chunks.reduce((sum, item) => sum + item.bytes, 0));
  const largestJsKB = chunks.length > 0 ? chunks[0].kb : 0;
  const chunksOver350 = chunks.filter((item) => item.kb > 350);

  if (totalJsKB > BUDGET.maxTotalJsKB) {
    violations.push(`总 JS 体积 ${totalJsKB}KB 超过预算 ${BUDGET.maxTotalJsKB}KB`);
  }
  if (largestJsKB > BUDGET.maxLargestJsKB) {
    violations.push(`最大 JS Chunk ${largestJsKB}KB 超过预算 ${BUDGET.maxLargestJsKB}KB`);
  }
  if (chunksOver350.length > BUDGET.maxChunksOver350KB) {
    violations.push(
      `超过 350KB 的 Chunk 数量 ${chunksOver350.length} 超过预算 ${BUDGET.maxChunksOver350KB}`
    );
  }

  for (const budget of NAMED_BUDGETS) {
    for (const chunk of chunks.filter((item) => budget.pattern.test(item.name))) {
      if (chunk.kb > budget.maxKB) {
        violations.push(`${budget.name} Chunk ${chunk.name} 为 ${chunk.kb}KB，超过预算 ${budget.maxKB}KB`);
      }
    }
  }

  return {
    totalJsKB,
    largestJsKB,
    chunksOver350KB: chunksOver350.map((item) => ({ name: item.name, kb: item.kb })),
    violations,
  };
}

async function main() {
  try {
    await fs.access(DIST_ASSETS_DIR);
  } catch {
    console.error('[perf] 未找到 dist/assets，请先执行构建。');
    process.exit(1);
  }

  const chunks = await readJsChunks();
  const stats = collectViolations(chunks);
  const summary = {
    generatedAt: new Date().toISOString(),
    budget: BUDGET,
    namedBudget: NAMED_BUDGETS.map((item) => ({
      name: item.name,
      pattern: item.pattern.toString(),
      maxKB: item.maxKB,
    })),
    stats: {
      totalJsKB: stats.totalJsKB,
      largestJsKB: stats.largestJsKB,
      chunkCount: chunks.length,
      chunksOver350KB: stats.chunksOver350KB,
      topChunks: chunks.slice(0, 10),
    },
    violations: stats.violations,
  };

  await fs.writeFile(SUMMARY_OUTPUT, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`[perf] JS 总体积: ${stats.totalJsKB}KB`);
  console.log(`[perf] 最大 Chunk: ${stats.largestJsKB}KB`);
  console.log(`[perf] 产物报告: ${path.relative(process.cwd(), SUMMARY_OUTPUT)}`);

  if (stats.violations.length > 0) {
    console.error('[perf] 性能预算检查未通过:');
    stats.violations.forEach((msg) => console.error(`  - ${msg}`));
    process.exit(1);
  }

  console.log('[perf] 性能预算检查通过');
}

await main();
