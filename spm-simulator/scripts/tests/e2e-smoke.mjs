import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const HOST = process.env.SPM_SMOKE_HOST || '127.0.0.1';
const PORT = Number(process.env.SPM_SMOKE_PORT || 4173);
const BASE_URL = `http://${HOST}:${PORT}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return;
    } catch {
      // server not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`等待预览服务超时: ${url}`);
}

async function fetchAndAssertHtml(urlPath) {
  const res = await fetch(`${BASE_URL}${urlPath}`, { cache: 'no-store' });
  assert(res.ok, `[e2e-smoke] ${urlPath} 返回状态 ${res.status}`);
  const html = await res.text();
  assert(html.includes('id="root"'), `[e2e-smoke] ${urlPath} 缺少 #root`);
  return html;
}

function extractEntryModulePath(html) {
  const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i);
  return match?.[1] ?? null;
}

async function fetchAndAssertRouteRegistered(urlPath) {
  const html = await fetchAndAssertHtml(urlPath);
  const entryModulePath = extractEntryModulePath(html);
  assert(entryModulePath, `[e2e-smoke] ${urlPath} 缺少入口 module script`);

  const res = await fetch(`${BASE_URL}${entryModulePath}`, { cache: 'no-store' });
  assert(res.ok, `[e2e-smoke] 入口脚本 ${entryModulePath} 返回状态 ${res.status}`);
  const script = await res.text();
  assert(script.includes(urlPath), `[e2e-smoke] 入口脚本未注册路由 ${urlPath}`);
}

async function fetchAndAssertJson(urlPath, requiredKeys) {
  const res = await fetch(`${BASE_URL}${urlPath}`, { cache: 'no-store' });
  assert(res.ok, `[e2e-smoke] ${urlPath} 返回状态 ${res.status}`);
  const data = await res.json();
  requiredKeys.forEach((key) => {
    assert(Object.prototype.hasOwnProperty.call(data, key), `[e2e-smoke] ${urlPath} 缺少字段 ${key}`);
  });
}

async function ensureBuildArtifacts() {
  const distIndex = path.resolve(process.cwd(), 'dist/index.html');
  await fs.access(distIndex);
}

async function main() {
  await ensureBuildArtifacts();

  const preview = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'preview', '--', '--host', HOST, '--port', String(PORT)],
    {
      cwd: process.cwd(),
      stdio: 'ignore',
    }
  );

  const cleanup = () => {
    if (!preview.killed) {
      preview.kill('SIGTERM');
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  try {
    await waitForServer(`${BASE_URL}/`);
    await fetchAndAssertRouteRegistered('/strategy');
    await fetchAndAssertRouteRegistered('/mapping');

    const htmlRoutes = [
      '/',
      '/risk?planId=1',
      '/compare?planA=1&planB=2',
      '/history?planId=1',
      '/settings?tab=performance',
      '/logs',
      '/data',
    ];
    for (const route of htmlRoutes) {
      await fetchAndAssertHtml(route);
    }

    await fetchAndAssertJson('/perf-summary.json', ['generatedAt', 'stats', 'violations']);
    await fetchAndAssertJson('/perf-risk-chip-benchmark.json', ['generatedAt', 'cases', 'regressions']);

    console.log('[e2e-smoke] 预览态烟测通过');
  } finally {
    cleanup();
  }
}

await main();
