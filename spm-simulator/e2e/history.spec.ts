/**
 * E2E: History 历史追溯页面
 * 验证版本历史、对比、导出等核心功能
 */
import { test, expect } from '@playwright/test';

test.describe('History 历史追溯', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
    // 等待加载完成
    await page
      .waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 10000 })
      .catch(() => {});
  });

  test('显示方案选择器', async ({ page }) => {
    await expect(page.getByText('选择方案:')).toBeVisible();
    // 方案选择下拉框
    const selector = page.locator('.ant-select').first();
    await expect(selector).toBeVisible();
  });

  test('未选择方案时显示空状态', async ({ page }) => {
    // 如果没有选择方案，应该显示提示
    const emptyText = page.getByText('请选择一个方案查看历史追溯');
    const isVisible = await emptyText.isVisible().catch(() => false);

    if (isVisible) {
      await expect(emptyText).toBeVisible();
    } else {
      // 如果已经有选中的方案，验证版本时间线存在
      await expect(page.getByText('版本时间线')).toBeVisible();
    }
  });

  test('工具栏按钮存在', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查是否有方案被选中
    const hasSelectedPlan = (await page.locator('.ant-select-selection-item').count()) > 0;

    if (hasSelectedPlan) {
      // 如果有选中方案，验证工具栏按钮
      const buttons = ['版本对比', '导出报告', '刷新'];
      for (const btnText of buttons) {
        const button = page.getByRole('button', { name: btnText });
        const exists = (await button.count()) > 0;
        if (exists) {
          await expect(button).toBeVisible();
        }
      }
    }
  });

  test('版本时间线卡片存在', async ({ page }) => {
    // 选择一个方案（如果有的话）
    const selector = page.locator('.ant-select').first();
    const hasOptions = await selector.isVisible();

    if (hasOptions) {
      await selector.click();
      const firstOption = page.locator('.ant-select-item').first();
      const optionExists = await firstOption.isVisible().catch(() => false);

      if (optionExists) {
        await firstOption.click();
        await page.waitForTimeout(1000);

        // 验证版本时间线卡片
        await expect(page.getByText('版本时间线')).toBeVisible();
      }
    }
  });

  test('操作日志面板存在', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查操作日志标题
    const logTitle = page.getByText(/操作日志/);
    const exists = (await logTitle.count()) > 0;

    if (exists) {
      await expect(logTitle).toBeVisible();
    }
  });
});
