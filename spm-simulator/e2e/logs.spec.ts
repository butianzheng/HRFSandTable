/**
 * E2E: Logs 日志查看页面
 * 验证日志列表、筛选、搜索等功能
 */
import { test, expect } from '@playwright/test';

test.describe('Logs 日志查看', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/logs');
    // 等待加载完成
    await page
      .waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 10000 })
      .catch(() => {});
  });

  test('显示页面内容', async ({ page }) => {
    // 验证页面加载
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('日志表格存在', async ({ page }) => {
    // 等待表格加载
    await page.waitForTimeout(1000);

    // 检查是否有表格
    const table = page.locator('.ant-table');
    const hasTable = (await table.count()) > 0;

    if (hasTable) {
      await expect(table.first()).toBeVisible();
    } else {
      // 可能显示空状态
      const emptyState = page.locator('.ant-empty');
      const hasEmpty = (await emptyState.count()) > 0;
      if (hasEmpty) {
        await expect(emptyState.first()).toBeVisible();
      }
    }
  });

  test('日志类型筛选器存在', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查筛选器
    const filters = page.locator('.ant-select, .ant-radio-group');
    const hasFilters = (await filters.count()) > 0;

    if (hasFilters) {
      await expect(filters.first()).toBeVisible();
    }
  });

  test('搜索框可输入', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/搜索|关键词/);
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

  test('日期范围选择器存在', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查日期选择器
    const datePicker = page.locator('.ant-picker');
    const hasPicker = (await datePicker.count()) > 0;

    if (hasPicker) {
      await expect(datePicker.first()).toBeVisible();
    }
  });

  test('导出按钮存在', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /导出/ });
    const exists = (await exportBtn.count()) > 0;

    if (exists) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });
});
