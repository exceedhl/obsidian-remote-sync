# Remote Sync 用户故事 (User Stories)

遵循 `/create-backlog` 原则，将 `docs/sync-req.md` 中的需求转化为可落地的开发需求。

## 1. 解析旅程阶段 (User Journey Stages)
- **Discover (配置与连接)**: 用户安装插件，配置 S3 凭证并验证连接。
- **Activation (首次抓取)**: 用户触发同步，插件镜像 S3 结构并下载笔记。
- **Retention (增量同步与台账)**: 用户日常使用，插件自动或手动运行，确保“仅下载一次”并记录台账。
- **Safety (安全加固)**: 插件对敏感信息进行混淆，确保 `data.json` 的安全性。
- **Automation (Agent CLI)**: 不打开 Obsidian，由终端 / AI agent 触发同一套 fetch-once 同步。

## 2. 用户故事总表

| ID | 简介 (Brief) | User Story (用户故事) | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| US-1.1 | S3 连接配置 | 作为用户，我想在设置界面输入 S3 凭证，以便插件能访问我的存储桶。 | 1. 提供 Endpoint, Region, Bucket, AK, SK 输入框。<br>2. 点击“验证”按钮显示连接成功/失败反馈。 | **Done** |
| US-2.1 | 目录镜像抓取 | 作为用户，我想将 S3 中的目录结构同步到本地，以便保持笔记组织方式一致。 | 1. 自动递归创建本地缺少的子文件夹。<br>2. 支持配置 S3 前缀 (Prefix) 和本地目标路径 (Base Path)。 | **Done** |
| US-3.1 | 手动同步指令 | 作为用户，我想通过命令面板触发同步，以便我可以控制同步的时机。 | 1. Command Palette 中可搜索到 "S3 Fetch Sync: Start Sync"。 | **Done** |
| US-4.1 | 密钥安全存储 | 作为用户，我想使用 Obsidian 原生的安全存储 API 来保存密钥，以便彻底防止密钥被同步或泄露。 | 1. 优先使用 `loadSecret` / `saveSecret`。<br>2. 兼容性 Fallback 使用 XOR 混淆存储。 | **Done** |
| US-5.1 | 持久化同步台账 | 作为用户，我希望删除本地文件后不再被重新下载，以便我能自由管理本地空间。 | 1. 下载成功的 S3 Key 记录在 `ledger.json` 中。<br>2. 校验 Ledger 跳过重复下载。 | **Done** |
| US-6.1 | 定时自动运行 | 作为用户，我希望插件在后台静默同步，以便我总能得到最新的 S3 笔记。 | 1. 设置页可配置同步间隔 (分钟)。 | **Done** |
| US-7.1 | Agent CLI | 作为 Agent，我想在不打开 Obsidian 时通过 CLI 触发同一套 S3 拉取同步，以便终端与 AI agent 能自动化同步。 | 1. CLI 支持 run/status/test。<br>2. 配置优先级：flag > env > data.json XOR。<br>3. 与插件共享 ledger，探测 market/dev 插件目录。 | **Done** |

## 3. 技术落地计划 (Technical Implementation Plan)

### US-1.1 & US-4.1 (连接与安全)
- **Step 1**: 初始化 Obsidian 插件模板，定义 `RemoteSyncSettings` 接口。
- **Step 2**: 实现 `SecretManager` 类，封装 `this.app.loadSecret` 和 `this.app.saveSecret` (Obsidian v1.11.0+ 接口)。
- **Step 3**: 在设置页面实现 AK/SK 的“脱敏显示”逻辑 (点击眼睛图标查看/编辑)。
- **Step 4**: 集成 `@aws-sdk/client-s3`，编写 `S3ClientManager` 负责验证连接。

### US-2.1 & US-5.1 (镜像与台账)
- **Step 4**: 实现 `SyncLedger` 类，负责读写已同步 Key 的列表。
- **Step 5**: 编写 `SyncEngine` 核心逻辑：`ListObjectsV2` -> 过滤 Ledger -> 创建本地 Folder -> 下载并写入 `TFile` -> 更新 Ledger。

### US-3.1 & US-6.1 (交互与自动化)
- **Step 6**: 注册 `addCommand` 到 Obsidian。
- **Step 7**: 实现 `AutoSyncScheduler`，根据配置的间隔调用 `SyncEngine.run()`。

### US-7.1 (Agent CLI)
- **Step 8**: 将 `SyncEngine` / `SyncLedger` 抽成零 Obsidian 依赖的 core，FS 通过 adapter 注入。
- **Step 9**: 增加 Node CLI（`run` / `status` / `test`），配置优先级 flag > env > XOR fallback，与插件共享 `ledger.json`。
- **Step 10**: esbuild 产出带 shebang 的 `dist/cli.js`，README 说明 `~/.local/bin` symlink。
