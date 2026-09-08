# Obsidian S3 单向“一次性抓取”同步需求与方案 (插件版)

本文档定义了将笔记从 S3 存储同步到本地 Obsidian 库的插件化方案：**支持目录镜像、只下载一次、本地自由修改、定时自动运行**。

## 1. 用户核心需求 (插件增强版)

- **插件化形态**：作为 Obsidian Community Plugin 运行，提供设置界面和状态显示。
- **目录镜像同步**：自动递归创建本地子文件夹。
- **手动同步指令 (Manual Sync Command)**：
    - 提供一个快捷指令（Command Palette 中的 "S3 Fetch Sync: Start Sync"）。
    - 仅通过指令面板触发，保持侧边栏简洁。
- **配置安全 (Security & Obfuscation)**：
    - 对保存在 `data.json` 中的 S3 Access Key 和 Secret Key 进行混淆处理。
    - 确保密钥在磁盘文件上非明文可见，防止因配置文件同步（如 Git/iCloud）导致的安全风险。
- **持久化“仅限一次”策略**：即使本地删除了该文件，后续同步也不得重新下载。
- **定时自动运行**：支持后台静默执行下载。

## 2. 插件实现方案

### 核心功能模块
1.  **配置页面 (Settings Tab)**：
    - S3 配置：Endpoint, Region, Bucket, Access Key, Secret Key.
    - 路径配置：S3 前缀 (Prefix), 本地目标文件夹 (Base Path).
    - 同步配置：定时频率 (Minutes), 强制重新下载开关 (Force).
2.  **S3 处理器 (S3 Processor)**：
    - 使用 `@aws-sdk/client-s3` 进行通信。
    - 递归列出所有 Keys，解析目录结构。
3.  **持久化台账 (Ledger)**：
    - 使用 Obsidian 提供的 `this.saveData()` 接口，将已下载的 Key 列表存储在插件数据目录下，确保清理本地文件不影响台账记录。
4.  **调度器 (Scheduler)**：
    - 使用 `window.setInterval` 实现插件生命周期内的定时任务。

### 目录处理逻辑
- 获取 S3 Key: `notes/work/project_a.md`
- 本地 Base Path: `Inbox`
- 目标路径逻辑:
    1. 移除 S3 前缀。
    2. 创建文件夹路径：`Inbox/work/`（如果不存在）。
    3. 写入文件：`Inbox/work/project_a.md`。

## 3. 技术栈建议
- **语言**: TypeScript (Obsidian API 标准).
- **依赖**: 
    - `@aws-sdk/client-s3`: 用于 S3 API 调用。
    - `obsidian`: 官方 API 库。

## 4. 安全性说明
- 凭证应存储在 Obsidian 插件的 `data.json` 中。
- 建议用户使用具有 **最小权限 (Least Privilege)** 的 IAM 账号（仅限 S3 只读权限）。
