import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

async function readText(relPath) {
  const abs = path.resolve(ROOT, relPath);
  return fs.readFile(abs, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function containsAll(text, snippets, fileLabel) {
  snippets.forEach((snippet) => {
    assert(
      text.includes(snippet),
      `[frontend-contract] ${fileLabel} 缺少关键片段: ${snippet}`
    );
  });
}

async function main() {
  const mainLayout = await readText('src/layouts/MainLayout.tsx');
  containsAll(
    mainLayout,
    [
      "const Workbench = lazy(routeLoaders['/'])",
      "const RiskOverview = lazy(routeLoaders['/risk'])",
      "const Compare = lazy(routeLoaders['/compare'])",
      "const History = lazy(routeLoaders['/history'])",
      "const FieldMapping = lazy(routeLoaders['/mapping'])",
      "const Settings = lazy(routeLoaders['/settings'])",
      "const Logs = lazy(routeLoaders['/logs'])",
      "const DataManage = lazy(routeLoaders['/data'])",
      "recordRouteRenderCost(location.pathname",
    ],
    'src/layouts/MainLayout.tsx'
  );

  const workbench = await readText('src/pages/Workbench/index.tsx');
  containsAll(
    workbench,
    [
      "onDoubleClick={() => navigate('/settings?tab=priority')}",
      '清除命中筛选',
      '暂无命中项',
    ],
    'src/pages/Workbench/index.tsx'
  );

  const workbenchPriorityHit = await readText('src/pages/Workbench/usePriorityHit.ts');
  containsAll(
    workbenchPriorityHit,
    [
      'PRIORITY_HIT_WORKER_THRESHOLD',
      "new Worker(new URL('../../workers/priorityHit.worker.ts', import.meta.url), {",
    ],
    'src/pages/Workbench/usePriorityHit.ts'
  );

  const riskOverviewData = await readText('src/pages/RiskOverview/useRiskData.tsx');
  containsAll(
    riskOverviewData,
    [
      'const RISK_CONFIG_HIT_WORKER_THRESHOLD',
      "new Worker(new URL('../../workers/riskConfigHit.worker.ts', import.meta.url), {",
    ],
    'src/pages/RiskOverview/useRiskData.tsx'
  );

  const riskConfigHitCard = await readText('src/pages/RiskOverview/RiskConfigHitCard.tsx');
  containsAll(
    riskConfigHitCard,
    [
      'buildSettingsLinkFromRiskChip',
      '配置命中解释',
    ],
    'src/pages/RiskOverview/RiskConfigHitCard.tsx'
  );

  const settings = await readText('src/pages/Settings/index.tsx');
  containsAll(
    settings,
    [
      'priorityKey',
    ],
    'src/pages/Settings/index.tsx'
  );

  const settingsPerformance = await readText('src/pages/Settings/PerformanceTab.tsx');
  containsAll(
    settingsPerformance,
    ['perf-risk-chip-benchmark.json', 'riskChipBenchmarkColumns', '风险命中基准通过', '路由渲染样本'],
    'src/pages/Settings/PerformanceTab.tsx'
  );

  const settingsPriorityToolbar = await readText('src/pages/Settings/PriorityConfigPanel/PriorityToolbar.tsx');
  containsAll(
    settingsPriorityToolbar,
    ['预检导入', '执行导入'],
    'src/pages/Settings/PriorityConfigPanel/PriorityToolbar.tsx'
  );

  const workerNames = ['logFilter.worker.ts', 'priorityHit.worker.ts', 'riskConfigHit.worker.ts'];
  for (const file of workerNames) {
    const workerText = await readText(path.join('src/workers', file));
    assert(workerText.includes('ctx.onmessage ='), `[frontend-contract] src/workers/${file} 未实现消息处理`);
  }

  const packageJson = JSON.parse(await readText('package.json'));
  const scripts = packageJson.scripts ?? {};
  ['check:workflow', 'test:backend', 'perf:risk-benchmark'].forEach((key) => {
    assert(scripts[key], `[frontend-contract] package.json 缺少脚本 ${key}`);
  });

  console.log('[frontend-contract] 合约检查通过');
}

await main();
