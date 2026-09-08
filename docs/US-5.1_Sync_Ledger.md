# PRD: US-5.1_Sync_Ledger (持久化同步台账)

## 1. 项目背景
*   **Story ID**: US-5.1
*   **Brief**: Sync_Ledger
*   **Description**: 作为用户，我希望删除本地文件后不再被重新下载，以便我能自由管理本地空间。
*   **Status**: **Pending**

## 2. 核心流程 (Workflow)
1. 同步引擎准备下载 S3 对象。
2. 引擎检查本地台账（Ledger）是否已包含该对象的 ETag 或 Key。
3. 如果已存在，则跳过下载。
4. 如果不存在，下载文件并更新台账。
5. 定期将台账持久化到磁盘。

## 3. 验收标准 (Acceptance Criteria)
| ID | 描述 (Description) | 优先级 | 验证方式 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| AC-5.1 | 已下载过的 Key 记录在 `ledger.json` 中 | P1 | 集成测试 | **Pending** |
| AC-5.2 | 手动删除本地笔记后，再次同步不会重新下载同一 Key | P1 | 场景测试 | **Pending** |
| AC-5.3 | 开启 “Force Re-download” 开关后，忽略台账进行全量同步 | P2 | 功能测试 | **Pending** |

## 4. 技术规格 (Tech Spec)
*   **数据结构**: `Map<string, string>` (Key -> ETag)。
*   **存储**: 使用 `this.saveData('ledger.json', ...)` 存储在插件目录下。

## 5. 待定问题
*   如果 S3 侧的文件内容更新了（ETag 变了），是否应该自动重新下载？根据“一次性抓取”需求，默认不下载，但可作为后续增强。
