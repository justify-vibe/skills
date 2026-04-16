import { test, expect } from '@playwright/test';

// 示例：房间详情页面交互录制

test('房间详情：搜索与卡片高亮', async ({ page }) => {
  await page.goto('/room.html?id=r1');

  await expect(page.getByPlaceholder('Search in this room')).toBeVisible();
  const tiles = page.locator('.unit-grid .unit-tile');
  await expect(tiles.first()).toBeVisible();

  // 逐个把前 6 个卡片滚动曝光
  const n = Math.min(await tiles.count(), 6);
  for (let i = 0; i < n; i++) {
    await tiles.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
  }

  // 点击首卡开关两次
  const firstSwitch = tiles.first().locator('.md3-switch');
  await firstSwitch.click();
  await page.waitForTimeout(200);
  await firstSwitch.click();

  // 底部与顶部滚动
  await page.evaluate(() => window.scrollBy({ top: 1400, behavior: 'smooth' }));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollBy({ top: -1400, behavior: 'smooth' }));
  await page.waitForTimeout(600);
});
