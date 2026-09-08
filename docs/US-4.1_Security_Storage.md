# PRD: US-4.1_Security_Storage (密钥安全存储)

## 1. 项目背景
*   **Story ID**: US-4.1
*   **Brief**: Security_Storage
*   **Description**: 作为用户，我想使用 Obsidian 原生的安全存储 API 来保存密钥，以便彻底防止密钥被同步或泄露。
*   **Status**: **Completed**

## 2. 核心流程 (Workflow)
1. 用户在设置界面输入密钥 (AK/SK)。
2. 插件优先调用 `this.app.saveSecret` 或 `this.app.secretStorage.setSecret`。
3. 如果原生存储成功，则明文不会写入 `data.json`。
4. **Fallback 机制**: 如果原生 API 调用失败（如版本限制或 ID 格式错误），插件自动降级为使用 **XOR (0x53) + Base64** 混淆后保存在 `data.json` 的 `secrets` 字段中。
5. 每次加载设置时，插件会尝试从两个源恢复密钥。

## 3. 验收标准 (Acceptance Criteria)
| ID | 描述 (Description) | 优先级 | 状态 |
| :--- | :--- | :--- | :--- |
| AC-4.1 | 优先使用系统 Keychain 存储。 | P1 | **Completed** |
| AC-4.2 | 若系统 API 失败，必须有混淆后的 Fallback 存储。 | P1 | **Completed** |
| AC-4.3 | 设置界面支持通过“眼睛”图标切换显示/隐藏明文。 | P2 | **Completed** |

## 4. 技术规格 (Tech Spec)
*   **Native Keys**: `obsidian-s3-remote-sync-access-key-id`, `obsidian-s3-remote-sync-secret-access-key` (强制小写+连字符)。
*   **API**: `this.app.saveSecret` / `this.app.secretStorage.setSecret` (探测多种变体：`save`, `setSecret`, `setItem`, `store`)。
*   **Fallback 混淆**: `XOR 0x53` -> `Base64`。

## 5. 备注
*   **版本兼容性**: 虽然原生 API 推荐 v1.11.0+，但通过 Fallback 机制，旧版本或受限环境也能安全运行。
