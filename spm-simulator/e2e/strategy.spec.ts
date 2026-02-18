/**
 * E2E: Strategy 策略管理页面
 * 验证模板列表渲染、模板选择、详情Tab切换、CRUD弹窗交互
 */
import { test, expect } from '@playwright/test';

test.describe('Strategy 策略管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/strategy');
    await page
      .waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 10000 })
      .catch(() => {});
  });

  test('页面包含策略模板列表和策略详情两栏', async ({ page }) => {
    await expect(page.getByText('策略模板')).toBeVisible();
    await expect(page.getByText('策略详情')).toBeVisible();
  });

  test('模板列表包含导入、导出、新建按钮', async ({ page }) => {
    await expect(page.getByRole('button', { name: /导入/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /导出/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /新建/ })).toBeVisible();
  });

  test('点击模板可切换详情区内容', async ({ page }) => {
    const listItems = page.locator('.ant-list-item');
    const count = await listItems.count();
    if (count >= 2) {
      await listItems.nth(1).click();
      await expect(page.getByText('策略详情 —')).toBeVisible();
    }
  });

  test('详情区Tab可切换', async ({ page }) => {
    // 等待模板列表加载并自动选中第一项
    const detailTitle = page.getByText('策略详情 —');
    const hasDetail = await detailTitle.isVisible().catch(() => false);
    if (!hasDetail) return; // 无数据时跳过

    const tabs = page.locator('.ant-tabs-tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveClass(/ant-tabs-tab-active/);
    }
  });

  test('新建按钮可打开弹窗并关闭', async ({ page }) => {
    await page.getByRole('button', { name: /新建/ }).click();
    // 弹窗应出现，包含表单
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible();
    // 关闭弹窗
    await page.getByRole('button', { name: /取消|Cancel/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test('详情区初始显示选择提示或详情', async ({ page }) => {
    const hasDetail = await page
      .getByText('策略详情 —')
      .isVisible()
      .catch(() => false);
    const hasPrompt = await page
      .getByText('请从左侧选择一个策略模板查看详情')
      .isVisible()
      .catch(() => false);
    expect(hasDetail || hasPrompt).toBe(true);
  });
});
