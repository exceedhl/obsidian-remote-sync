# PRD: US-7.1_Agent_CLI (Agent CLI)

## 1. 项目背景
*   **Story ID**: US-7.1
*   **Brief**: Agent_CLI
*   **Description**: 作为 Agent，我想在不打开 Obsidian 时通过终端 CLI 触发同一套 S3 拉取同步，以便 AI agent 与脚本能自动化 fetch-once 同步。
*   **Status**: **Completed**

## 2. 核心流程 (Workflow)
1. 调用 `obsidian-s3-sync`（默认命令 `run`），用 `--vault` 定位 vault 根。
2. 按探测顺序解析插件目录，读取同目录下的 `data.json` 与 `ledger.json`（与 Obsidian 插件共享）。
3. 按 **CLI flag > 环境变量 > data.json XOR fallback** 解析 S3 配置与凭证。
4. 注入 Node `fs` adapter，运行与插件等价的核心同步引擎（可 `--dry-run` / `--force`）。
5. `status` 输出 ledger 统计与 S3 待同步预览；`test` 做配置/凭证自检与连通性探测。
6. 以约定 exit code 退出，供 agent 判断成败。

## 3. 验收标准 (Acceptance Criteria)
| ID | 描述 (Description) | 优先级 | 验证方式 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| AC-7.1 | 同步内核零 `obsidian` 依赖，可通过注入的 FS adapter 在 Node 18 运行 | P1 | 单元测试 | **Completed** |
| AC-7.2 | CLI 支持 `run`（默认）、`status`、`test`；`run` 支持 `--dry-run` / `--force` / `--json` | P1 | 单元测试 + CLI | **Completed** |
| AC-7.3 | 配置优先级：flag > env（含 AWS_* 别名）> `data.json` 的 XOR `secrets` 兜底 | P1 | 单元测试 | **Completed** |
| AC-7.4 | 插件目录探测：`--plugin-dir` > `obsidian-s3-remote-sync` > `remote-sync` | P1 | 单元测试 | **Completed** |
| AC-7.5 | 与插件共享同一 `ledger.json`；写入先写 tmp 再 rename（原子） | P1 | 单元测试 | **Completed** |
| AC-7.6 | Exit code：0 成功（含无新增）；1 配置/凭证缺失；2 S3 网络/鉴权；3 本地写入失败 | P1 | 单元测试 | **Completed** |
| AC-7.7 | 构建产出带 shebang 的 `dist/cli.js`；README 说明 `~/.local/bin` symlink | P2 | `npm run build` | **Completed** |

## 4. 技术设计决策

### 4.1 Core 解耦
- 新增 `src/core/*`：纯 TypeScript，不 import `obsidian`。
- 文件系统通过 `FileSystemAdapter` 注入：
  - CLI：`NodeFileSystemAdapter`（`node:fs/promises`，路径相对 vault 根；绝对路径原样使用）。
  - 插件：`ObsidianVaultAdapter`（`vault.adapter` + `createFolder` / `getAbstractFileByPath`）。
- 进度/通知走回调，不使用 `Notice`。插件包装层在回调里调用 `Notice`，以保持现有 UI 行为。
- `S3Manager` 原本即无 Obsidian 依赖，core / CLI / 插件共用。

### 4.2 Ledger
- `SyncLedger` 读写任意给定路径，默认仍为 `<pluginDir>/ledger.json`。
- 保存：先写 `<path>.tmp`，再 `rename` 到目标路径。
- Obsidian 包装类继续接受 `Plugin`，内部委托 core，保证插件与 CLI 读写同一文件。

### 4.3 CLI 产物与安装
- esbuild 额外产出 Node 包：`platform=node`、`target=node18`、banner `#!/usr/bin/env node` → `dist/cli.js`。
- 现有 `dist/main.js` 插件构建流程不变。
- `package.json` `bin.obsidian-s3-sync` → `dist/cli.js`。
- 安装：将插件目录（或仓库 `dist/cli.js`）symlink 到 `~/.local/bin/obsidian-s3-sync`。

