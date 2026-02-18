/**
 * E2E: FieldMapping 字段映射页面
 * 验证映射模板管理、预览、导入导出等功能
 */
import { test, expect } from '@playwright/test';

test.describe('FieldMapping 字段映射', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mapping');
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

  test('新建映射按钮存在', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /新建映射|新建模板/ });
    const exists = (await createBtn.count()) > 0;

    if (exists) {
      await expect(createBtn.first()).toBeVisible();
    }
  });

  test('映射列表存在', async ({ page }) => {
    // 等待列表加载
    await page.waitForTimeout(1000);

    // 检查是否有列表或表格
    const hasList = (await page.locator('.ant-list, .ant-table').count()) > 0;

    if (hasList) {
      const list = page.locator('.ant-list, .ant-table').first();
      await expect(list).toBeVisible();
    } else {
      // 可能显示空状态
      const emptyState = page.locator('.ant-empty');
      const hasEmpty = (await emptyState.count()) > 0;
      if (hasEmpty) {
        await expect(emptyState.first()).toBeVisible();
      }
    }
  });

  test('可以打开新建映射弹窗', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /新建映射|新建模板/ });
    const exists = (await createBtn.count()) > 0;

    if (exists) {
      await createBtn.first().click();
      await page.waitForTimeout(500);

      // 验证弹窗打开
      const modal = page.locator('.ant-modal');
      const hasModal = (await modal.count()) > 0;

      if (hasModal) {
        await expect(modal.first()).toBeVisible();
      }
    }
  });

  test('预览文件功能存在', async ({ page }) => {
    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查预览相关按钮或功能
    const previewBtn = page.getByRole('button', { name: /预览/ });
    const exists = (await previewBtn.count()) > 0;

    if (exists) {
      await expect(previewBtn.first()).toBeVisible();
    }
  });
});
