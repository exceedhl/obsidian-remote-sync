# S3 Remote Sync

[English](README.md) | **中文**

笔记如果先落到 S3——inbox 倾倒、语音备忘、共享桶——你希望它们出现在 Obsidian 里，又不想要双向同步覆盖本地修改、或把已删文件再拉回来。**S3 Remote Sync** 做单向、**只同步一次（sync-once）** 的拉取：每个对象下载一次就记入台账，之后由你在本地随意移动、编辑或删除。同一套引擎提供 **Agent CLI**，脚本和 AI agent 不用打开 Obsidian 也能从终端触发这次 fetch-once 同步。

## 功能

- **Sync-once（只拉一次）** — 已下载的 S3 key 记在 `ledger.json`；之后同步会跳过，即使你删了本地文件
- **单向 S3 → 库** — 按 prefix 镜像到本地目录，不上传
- **Agent CLI** — `obsidian-s3-sync run|status|test`，支持 `--json` 和稳定 exit code，便于自动化
- **共享状态** — 插件与 CLI 使用同一份 ledger（以及同一份 `data.json`，若存在）
- **兼容 S3** — AWS、R2、MinIO、Supabase Storage 及其他 path-style 端点
- **凭证** — 应用内走 Obsidian SecretStorage；CLI 使用 flag、`S3_*` / `AWS_*` 环境变量，或 `data.json` 里的 XOR fallback

## 安装

```bash
npm install
npm run build
```

产物在 `dist/`：

- `dist/main.js`
- `dist/manifest.json`
- `dist/cli.js`（Agent CLI，shebang `#!/usr/bin/env node`）

### 安装插件

1. 打开 `<你的库>/.obsidian/plugins/`（`.obsidian` 是隐藏文件夹）。
2. 新建目录 `obsidian-s3-remote-sync`。
3. 把 `dist/` 里的 `main.js`、`manifest.json`、`cli.js` 拷进去。
4. 在 Obsidian：**设置 → 社区插件 → 刷新**，然后启用 **S3 Remote Sync**。

### 配置

**设置 → S3 Remote Sync**

| 设置项 | 作用 |
| :--- | :--- |
| Endpoint / Region / Bucket | S3 兼容连接 |
| Access Key / Secret Key | 通过 SecretStorage 存在系统钥匙串（不会明文写进库） |
| S3 Prefix | 可选，桶内文件夹（如 `notes/`） |
| Local Base Path | 写入的库内目录（如 `Inbox`） |
| Sync Interval | 后台拉取间隔（分钟；`0` 关闭） |
| Force Re-download | 忽略台账，重新拉取全部 |

命令面板：**S3 Remote Sync: Start Sync**。

## Agent CLI

Obsidian 未打开时也能跑同一套 sync-once 引擎，适合 cron、CI 或 AI agent。

### 安装（symlink）

```bash
# npm run build 之后，在本仓库目录
ln -sf "$(pwd)/dist/cli.js" ~/.local/bin/obsidian-s3-sync

# 或从 vault 插件目录
ln -sf "/path/to/vault/.obsidian/plugins/obsidian-s3-remote-sync/cli.js" ~/.local/bin/obsidian-s3-sync
```

确保 `~/.local/bin` 在 `PATH` 上。在本仓库 `npm install` 后也可以用 `npx obsidian-s3-sync`。

### 用法

```bash
obsidian-s3-sync --vault /path/to/vault
obsidian-s3-sync run --vault /path/to/vault --dry-run --json
obsidian-s3-sync status --vault /path/to/vault
obsidian-s3-sync test --vault /path/to/vault
```

插件目录探测：`--plugin-dir` > `<vault>/.obsidian/plugins/obsidian-s3-remote-sync/` > `<vault>/.obsidian/plugins/remote-sync/`。

配置优先级：CLI flag（`--endpoint`、`--region`、`--bucket`、`--prefix`、`--access-key`、`--secret-key` 等）> `S3_*` 环境变量（别名 `AWS_ENDPOINT_URL` / `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`）> 插件 `data.json` 中的 XOR `secrets`（仅当该字段存在）。

只存在 Obsidian SecretStorage 里的密钥，CLI **读不到**。给 agent 用时请传 flag 或环境变量。

退出码：`0` 成功（包括没有新文件）· `1` 配置缺失 / 锁冲突 · `2` S3 网络或鉴权 · `3` 本地写入失败。

## 开发

```bash
npm test
npm run test:watch
```
