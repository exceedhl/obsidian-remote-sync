# PRD: US-3.1_Command_Sync (手动同步指令)

## 1. 项目背景
*   **Story ID**: US-3.1
*   **Brief**: Command_Sync
*   **Description**: 作为用户，我想通过命令面板触发同步，以便我可以控制同步的时机。
*   **Status**: **Pending**

## 2. 核心流程 (Workflow)
1. 用户按下 `Cmd/Ctrl + P` 打开命令面板。
2. 输入 "S3 Fetch Sync: Start Sync"。
3. 选择指令，触发同步任务。
4. 插件开始执行同步逻辑（US-2.1/5.1）。

## 3. 验收标准 (Acceptance Criteria)
| ID | 描述 (Description) | 优先级 | 验证方式 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| AC-3.1 | 指令面板可搜索到对应的命令 | P1 | UI 测试 | **Pending** |
| AC-3.2 | 执行命令时，右下角弹出 Notice 显示 "Sync started..." | P2 | UI 测试 | **Pending** |

## 4. 技术规格 (Tech Spec)
*   **接口**: 调用 `this.addCommand()` 注册命令。
*   **入口**: 绑定到插件主类的 `runSync()` 方法。

## 5. 待定问题
*   是否需要增加 Ribbon 图标作为常驻入口（当前需求保持侧边栏简洁，故暂不添加）？
