# example 说明

本目录用于提供可直接运行的录制示例素材。

## 来源
- 当前内容复制自：`/Users/dy/vibe/thynco/proto`
- 复制目标：`skills/ui-capture/example/proto`

## 目录结构
- `example/proto/`：用于 ui-capture 录制的静态页面示例目录

## 如何使用
在 `skills/ui-capture` 目录执行：

```bash
pnpm run record -- ./example/proto
```

也可以指定设备：

```bash
pnpm run record -- ./example/proto --project=iphone-15-pro-3x
```

## 同步更新（可选）
如果需要重新从源目录覆盖同步：

```bash
rm -rf ./example/proto
cp -R /Users/dy/vibe/thynco/proto ./example/proto
```
