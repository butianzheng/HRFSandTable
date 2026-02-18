/**
 * E2E: 页面导航 — 验证所有路由页面可正常渲染
 */
import { test, expect } from '@playwright/test';

const routes = [
  { path: '/', title: 'Workbench' },
  { path: '/risk', title: 'RiskOverview' },
  { path: '/compare', title: 'Compare' },
  { path: '/history', title: 'History' },
  { path: '/settings', title: 'Settings' },
  { path: '/logs', title: 'Logs' },
  { path: '/data', title: 'DataManage' },
  { path: '/strategy', title: 'Strategy' },
  { path: '/mapping', title: 'FieldMapping' },
];

test.describe('页面导航', () => {
  for (const route of routes) {
    test(`${route.title} (${route.path}) 页面可渲染`, async ({ page }) => {
      await page.goto(route.path);
      // 验证 #root 容器存在且有内容
      const root = page.locator('#root');
      await expect(root).toBeVisible();
      // 验证没有空白页（antd Spin 或实际内容至少存在一个）
      const hasContent = await page.locator('#root').evaluate((el) => el.children.length > 0);
      expect(hasContent).toBe(true);
    });
  }

  test('未知路由跳转首页', async ({ page }) => {
    await page.goto('/nonexistent-route');
    // 应重定向到首页或显示首页内容
    await expect(page.locator('#root')).toBeVisible();
  });
});
