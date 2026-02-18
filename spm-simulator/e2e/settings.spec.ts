/**
 * E2E: Settings 设置页面
 * 验证 Tab 切换和配置表单交互
 */
import { test, expect } from '@playwright/test';

test.describe('Settings 设置页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page
      .waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 10000 })
      .catch(() => {});
  });

  test('Tab 面板可切换', async ({ page }) => {
    // 检查 Tab 标签存在
    const tabs = page.locator('.ant-tabs-tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);

    // 点击每个 Tab 确认可切换
    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveClass(/ant-tabs-tab-active/);
    }
  });

  test('通过 URL 参数可直接定位 Tab', async ({ page }) => {
    await page.goto('/settings?tab=priority');
    // 优先级配置 Tab 应激活
    await expect(page.locator('.ant-tabs-tab-active')).toContainText(/优先级/);
  });
});
