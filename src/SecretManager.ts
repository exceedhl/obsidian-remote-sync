import { App, Plugin } from 'obsidian';
import { deobfuscateSecret, obfuscateSecret } from './core/secrets';

export class SecretManager {
	private app: App;
	private plugin: Plugin;
	private prefix = 'obsidian-s3-remote-sync-';

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * Save a secret (e.g., Access Key or Secret Key)
	 */
	async saveSecret(key: string, value: string): Promise<void> {
		const fullKey = this.prefix + key;
		const app = this.app as any;

		try {
			// 1. Try Native SecretStorage API (v1.11.0+)
			if ('saveSecret' in app) {
				await app.saveSecret(fullKey, value);
				console.log(`S3 Sync: "${key}" saved via app.saveSecret`);
				return;
			}

			const ss = app.secretStorage;
			if (ss) {
				const saveFn = ss.setSecret || ss.save || ss.setItem || ss.store;
				if (typeof saveFn === 'function') {
					await saveFn.call(ss, fullKey, value);

					// Test if we can read it back. If blocked by OS, this returns null/throws
					let verifySuccess = false;
					try {
						const loadFn = ss.getSecret || ss.load || ss.getItem || ss.get;
						if (typeof loadFn === 'function') {
							const testVal = await loadFn.call(ss, fullKey);
							if (testVal !== null && testVal !== undefined) verifySuccess = true;
						}
					} catch (e) { }

					if (verifySuccess) {
						console.log(`S3 Sync: "${key}" saved via app.secretStorage (method detected)`);
						return;
					} else {
						console.warn(`S3 Sync: "${key}" written to app.secretStorage, but verify read failed. Falling back.`);
					}
				}
			}
		} catch (e: any) {
			console.warn(`Native SecretStorage failed for "${key}":`, e.message);
		}

		// 2. Fallback to Plugin Data with XOR Obfuscation
		console.warn(`Falling back to obfuscated local storage for "${key}".`);
		const data = await this.plugin.loadData() || {};
		if (!data.secrets) data.secrets = {};
		data.secrets[key] = obfuscateSecret(value);
		await this.plugin.saveData(data);
	}

	/**
	 * Load a secret
	 */
	async loadSecret(key: string): Promise<string | null> {
		const fullKey = this.prefix + key;
		const app = this.app as any;

		try {
			// 1. Try Native SecretStorage API
			if ('loadSecret' in app) {
				const val = await app.loadSecret(fullKey);
				if (val) console.log(`S3 Sync: "${key}" loaded via app.loadSecret`);
				return val;
			}

			const ss = app.secretStorage;
			if (ss) {
				const loadFn = ss.getSecret || ss.load || ss.getItem || ss.get;
				if (typeof loadFn === 'function') {
					const val = await loadFn.call(ss, fullKey);
					if (val) console.log(`S3 Sync: "${key}" loaded via app.secretStorage (method detected)`);
					if (val !== null && val !== undefined) return val;
				}
			}
		} catch (e: any) {
			console.warn(`Native SecretStorage load failed for "${key}":`, e.message);
		}

		// 2. Fallback to Plugin Data
		const data = await this.plugin.loadData();
		if (data && data.secrets && data.secrets[key]) {
			try {
				return deobfuscateSecret(data.secrets[key]);
			} catch (e) {
				return null;
			}
		}
		return null;
	}

	/**
	 * Delete a secret
	 */
	async deleteSecret(key: string): Promise<void> {
		const fullKey = this.prefix + key;
		const app = this.app as any;

		try {
			if (app.removeSecret) {
				await app.removeSecret(fullKey);
			} else if (app.deleteSecret) {
				await app.deleteSecret(fullKey);
			} else if (app.secretStorage) {
				const ss = app.secretStorage;
				const deleteFn = ss.deleteSecret || ss.removeSecret || ss.delete || ss.removeItem;
				if (typeof deleteFn === 'function') {
					await deleteFn.call(ss, fullKey);
				}
			}
		} catch (e: any) {
			console.warn(`Native SecretStorage delete failed for "${key}":`, e.message);
		}

		const data = await this.plugin.loadData();
		if (data && data.secrets) {
			delete data.secrets[key];
			await this.plugin.saveData(data);
		}
	}

}