### 4.4 命令与输出
| 命令 | 作用 |
| :--- | :--- |
| `run`（默认） | 同步。`--dry-run` 只列出待下载不落盘、不改 ledger；`--force` 忽略 ledger；`--json` 输出 `{ downloaded, skippedCount, failed, success }` |
| `status` | ledger 条数 + 相对 S3 的待同步预览 |
| `test` | 必填配置/凭证检查 + `S3Manager.testConnection()` |

### 4.5 插件入口
- `main.ts` 仍通过现有 `SyncEngine` / `SyncLedger` 调用；二者改为委托 core，命令、定时器、Notice 文案保持等价。

## 5. 目录探测

解析顺序（命中即停）：

1. `--plugin-dir`（相对路径相对 vault 根；绝对路径直接使用）
2. `<vault>/.obsidian/plugins/obsidian-s3-remote-sync/`（插件市场发布后的目录名，与 `manifest.id` 一致）
3. `<vault>/.obsidian/plugins/remote-sync/`（开发期目录名）

`--vault` 定位 vault 根；未传时默认为 `process.cwd()`。配置文件与 ledger 均在解析出的插件目录下。

## 6. 凭证与配置优先级

每个字段独立按下列顺序取值（后者仅在前者为空时生效）：

1. **CLI flag**：`--endpoint` / `--region` / `--bucket` / `--prefix` / `--access-key` / `--secret-key` / `--local-base-path`
2. **环境变量**：
   - `S3_ENDPOINT`，别名 `AWS_ENDPOINT_URL`
   - `S3_REGION`，别名 `AWS_REGION`
   - `S3_BUCKET`
   - `S3_ACCESS_KEY_ID`，别名 `AWS_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`，别名 `AWS_SECRET_ACCESS_KEY`
3. **vault `data.json`**：
   - 普通字段：`endpoint` / `region` / `bucket` / `s3Prefix` / `localBasePath`
   - 凭证：仅当存在 `secrets` 字段时，对 `access-key-id` / `secret-access-key` 做 XOR `0x53` + Base64 解密（与 US-4.1 fallback 相同）

**预期限制**：Obsidian `SecretStorage` / 系统钥匙串中的密钥 CLI **读不到**。Agent 需通过 flag、环境变量，或让插件走 XOR fallback（`data.json.secrets`）提供凭证。

`region` 缺省为 `auto`；`localBasePath` 缺省为 `S3-Sync`（与插件 `DEFAULT_SETTINGS` 一致）。

## 7. 未来市场迁移兼容

| 阶段 | 插件目录 | CLI 行为 |
| :--- | :--- | :--- |
| 开发期 | `.obsidian/plugins/remote-sync/` | 市场目录不存在时回退到 `remote-sync` |
| 上架后 | `.obsidian/plugins/obsidian-s3-remote-sync/` | 优先市场目录（与 `manifest.id` 一致） |
| 两目录并存 | 两套 `data.json` / `ledger.json` 互相隔离 | 优先市场目录；旧 ledger **不会**自动合并 |

Obsidian 按插件目录隔离数据。从开发目录迁到市场目录时，需手动复制 `ledger.json`（以及若使用 XOR fallback，复制 `data.json` 的 `secrets`），否则 CLI/插件会把已抓取对象当成未同步。`--plugin-dir` 可显式指定任一目录，避免误探测。

## 8. 技术规格 (Tech Spec)
*   **入口**: `cli.ts` → `src/cli/*`；内核 `src/core/*`。
*   **构建**: `esbuild.config.mjs` 增加 Node 产物；`npm run build` 后 `dist/cli.js` 可执行。
*   **测试**: vitest 覆盖 ledger 原子读写、config 优先级、dry-run/force、注入 fake fs 的 core 引擎。不连真实 S3，不改外部 vault。

## 9. 待定问题
*   无。SecretStorage 对 CLI 不可见已记为预期限制，不在本 story 打通钥匙串。
