---
name: ui-capture
description: Use when needing high‑fidelity UI capture for prototypes or sites — mobile 3x viewport video/screenshot/trace artifacts via Playwright, quick local static serving, and reproducible scripts for visual alignment and demos.
---

# UI Capture

## Overview
借助 Playwright 在本地对原型/站点执行端到端交互，稳定录制高分辨率视频与关键截图，并输出 trace 以支持复盘与分享。配套 3x 移动视口与设备预设（iPhone/Pixel），可快速对齐视觉与生成演示素材。

**目录位置：** skills/ui-capture/
- 配置：skills/ui-capture/playwright.config.ts
- 脚本：skills/ui-capture/scripts/serve-static.js
- 示例：skills/ui-capture/tests/*.spec.ts

## When to Use
- 需要对原型/站点进行高保真走查并产出视频/截图/trace
- 需要 3x 移动端视口（iPhone/Pixel）以便视觉对齐
- 需要可复现、可分享的交互脚本与产物
- 需要本地快速静态服务承载原型（proto/）

不适用：超长时实机录屏、含系统层交互（通知/摄像头）或需跨浏览器像素级一致性的基准对比。

## Core Pattern
- 用 playwright.config.ts 统一设置 baseURL、视频尺寸、trace、viewport、设备缩放 3x。
- 通过 webServer 启动本地静态服务或自定义服务命令。
- 在测试脚本中仅描述稳定可复现的交互；滚动使用 evaluate 避免手势不一致。

示例片段（截取自 tests/home.spec.ts）：
```ts
await page.goto('/index.html');
await page.screenshot({ path: 'playwright-artifacts/home-hero.png', fullPage: false });
const row = page.locator('[data-home-routines]');
await row.evaluate((el) => el.scrollBy({ left: 800, behavior: 'smooth' }));
```

## Quick Reference
安装依赖（Node.js ≥ 18，pnpm ≥ 8）：
```bash
pnpm add -D @playwright/test playwright
pnpm exec playwright install --with-deps
```
运行与查看产物（必须传目录）：
```bash
pnpm run record -- ./proto
# 或
pnpm run record -- /abs/path/to/proto
# 可透传 Playwright 参数：
pnpm run record -- ./proto --project=iphone-15-pro-3x
# 产物：skills/ui-capture/playwright-artifacts/*/{video.webm,trace.zip,*.png}
```
关键环境变量（任选）：
- UI_CAPTURE_PORT：服务端口（默认 5178）
- UI_CAPTURE_BASE_URL：覆盖 baseURL（默认 http://localhost:${UI_CAPTURE_PORT}）
- UI_CAPTURE_URL：server 可用性检测地址（默认 ${UI_CAPTURE_BASE_URL}/index.html）
- UI_CAPTURE_NO_SERVER：为真时不由 Playwright 启动 webServer
- UI_CAPTURE_SERVE：自定义静态服务命令（默认 node scripts/serve-static.js）
- UI_CAPTURE_ROOT：静态根目录（由 `pnpm run record -- <目录>` 自动注入；也可手动设置）

## Implementation
1) 准备要录制的原型目录（项目内或绝对路径）
2) 根据需要调整 skills/ui-capture/playwright.config.ts：
   - use.video.size、deviceScaleFactor、viewport、projects（设备）
   - webServer.command / url（或直接设置 UI_CAPTURE_SERVE / UI_CAPTURE_URL）
3) 在 tests/*.spec.ts 用稳定动作描述交互与截图点位（参考已有用例）
4) 执行 `pnpm run record -- <目录>`，收集视频/截图/trace 产物并分享

## Common Mistakes
- 忘记安装浏览器依赖（执行 `pnpm exec playwright install --with-deps`）
- baseURL 未指向有效页面；确认 `UI_CAPTURE_BASE_URL` 或 webServer `url`
- 使用 wheel/触摸手势导致不稳定 → 改用 `page.evaluate(() => window.scrollBy(...))`
- 产物目录不一致 → 统一使用 `outputDir: 'playwright-artifacts'`

## Related Files
- skills/ui-capture/playwright.config.ts — 全局配置（3x、设备、视频、trace、webServer）
- skills/ui-capture/scripts/serve-static.js — 简易静态服务
- skills/ui-capture/tests/home.spec.ts — 首页走查与截图示例
- skills/ui-capture/tests/room.spec.ts — 房间详情交互示例
