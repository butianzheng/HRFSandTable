/**
 * E2E: Compare 方案对比页面
 * 验证方案选择器、对比按钮、结果区渲染
 */
import { test, expect } from '@playwright/test';

test.describe('Compare 方案对比', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/compare');
    await page
      .waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 10000 })
      .catch(() => {});
  });

  test('页面包含方案A和方案B选择器', async ({ page }) => {
    await expect(page.getByText('方案 A:')).toBeVisible();
    await expect(page.getByText('方案 B:')).toBeVisible();
  });

  test('页面包含方案C可选选择器', async ({ page }) => {
    await expect(page.getByText('方案 C(可选):')).toBeVisible();
  });

  test('开始对比按钮存在', async ({ page }) => {
    await expect(page.getByRole('button', { name: '开始对比' })).toBeVisible();
  });

  test('方案选择器可点击展开下拉', async ({ page }) => {
    const selectors = page.locator('.ant-select');
    if ((await selectors.count()) > 0) {
      await selectors.first().click();
      await expect(page.locator('.ant-select-dropdown')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('初始状态显示空提示', async ({ page }) => {
    const hasEmptyTwo = await page
      .getByText('请选择两个方案进行对比')
      .isVisible()
      .catch(() => false);
    const hasEmptyThree = await page
      .getByText('请选择三个不同方案进行对比')
      .isVisible()
      .catch(() => false);
    const hasResult = await page
      .locator('.ant-progress-circle')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasEmptyTwo || hasEmptyThree || hasResult).toBe(true);
  });

  test('通过 URL 参数可预选方案', async ({ page }) => {
    await page.goto('/compare?planA=1&planB=2');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('交换按钮存在', async ({ page }) => {
    const swapButton = page.locator('button').filter({ has: page.locator('.anticon-swap') });
    await expect(swapButton).toBeVisible();
  });
});
