import { getDefaultPlugins } from "../../common/getDefaultPlugins";
import { CorePlugins, IBoard, IPlugin, IPluginInitParams, IServiceInitParams } from "../../types";
import { IPluginService } from "./type";

export class PluginService implements IPluginService {
  private plugins: Map<string, IPlugin> = new Map();
  private board!: IBoard;

  private registerPlugins(plugins?: Array<new ({ board }: IPluginInitParams) => IPlugin>) {
    const DEFAULT_PLUGINS = getDefaultPlugins();
    // // 注册初始插件
    const allPlugins = [
      ...(this.board.config.disableDefaultPlugins ? [] : Object.values(DEFAULT_PLUGINS)),
      ...(plugins || [])
    ];
    allPlugins.forEach(plugin => this.registerPlugin(plugin));
  }

  public registerPlugin(PluginClass: new ({ board }: IPluginInitParams) => IPlugin) {
    try {
      const plugin = new PluginClass({ board: this.board });
      if (!plugin.pluginName) {
        throw new Error("Plugin must have a pluginName");
      }

      // 检查插件名称是否已存在
      if (this.plugins.has(plugin.pluginName)) {
        throw new Error(`Plugin with name ${plugin.pluginName} already exists`);
      }

      this.plugins.set(plugin.pluginName, plugin);

      // 如果画板已经初始化，立即初始化插件
      if (this.board.getCanvas()) {
        plugin.init({ board: this.board });
      }
    } catch (error) {
      console.error("Failed to register plugin:", error);
    }
  }

  init(p: IServiceInitParams): void {
    this.board = p.board;
    this.registerPlugins(this.board.config.plugins);
  }

  dispose(): void {
    console.log("ModelService dispose");
  }

  public isCorePlugin(name: string): boolean {
    return Object.values(CorePlugins).includes(name as any);
  }

  public removePlugin(name: string) {
    // 防止移除核心插件
    if (this.isCorePlugin(name) && !this.board.config.disableDefaultPlugins) {
      console.warn(`Cannot remove core plugin: ${name}`);
      return;
    }

    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.dispose();
      this.plugins.delete(name);
    }
  }

  public getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }
}

export default PluginService;
