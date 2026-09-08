# PRD: US-1.1_S3_Settings (S3 连接配置)

## 1. 项目背景
*   **Story ID**: US-1.1
*   **Brief**: S3_Settings
*   **Description**: 作为用户，我想在设置界面输入 S3 凭证，以便插件能访问我的存储桶。
*   **Status**: **Pending**

## 2. 核心流程 (Workflow)
1. 用户打开 Obsidian 设置，找到 "Remote Sync" 插件选项卡。
2. 用户输入 Endpoint, Region, Bucket Name, Access Key 和 Secret Key。
3. 用户点击 “Test Connection” 按钮。
4. 插件使用提供的凭证调用 S3 `ListBuckets` 或 `HeadBucket` 接口。
5. 返回成功或错误提示。

## 3. 验收标准 (Acceptance Criteria)
| ID | 描述 (Description) | 优先级 | 验证方式 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| AC-1.1 | 包含所有必要的 S3 配置字段 (Endpoint, Region, Bucket, AK, SK) | P1 | UI 测试 | **Pending** |
| AC-1.2 | 点击“验证”按钮能实时反馈连接状态 | P1 | 功能测试 | **Pending** |
| AC-1.3 | 连接失败时，显示具体的错误信息（如 InvalidAccessKeyId） | P2 | 异常测试 | **Pending** |

## 4. 技术规格 (Tech Spec)
*   **API**: 使用 `@aws-sdk/client-s3` 中的 `S3Client`。
*   **存储**:
    - 通用配置：保存于 `data.json`。
    - 敏感凭证：AK/SK 无权存入 `data.json`，必须通过 `SecretStorage` API 安全存储（详见 US-4.1）。

## 5. 待定问题
*   是否需要支持自定义 S3 Path Style (Path-style vs Virtual-hosted style)？
