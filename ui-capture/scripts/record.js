#!/usr/bin/env node

const { existsSync, statSync } = require('fs');
const { resolve, isAbsolute } = require('path');
const { spawnSync } = require('child_process');

let args = process.argv.slice(2);
if (args[0] === '--') args = args.slice(1);

if (args.length === 0) {
  console.error('用法: pnpm run record -- <目录路径> [额外 playwright 参数]');
  console.error('示例: pnpm run record -- ./proto');
  console.error('示例: pnpm run record -- /abs/path/to/proto --project=iphone-15-pro-3x');
  hintAfterFailure('请先提供要录制的静态目录路径。');
  process.exit(1);
}

const [rawDir, ...extraArgs] = args;
const captureRoot = isAbsolute(rawDir) ? rawDir : resolve(process.cwd(), rawDir);

if (!existsSync(captureRoot) || !statSync(captureRoot).isDirectory()) {
  console.error(`[ui-capture] 目录不存在或不是目录: ${captureRoot}`);
  hintAfterFailure('确认目录路径正确，或使用绝对路径重试。');
  process.exit(1);
}

const skillRoot = resolve(__dirname, '..');

function logStage(msg) {
  console.log(`\n[ui-capture] ${msg}`);
}

function hintAfterFailure(hint) {
  console.error(`[ui-capture] 建议：${hint}`);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: skillRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  return result.status ?? 1;
}

function hasPlaywrightBinary() {
  const cmd = process.platform === 'win32' ? 'playwright.cmd' : 'playwright';
  const res = spawnSync(cmd, ['--version'], {
    cwd: skillRoot,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return res.status === 0;
}

function ensureDependencies() {
  if (!hasPlaywrightBinary()) {
    logStage('阶段 1/3：未检测到 Playwright，正在自动安装项目依赖...');

    const installCode = run('pnpm', ['install']);
    if (installCode !== 0) {
      console.error('[ui-capture] pnpm install 失败。');
      hintAfterFailure('检查网络、镜像源或 pnpm 配置后重试。');
      process.exit(installCode);
    }
  } else {
    logStage('阶段 1/3：Playwright 可执行依赖已就绪。');
  }

  logStage('阶段 2/3：正在确保 Playwright 浏览器依赖可用...');
  const browsersCode = run('pnpm', ['run', 'install:browsers']);
  if (browsersCode !== 0) {
    console.error('[ui-capture] Playwright 浏览器安装失败。');
    hintAfterFailure('可尝试手动执行：pnpm run install:browsers');
    process.exit(browsersCode);
  }

  if (!hasPlaywrightBinary()) {
    console.error('[ui-capture] 依赖安装后仍未找到 Playwright 可执行文件。');
    hintAfterFailure('可尝试删除 node_modules 后重新执行 pnpm run record。');
    process.exit(1);
  }
}

ensureDependencies();

logStage(`阶段 3/3：开始录制，目录为 ${captureRoot}`);

const runCode = run(
  process.platform === 'win32' ? 'playwright.cmd' : 'playwright',
  ['test', '--reporter=line', ...extraArgs],
  {
    env: {
      ...process.env,
      UI_CAPTURE_ROOT: captureRoot,
    },
  },
);

if (runCode !== 0) {
  console.error('[ui-capture] 录制执行失败。');
  hintAfterFailure('先检查测试报错与页面可访问性，再重试录制。');
}

process.exit(runCode);

