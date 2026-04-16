#!/usr/bin/env node

const { existsSync, statSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { resolve, isAbsolute } = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_CONFIG = {
  version: 1,
  artifactsDir: '.ui-capture/artifacts',
  promptArtifactsDirEachRun: true,
};

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

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadOrCreateConfig(contextCwd) {
  const configDir = resolve(contextCwd, '.ui-capture');
  const configPath = resolve(configDir, 'config.json');

  if (!existsSync(configPath)) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
    return {
      config: { ...DEFAULT_CONFIG },
      configPath,
      created: true,
    };
  }

  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!isPlainObject(parsed)) {
      throw new Error('config must be object');
    }

    const merged = { ...DEFAULT_CONFIG, ...parsed };
    const changed = JSON.stringify(merged) !== JSON.stringify(parsed);
    if (changed) {
      writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    }

    return {
      config: merged,
      configPath,
      created: false,
    };
  } catch (error) {
    console.error(`[ui-capture] 读取配置失败：${configPath}`);
    hintAfterFailure('请修复配置 JSON 格式，或删除该文件后重新执行以自动生成默认配置。');
    return {
      config: { ...DEFAULT_CONFIG },
      configPath,
      created: false,
      degraded: true,
    };
  }
}

function resolveCaptureRoot(rawDir, contextCwd) {
  if (isAbsolute(rawDir)) return rawDir;

  const fromContext = resolve(contextCwd, rawDir);
  if (existsSync(fromContext) && statSync(fromContext).isDirectory()) {
    return fromContext;
  }

  const fromSkillRoot = resolve(skillRoot, rawDir);
  if (existsSync(fromSkillRoot) && statSync(fromSkillRoot).isDirectory()) {
    return fromSkillRoot;
  }

  return fromContext;
}

function resolveArtifactsRoot(config, contextCwd) {
  const rawArtifactsDir = process.env.UI_CAPTURE_ARTIFACTS_DIR || config.artifactsDir || DEFAULT_CONFIG.artifactsDir;
  return isAbsolute(rawArtifactsDir) ? rawArtifactsDir : resolve(contextCwd, rawArtifactsDir);
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

let args = process.argv.slice(2);
if (args[0] === '--') args = args.slice(1);

if (args.length === 0) {
  console.error('用法: pnpm run record -- <目录路径> [额外 playwright 参数]');
  console.error('示例: pnpm run record -- ./proto');
  console.error('示例: pnpm run record -- /abs/path/to/proto --project=iphone-15-pro-3x');
  hintAfterFailure('请先提供要录制的静态目录路径。');
  process.exit(1);
}

const skillRoot = resolve(__dirname, '..');
const contextCwd = process.env.UI_CAPTURE_CONTEXT_CWD || process.env.INIT_CWD || process.cwd();

const { config, configPath, created } = loadOrCreateConfig(contextCwd);
if (created) {
  logStage(`已生成项目配置：${configPath}`);
}

const [rawDir, ...extraArgs] = args;
const captureRoot = resolveCaptureRoot(rawDir, contextCwd);

if (!existsSync(captureRoot) || !statSync(captureRoot).isDirectory()) {
  console.error(`[ui-capture] 目录不存在或不是目录: ${captureRoot}`);
  hintAfterFailure('确认目录路径正确，或使用绝对路径重试。');
  process.exit(1);
}

const artifactsRoot = resolveArtifactsRoot(config, contextCwd);
mkdirSync(artifactsRoot, { recursive: true });

logStage(`上下文目录：${contextCwd}`);
logStage(`本次产物目录：${artifactsRoot}`);

ensureDependencies();

logStage(`阶段 3/3：开始录制，目录为 ${captureRoot}`);

const runCode = run(
  process.platform === 'win32' ? 'playwright.cmd' : 'playwright',
  ['test', '--reporter=line', ...extraArgs],
  {
    env: {
      ...process.env,
      UI_CAPTURE_ROOT: captureRoot,
      UI_CAPTURE_CONTEXT_CWD: contextCwd,
      UI_CAPTURE_ARTIFACTS_DIR: artifactsRoot,
    },
  },
);

if (runCode !== 0) {
  console.error('[ui-capture] 录制执行失败。');
  hintAfterFailure('先检查测试报错与页面可访问性，再重试录制。');
}

process.exit(runCode);
