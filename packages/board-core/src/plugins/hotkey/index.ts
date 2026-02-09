import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import { getDefaultHotkeys } from "./defaultHotkeys";

export interface HotkeyHandler {
    (e: KeyboardEvent): void | boolean; // 返回 false 可以阻止默认行为
}

export interface HotkeyConfig {
    key: string; // 键名，如 'a', 'Delete', 'Escape'
    ctrl?: boolean; // 是否需要 Ctrl
    shift?: boolean; // 是否需要 Shift
    alt?: boolean; // 是否需要 Alt
    meta?: boolean; // 是否需要 Meta (Mac 的 Command 键)
    handler: HotkeyHandler; // 处理函数
    description?: string; // 快捷键描述
    preventDefault?: boolean; // 是否阻止默认行为，默认 true
}

class HotkeyPlugin implements IPlugin {
    private board!: IBoard;
    private disposeList: (() => void)[] = [];
    private hotkeyMap = new Map<string, HotkeyConfig>();
    private clipboard: any[] = []; // 内存剪贴板
    public dependencies = ['SelectionPlugin']
    public pluginName = "HotkeyPlugin";

    public exports = {
        register: this.register.bind(this),
        unregister: this.unregister.bind(this),
        getHotkeys: this.getHotkeys.bind(this)
    };

    public init({ board }: IPluginInitParams) {
        this.board = board;
        this.initHotkeyListener();
        this.registerDefaultHotkeys();
    }

    /**
     * 注册默认快捷键
     */
    private registerDefaultHotkeys() {
        const defaultHotkeys = getDefaultHotkeys(this.clipboard, this.board);
        this.registerMultiple(defaultHotkeys);
    }

    private initHotkeyListener() {


        const handleKeyDown = (e: KeyboardEvent) => {
            const hotkeyKey = this.generateHotkeyKey({
                key: e.key,
                ctrl: e.ctrlKey,
                shift: e.shiftKey,
                alt: e.altKey,
                meta: e.metaKey
            });

            const config = this.hotkeyMap.get(hotkeyKey);
            if (config) {
                const result = config.handler(e);

                // 如果 handler 返回 false 或者 preventDefault 为 true（默认），则阻止默认行为
                if (result === false || config.preventDefault !== false) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        this.disposeList.push(() => {
            window.removeEventListener("keydown", handleKeyDown);
        });
    }

    /**
     * 生成快捷键的唯一标识
     */
    private generateHotkeyKey(config: Omit<HotkeyConfig, 'handler' | 'description' | 'preventDefault'>): string {
        const parts: string[] = [];
        if (config.ctrl) parts.push("Ctrl");
        if (config.shift) parts.push("Shift");
        if (config.alt) parts.push("Alt");
        if (config.meta) parts.push("Meta");
        parts.push(config.key.toLowerCase());
        return parts.join("+");
    }

    /**
     * 注册快捷键
     */
    public register(config: HotkeyConfig): void {
        const hotkeyKey = this.generateHotkeyKey(config);

        if (this.hotkeyMap.has(hotkeyKey)) {
            console.warn(`快捷键 ${hotkeyKey} 已被注册，将被覆盖`);
        }

        this.hotkeyMap.set(hotkeyKey, config);
    }

    /**
     * 批量注册快捷键
     */
    public registerMultiple(configs: HotkeyConfig[]): void {
        configs.forEach(config => this.register(config));
    }

    /**
     * 注销快捷键
     */
    public unregister(config: Pick<HotkeyConfig, 'key' | 'ctrl' | 'shift' | 'alt' | 'meta'>): void {
        const hotkeyKey = this.generateHotkeyKey(config);
        this.hotkeyMap.delete(hotkeyKey);
    }

    /**
     * 获取所有已注册的快捷键
     */
    public getHotkeys(): Array<{ key: string; config: HotkeyConfig }> {
        return Array.from(this.hotkeyMap.entries()).map(([key, config]) => ({
            key,
            config
        }));
    }

    /**
     * 清空所有快捷键
     */
    public clear(): void {
        this.hotkeyMap.clear();
    }

    public dispose() {
        this.disposeList.forEach(dispose => dispose());
        this.disposeList = [];
        this.hotkeyMap.clear();
    }
}

export default HotkeyPlugin;
