/**
 * E2E: RiskOverview 风险分析页面
 * 验证方案选择、风险筛选、图表渲染等交互
 */
import { test, expect } from '@playwright/test';

test.describe('RiskOverview 风险分析', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/risk');
    await page
      .waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 10000 })
      .catch(() => {});
  });

  test('页面包含方案选择器', async ({ page }) => {
    await expect(page.getByText('选择方案')).toBeVisible();
    // 方案 Select 存在
    const selector = page.locator('.ant-select').first();
    await expect(selector).toBeVisible();
  });

  test('页面包含预测天数选择器', async ({ page }) => {
    await expect(page.getByText('预测天数')).toBeVisible();
  });

  test('风险筛选下拉框可操作', async ({ page }) => {
    // 风险严重度 Select
    const severitySelect = page.locator('.ant-select').filter({ hasText: /风险:全部|仅高风险/ });
    if ((await severitySelect.count()) > 0) {
      await severitySelect.first().click();
      // 下拉菜单出现
      await expect(page.locator('.ant-select-dropdown')).toBeVisible();
      // 按 Escape 关闭
      await page.keyboard.press('Escape');
    }
  });

  test('一键处理按钮存在', async ({ page }) => {
    await expect(page.getByRole('button', { name: '一键处理高风险' })).toBeVisible();
  });

  test('通过 URL 参数指定 planId', async ({ page }) => {
    await page.goto('/risk?planId=1');
    // 页面正常渲染不报错
    await expect(page.locator('#root')).toBeVisible();
  });
});
