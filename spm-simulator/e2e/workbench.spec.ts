/**
 * E2E: Workbench 页面交互
 * 验证工作台核心 UI 交互: 新建方案弹窗、导入材料弹窗、视图切换等
 */
import { test, expect } from '@playwright/test';

test.describe('Workbench 工作台', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待 Spin 消失（数据加载完毕）
    await page
      .waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 10000 })
      .catch(() => {});
  });

  test('显示材料池和排程队列两栏', async ({ page }) => {
    // 左侧: 待排材料
    await expect(page.getByText('待排材料')).toBeVisible();
    // 右侧: 排程序列
    await expect(page.getByText('排程序列')).toBeVisible();
  });

  test('新建方案弹窗可打开和关闭', async ({ page }) => {
    await page.getByRole('button', { name: '新建方案' }).click();
    // 弹窗标题
    await expect(page.getByText('新建排程方案')).toBeVisible();
    // 表单字段
    await expect(page.getByText('方案名称')).toBeVisible();
    await expect(page.getByText('周期类型')).toBeVisible();
    await expect(page.getByText('起止日期')).toBeVisible();
    // 关闭弹窗
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('新建排程方案')).not.toBeVisible();
  });

  test('导入材料弹窗可打开', async ({ page }) => {
    // 左侧工具栏的导入按钮
    const importButtons = page.getByRole('button', { name: '导入材料' });
    await importButtons.first().click();
    await expect(page.getByText('导入文件')).toBeVisible();
    await expect(page.getByText('映射模板')).toBeVisible();
  });

  test('搜索框可输入', async ({ page }) => {
    const searchInput = page.getByPlaceholder('搜索卷号/钢种/客户/合同...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');
  });

  test('视图切换按钮存在', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /甘特图视图|列表视图/ });
    await expect(toggleBtn).toBeVisible();
  });
});
