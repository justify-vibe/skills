import { test, expect } from '@playwright/test';

// 示例：首页文案与交互录制
// 环境变量 UI_CAPTURE_BASE_URL 指定 baseURL；默认 5178 上的 index.html

test('首页文案与交互（滑动/点击）', async ({ page }) => {
  await page.goto('/index.html');

  await expect(page.locator('.header-title')).toContainText('Hi,');
  await expect(page.getByText('AI Summary')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AUTOMATIONS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ROOMS' })).toBeVisible();

  // 截图首页头部区域
  await page.screenshot({ path: 'playwright-artifacts/home-hero.png', fullPage: false });

  // 横向滚动 automations
  const autoRow = page.locator('[data-home-routines]');
  await autoRow.evaluate((el) => el.scrollBy({ left: 800, behavior: 'smooth' }));
  await page.waitForTimeout(800);

  // 点前三个 routine 并返回
  const routines = autoRow.locator('.routine-card, [data-routine-card]');
  const count = await routines.count();
  for (let i = 0; i < Math.min(count, 3); i++) {
    await routines.nth(i).click();
    await page.waitForTimeout(400);
    await page.goBack();
  }

  // 进入 Rooms -> 滚动 -> 返回
  await page.getByText('See all').first().click();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollBy({ top: 1200, behavior: 'smooth' }));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollBy({ top: -1200, behavior: 'smooth' }));
  await page.waitForTimeout(600);
  await page.goBack();

  // 依次进入四个房间并返回
  const roomCards = page.locator('.rooms-row .room-card');
  for (let i = 0; i < Math.min(await roomCards.count(), 4); i++) {
    await roomCards.nth(i).click();
    await page.waitForTimeout(300);
    await page.goBack();
  }
});
