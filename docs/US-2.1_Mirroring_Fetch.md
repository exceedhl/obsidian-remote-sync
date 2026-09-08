# PRD: US-2.1_Mirroring_Fetch (目录镜像抓取)

## 1. 项目背景
*   **Story ID**: US-2.1
*   **Brief**: Mirroring_Fetch
*   **Description**: 作为用户，我想将 S3 中的目录结构同步到本地，以便保持笔记组织方式一致。
*   **Status**: **Pending**

## 2. 核心流程 (Workflow)
1. 插件启动或接收到同步指令。
2. 插件调用 `ListObjectsV2` 获取指定 Prefix 下的所有对象。
3. 对每个 Object Key，移除 S3 Prefix，解析其所属文件夹路径。
4. 在 Obsidian 库中递归创建对应的文件夹（如果不存在）。
5. 将 Object 内容下载并写入本地对应的文件路径。

## 3. 验收标准 (Acceptance Criteria)
| ID | 描述 (Description) | 优先级 | 验证方式 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| AC-2.1 | 自动递归创建本地子文件夹结构 | P1 | 集成测试 | **Pending** |
| AC-2.2 | 正确处理 S3 前缀和本地 Base Path 的拼接 | P1 | 功能测试 | **Pending** |
| AC-2.3 | 同步完成后通过 Obsidian Notice 提醒下载的文件总数 | P2 | UI 测试 | **Pending** |

## 4. 技术规格 (Tech Spec)
*   **逻辑**: 
    - 使用 `this.app.vault.createFolder` 处理目录创建。
    - 使用 `this.app.vault.adapter.write` 或 `create` 写入文件内容。
*   **限制**: 同步应为单向下载（S3 -> 本地）。

## 5. 待定问题
*   如果本地已存在同名但内容不同的文件，是否覆盖（当前策略是仅在台账不存在时下载）？
