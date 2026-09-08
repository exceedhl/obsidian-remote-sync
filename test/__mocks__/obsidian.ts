import { vi } from 'vitest';

export const App = vi.fn();
export const Notice = vi.fn();
export class TFolder { }
export const normalizePath = (path: string) => path;
export class DataAdapter {
    writeBinary = vi.fn();
    remove = vi.fn();
}
export class Plugin {
    app: any;
    manifest: any;
    constructor(app: any, manifest: any) {
        this.app = app;
        this.manifest = manifest;
    }
    loadData = vi.fn();
    saveData = vi.fn();
}
export class PluginSettingTab {
    constructor(app: any, plugin: any) { }
}
export class Setting {
    constructor(containerEl: HTMLElement) { }
    setName = vi.fn().mockReturnThis();
    setDesc = vi.fn().mockReturnThis();
    addText = vi.fn().mockReturnThis();
    addToggle = vi.fn().mockReturnThis();
    addButton = vi.fn().mockReturnThis();
}
