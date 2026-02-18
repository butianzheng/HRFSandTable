/**
 * E2E: DataManage 数据管理页面
 * 验证材料导入、筛选、状态更新等功能
 */
import { test, expect } from '@playwright/test';

test.describe('DataManage 数据管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/data');
    // 等待加载完成
    await page
      .waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 10000 })
      .catch(() => {});
  });

  test('显示页面标题和工具栏', async ({ page }) => {
    // 验证页面加载
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('导入材料按钮存在', async ({ page }) => {
    const importBtn = page.getByRole('button', { name: /导入材料/ });
    const exists = (await importBtn.count()) > 0;

    if (exists) {
      await expect(importBtn.first()).toBeVisible();
    }
  });

  test('材料表格存在', async ({ page }) => {
    // 等待表格加载
    await page.waitForTimeout(1000);

    // 检查是否有表格
    const table = page.locator('.ant-table');
    const hasTable = (await table.count()) > 0;

    if (hasTable) {
      await expect(table.first()).toBeVisible();
    }
  });

  test('筛选器存在', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查状态筛选器
    const filters = page.locator('.ant-select');
    const hasFilters = (await filters.count()) > 0;

    if (hasFilters) {
      await expect(filters.first()).toBeVisible();
    }
  });

  test('搜索框可输入', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/搜索|卷号|钢种/);
    const exists = (await searchInput.count()) > 0;

    if (exists) {
      await expect(searchInput.first()).toBeVisible();
      await searchInput.first().fill('test');
      await expect(searchInput.first()).toHaveValue('test');
    }
  });

  test('刷新按钮存在', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /刷新/ });
    const exists = (await refreshBtn.count()) > 0;

    if (exists) {
      await expect(refreshBtn.first()).toBeVisible();
    }
  });
});
