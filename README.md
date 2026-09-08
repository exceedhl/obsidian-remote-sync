# S3 Remote Sync for Obsidian

Native Obsidian plugin for S3 synchronization with a one-way, fetch-once strategy. Securely handles credentials using Obsidian's native `SecretStorage` API.

## 🚀 Installation & Deployment

### 1. Build the Plugin
If you haven't already, install dependencies and build the plugin from the source:
```bash
npm install
npm run build
```
This generates the delivery artifacts in the `dist/` directory:
- `dist/main.js`
- `dist/manifest.json`
- `dist/cli.js` (Agent CLI, shebang `#!/usr/bin/env node`)

### 2. Manual Installation
1.  **Locate your vault's plugin folder**: Open your file explorer and navigate to `<YourVault>/.obsidian/plugins/`.
    *(Note: `.obsidian` is a hidden folder. You may need to enable "Show hidden files" in your OS).*
2.  **Create a plugin directory**: Create a new folder named `obsidian-s3-remote-sync`.
3.  **Copy artifacts**: Copy `main.js`, `manifest.json`, and `cli.js` from the `dist/` folder into the newly created `obsidian-s3-remote-sync` folder in your vault.

### 3. Enable the Plugin
1.  Open Obsidian.
2.  Go to **Settings** > **Community Plugins**.
3.  Click the **Refresh** icon next to "Installed plugins".
4.  Find **S3 Remote Sync** in the list and toggle the switch to **On**.

## ⚙️ Configuration
1.  Go to **Settings** > **S3 Remote Sync**.
2.  **Endpoint**: Your S3-compatible service URL (e.g., `https://s3.amazonaws.com`).
3.  **Bucket**: The name of your bucket.
4.  **Access Key ID** & **Secret Access Key**: Your S3 credentials. These are stored securely in your system's Keychain/Credential Manager and are never stored in plaintext within your vault.
5.  **Local Base Path**: The folder in your vault where synced notes will be saved (e.g., `Inbox`).
6.  **S3 Prefix**: (Optional) The folder path in S3 to sync from (e.g., `notes/`).
7.  **Sync Interval**: Set how often (in minutes) you want the plugin to sync in the background.

## 🖥️ Agent CLI

The same fetch-once sync engine can run from a terminal without opening Obsidian. The CLI reads the plugin `data.json` / `ledger.json` so it shares state with the in-app plugin.

### Install (symlink)

After building, expose `cli.js` on your `PATH` via a thin symlink (create `~/.local/bin` if needed and ensure it is on `PATH`):

```bash
# From this repo
ln -sf "$(pwd)/dist/cli.js" ~/.local/bin/obsidian-s3-sync

# Or from a vault plugin directory (market id or dev folder)
ln -sf "/path/to/vault/.obsidian/plugins/obsidian-s3-remote-sync/cli.js" ~/.local/bin/obsidian-s3-sync
```

You can also run `npx obsidian-s3-sync` after `npm install` in this repo (`package.json` `bin` points at `dist/cli.js`).

### Usage

```bash
obsidian-s3-sync --vault /path/to/vault
obsidian-s3-sync run --vault /path/to/vault --dry-run --json
obsidian-s3-sync status --vault /path/to/vault
obsidian-s3-sync test --vault /path/to/vault
```

Plugin directory detection: `--plugin-dir` > `<vault>/.obsidian/plugins/obsidian-s3-remote-sync/` > `<vault>/.obsidian/plugins/remote-sync/`.

Config priority: CLI flags (`--endpoint`, `--region`, `--bucket`, `--prefix`, `--access-key`, `--secret-key`, …) > `S3_*` env vars (aliases `AWS_ENDPOINT_URL` / `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) > XOR-obfuscated `secrets` in the plugin `data.json` (only when that field exists). Keys stored solely in Obsidian SecretStorage are not readable by the CLI.

Exit codes: `0` success (including nothing new), `1` missing config/credentials, `2` S3 network/auth error, `3` local filesystem write error.

## 🧪 Development & Testing
To run the unit tests:
```bash
npm test
```
To run tests in watch mode:
```bash
npm run test:watch
```
