# S3 Remote Sync

**English** | [中文](README.zh.md)

If your notes land in S3 first—inbox dumps, voice memos, a shared bucket—you want them in Obsidian without a two-way sync that overwrites local edits or brings deleted files back. **S3 Remote Sync** is a one-way, **sync-once** pull: each object is fetched a single time, recorded in a ledger, then left for you to move, edit, or delete. The same engine ships as an **Agent CLI**, so scripts and AI agents can trigger that fetch-once sync from a terminal without opening Obsidian.

## Features

- **Sync-once (fetch-once)** — downloaded S3 keys are stored in `ledger.json`; later syncs skip them even if you removed the local file
- **One-way S3 → vault** — mirrors prefix folders into a local base path; no upload
- **Agent CLI** — `obsidian-s3-sync run|status|test` with `--json` and stable exit codes for automation
- **Shared state** — plugin and CLI use the same ledger (and the same `data.json` when present)
- **S3-compatible** — AWS, R2, MinIO, Supabase Storage, and other path-style endpoints
- **Credentials** — Obsidian SecretStorage in the app; CLI uses flags, `S3_*` / `AWS_*` env, or XOR fallback in `data.json`

## Installation

```bash
npm install
npm run build
```

Artifacts in `dist/`:

- `dist/main.js`
- `dist/manifest.json`
- `dist/cli.js` (Agent CLI, shebang `#!/usr/bin/env node`)

### Install the plugin

1. Open `<YourVault>/.obsidian/plugins/` (`.obsidian` is hidden).
2. Create a folder named `obsidian-s3-remote-sync`.
3. Copy `main.js`, `manifest.json`, and `cli.js` from `dist/` into that folder.
4. In Obsidian: **Settings → Community Plugins → Refresh**, then enable **S3 Remote Sync**.

### Configure

**Settings → S3 Remote Sync**

| Setting | Purpose |
| :--- | :--- |
| Endpoint / Region / Bucket | S3-compatible connection |
| Access Key / Secret Key | Stored in the OS keychain via SecretStorage (not plaintext in the vault) |
| S3 Prefix | Optional folder in the bucket (e.g. `notes/`) |
| Local Base Path | Vault folder to write into (e.g. `Inbox`) |
| Sync Interval | Background pull interval in minutes (`0` disables) |
| Force Re-download | Ignore the ledger and pull everything again |

Command palette: **S3 Remote Sync: Start Sync**.

## Agent CLI

Use the same sync-once engine when Obsidian is closed—handy for cron, CI, or an AI agent.

### Install (symlink)

```bash
# After npm run build, from this repo
ln -sf "$(pwd)/dist/cli.js" ~/.local/bin/obsidian-s3-sync

# Or from a vault plugin folder
ln -sf "/path/to/vault/.obsidian/plugins/obsidian-s3-remote-sync/cli.js" ~/.local/bin/obsidian-s3-sync
```

Ensure `~/.local/bin` is on `PATH`. After `npm install` in this repo you can also run `npx obsidian-s3-sync`.

### Usage

```bash
obsidian-s3-sync --vault /path/to/vault
obsidian-s3-sync run --vault /path/to/vault --dry-run --json
obsidian-s3-sync status --vault /path/to/vault
obsidian-s3-sync test --vault /path/to/vault
```

Plugin directory: `--plugin-dir` > `<vault>/.obsidian/plugins/obsidian-s3-remote-sync/` > `<vault>/.obsidian/plugins/remote-sync/`.

Config priority: CLI flags (`--endpoint`, `--region`, `--bucket`, `--prefix`, `--access-key`, `--secret-key`, …) > `S3_*` env (aliases `AWS_ENDPOINT_URL` / `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) > XOR `secrets` in plugin `data.json` when that field exists.

Keys stored only in Obsidian SecretStorage are **not** visible to the CLI. For agents, pass flags or env vars.

Exit codes: `0` success (including nothing new) · `1` missing config / lock · `2` S3 network or auth · `3` local write error.

## Development

```bash
npm test
npm run test:watch
```
