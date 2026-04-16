#!/usr/bin/env node

const { existsSync, statSync } = require('fs');
const { resolve, isAbsolute } = require('path');
const { spawn } = require('child_process');

let args = process.argv.slice(2);
if (args[0] === '--') args = args.slice(1);

if (args.length === 0) {
  console.error('用法: pnpm run record -- <目录路径> [额外 playwright 参数]');
  console.error('示例: pnpm run record -- ./proto');
  console.error('示例: pnpm run record -- /abs/path/to/proto --project=iphone-15-pro-3x');
  process.exit(1);
}

const [rawDir, ...extraArgs] = args;
const captureRoot = isAbsolute(rawDir) ? rawDir : resolve(process.cwd(), rawDir);

if (!existsSync(captureRoot) || !statSync(captureRoot).isDirectory()) {
  console.error(`[ui-capture] 目录不存在或不是目录: ${captureRoot}`);
  process.exit(1);
}

const skillRoot = resolve(__dirname, '..');
const cmd = process.platform === 'win32' ? 'playwright.cmd' : 'playwright';
const cmdArgs = ['test', '--reporter=line', ...extraArgs];

console.log(`[ui-capture] 使用录制目录: ${captureRoot}`);

const child = spawn(cmd, cmdArgs, {
  cwd: skillRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    UI_CAPTURE_ROOT: captureRoot,
  },
});

child.on('error', (err) => {
  console.error(`[ui-capture] 启动 Playwright 失败: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
