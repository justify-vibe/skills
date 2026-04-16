# ui-capture Skill

> 完整说明请参考 skills/ui-capture/SKILL.md（本 README 仅保留速用与目录说明）

用途：在本地对 Web 原型或站点执行端到端交互，录制高分辨率视频和关键截图，用于还原 UI 或进行视觉对齐。

## 作为 Claude Skill 安装与调用

安装（发布到 GitHub 后）：

```bash
npx skills add <owner>/<repo> --skill ui-capture -y
# 或
npx skills add <owner>/<repo>@ui-capture -y
```

在 Claude 会话中调用：

```text
/ui-capture 帮我录制 ./example/proto
```

说明：
- 本技能已内置“必须传目录”约束。
- 执行录制时请使用：`pnpm run record -- <目录>`；未传目录会直接报错退出。

## 依赖
- Node.js >= 18
- pnpm >= 8

首次执行 `pnpm run record -- <目录>` 时会自动完成依赖与浏览器安装（无需手动预装）。

## 目录结构
- playwright.config.ts — Playwright 全局配置（3x 高清、手机视口、视频与 trace）
- scripts/serve-static.js — 简单静态文件服务器（用于原型目录，如 proto/）
- tests/*.spec.ts — 交互脚本示例（首页/房间页）

## 快速开始
1. 安装依赖
```bash
pnpm add -D @playwright/test playwright
pnpm exec playwright install --with-deps
```

2. 启动录制（必须显式传入目录）
```bash
pnpm run record -- ./proto
# 或绝对路径
pnpm run record -- /abs/path/to/proto
```

3. 查看产物
- 视频：playwright-artifacts/*/video.webm（1170x2532 @3x）
- 截图：失败时自动生成；也可在用例中显式 `page.screenshot()`
- Trace：失败用例自动保留，可用 `pnpm exec playwright show-trace <zip>` 查看

## 配置开关
- 在 playwright.config.ts 的 `projects` 中增删设备配置（iPhone/Pixel）
- 调整 `use.video.size`、`deviceScaleFactor` 控制清晰度
- 将 `webServer.command` 指向你的原型/站点启动命令
- `pnpm run record -- <目录>` 会自动把该目录注入为 `UI_CAPTURE_ROOT`
- 可透传 Playwright 参数：`pnpm run record -- ./proto --project=iphone-15-pro-3x`

## 截图示例
在用例中插入：
```ts
await page.screenshot({ path: `playwright-artifacts/home-hero.png`, fullPage: false });
```

## 注意
- 若 wheel 或触摸手势在目标浏览器不可用，建议使用 `page.evaluate(() => window.scrollBy(...))` 实现稳定滚动。
