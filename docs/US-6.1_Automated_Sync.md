# PRD: US-6.1_Automated_Sync (定时自动运行)

## 1. 项目背景
*   **Story ID**: US-6.1
*   **Brief**: Automated_Sync
*   **Description**: 作为用户，我希望插件在后台静默同步，以便我总能得到最新的 S3 笔记。
*   **Status**: **Pending**

## 2. 核心流程 (Workflow)
1. 插件加载，读取定时配置。
2. 启动一个后台定时器（Interval）。
3. 定时器触发后，调用 `SyncEngine`。
4. 如果此时已有同步任务正在进行，则跳过本次循环或排队。
5. 静默运行，不弹出干扰性的 Notice，仅在控制台记录日志。

## 3. 验收标准 (Acceptance Criteria)
| ID | 描述 (Description) | 优先级 | 验证方式 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| AC-6.1 | 设置界面可配置同步频率（如 5, 10, 30 分钟） | P1 | UI 测试 | **Pending** |
| AC-6.2 | 插件在后台按指定间隔自动执行同步 | P1 | 长期运行测试 | **Pending** |
| AC-6.3 | 自动同步过程不弹窗，不干扰用户编辑体验 | P2 | UI 测试 | **Pending** |

## 4. 技术规格 (Tech Spec)
*   **实现**: `window.setInterval(callback, minutes * 60 * 1000)`。
*   **管理**: 需在 `onunload` 时显式 `clearInterval` 防止内存泄露。

## 5. 待定问题
*   是否需要支持 Cron 表达式？初步仅支持简单的分钟间隔。
