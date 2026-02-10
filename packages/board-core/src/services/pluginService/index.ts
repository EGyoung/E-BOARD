import { getDefaultPlugins } from "../../common/getDefaultPlugins";
import { CorePlugins, IBoard, IServiceInitParams } from "../../types";
import { IPluginService } from "./type";
import { IPlugin, IPluginInitParams } from "../../plugins/type";

interface IPluginConstructor {
  new(p: IPluginInitParams): IPlugin;
}

export class PluginService implements IPluginService {
  private plugins: Map<string, IPlugin> = new Map();
  private board!: IBoard;
  private pendingPlugins: Map<
    string,
    {
      pluginClass: IPluginConstructor;
      dependencies: string[];
    }
  > = new Map();

  private registerPlugins(plugins?: Array<IPluginConstructor>) {
    const DEFAULT_PLUGINS = getDefaultPlugins();
    // 注册初始插件
    const allPlugins = [
      ...(this.board.config.disableDefaultPlugins ? [] : Object.values(DEFAULT_PLUGINS)),
      ...(plugins || [])
    ];

    // 第一步：收集所有插件及其依赖关系
    allPlugins.forEach(PluginClass => {
      try {
        // 临时实例化插件以获取插件名称和依赖关系
        const tempPlugin = new PluginClass({ board: this.board });
        if (!tempPlugin.pluginName) {
          throw new Error("Plugin must have a pluginName");
        }

        // 添加到待处理插件队列
        this.pendingPlugins.set(tempPlugin.pluginName, {
          pluginClass: PluginClass,
          dependencies: tempPlugin.dependencies || []
        });
      } catch (error) {
        console.error(`Failed to collect plugin info:`, error);
      }
    });

    // 第二步：按照依赖顺序注册插件
    this.registerPluginsInOrder();
  }

  /**
   * 按照依赖顺序注册插件
   */
  private registerPluginsInOrder() {
    // 已注册的插件集合
    const registered = new Set<string>();
    // 当前处理路径，用于检测循环依赖
    const processingPath: string[] = [];

    // 内部递归函数，用于按依赖顺序注册插件
    const registerWithDependencies = (pluginName: string): boolean => {
      // 检查是否已经注册
      if (registered.has(pluginName)) {
        return true;
      }

      // 检查循环依赖
      if (processingPath.includes(pluginName)) {
        console.error(
          `Circular dependency detected: ${processingPath.join(" -> ")} -> ${pluginName}`
        );
        return false;
      }

      const pending = this.pendingPlugins.get(pluginName);
      // 如果插件不在待处理列表中，可能是核心插件或已经注册
      if (!pending) {
        return this.plugins.has(pluginName);
      }

      // 标记为正在处理
      processingPath.push(pluginName);

      // 先处理所有依赖
      const { dependencies, pluginClass } = pending;
      const allDepsRegistered = dependencies.every(dep => registerWithDependencies(dep));

      // 依赖无法满足，跳过注册
      if (!allDepsRegistered) {
        console.warn(`Skip registering ${pluginName} due to missing dependencies`);
        processingPath.pop();
        return false;
      }

      // 依赖都已注册，现在注册当前插件
      this.doRegisterPlugin(pluginClass);
      registered.add(pluginName);
      processingPath.pop();
      return true;
    };

    // 逐个处理所有待注册的插件
    for (const pluginName of this.pendingPlugins.keys()) {
      registerWithDependencies(pluginName);
    }

    this.pendingPlugins.clear();
  }

  /**
   * 实际执行插件注册的方法
   */
  private doRegisterPlugin(PluginClass: new ({ board }: IPluginInitParams) => IPlugin) {
    try {
      const plugin = new PluginClass({ board: this.board });
      if (!plugin.pluginName) {
        throw new Error("Plugin must have a pluginName");
      }

      // 检查插件名称是否已存在
      if (this.plugins.has(plugin.pluginName)) {
        return console.warn(`Plugin with name ${plugin.pluginName} already exists, skipping registration`);
      }

      this.plugins.set(plugin.pluginName, plugin);

      // 如果画板已经初始化，立即初始化插件
      if (this.board.getCanvas()) {
        plugin.init({ board: this.board });
      }

      console.log(`Plugin ${plugin.pluginName} registered successfully`);
      return true;
    } catch (error) {
      console.error("Failed to register plugin:", error);
      return false;
    }
  }

  public registerPlugin(PluginClass: new ({ board }: IPluginInitParams) => IPlugin) {
    // 获取插件依赖信息
    try {
      const tempPlugin = new PluginClass({ board: this.board });
      const pluginName = tempPlugin.pluginName;
      const dependencies = tempPlugin.dependencies || [];

      if (!pluginName) {
        throw new Error("Plugin must have a pluginName");
      }

      // 检查所有依赖是否已满足
      const missingDeps = dependencies.filter(dep => !this.plugins.has(dep));
      if (missingDeps.length > 0) {
        console.warn(`Plugin ${pluginName} has missing dependencies: ${missingDeps.join(", ")}`);
        console.warn("Adding to pending plugins queue");

        // 将插件添加到待处理队列
        this.pendingPlugins.set(pluginName, {
          pluginClass: PluginClass,
          dependencies
        });
        return;
      }

      // 所有依赖都已满足，可以直接注册
      this.doRegisterPlugin(PluginClass);
    } catch (error) {
      console.error("Failed to register plugin:", error);
    }
  }

  init(p: IServiceInitParams): void {
    this.board = p.board;
    this.registerPlugins(this.board.config.plugins);
  }

  dispose(): void {
    // 按照依赖关系逆序销毁插件
    // 构建依赖图
    const dependencyGraph: Map<string, string[]> = new Map();

    // 收集所有插件的反向依赖
    this.plugins.forEach((plugin, name) => {
      const deps = plugin.dependencies || [];
      deps.forEach(dep => {
        if (!dependencyGraph.has(dep)) {
          dependencyGraph.set(dep, []);
        }
        const dependents = dependencyGraph.get(dep);
        if (dependents) {
          dependents.push(name);
        }
      });

      // 确保每个插件都有一个条目，即使没有反向依赖
      if (!dependencyGraph.has(name)) {
        dependencyGraph.set(name, []);
      }
    });

    // 逆拓扑排序销毁插件
    const visited = new Set<string>();
    const disposedOrder: string[] = [];

    const disposePlugin = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      // 先销毁依赖于此插件的其他插件
      const dependents = dependencyGraph.get(name) || [];
      dependents.forEach(dep => disposePlugin(dep));

      // 销毁当前插件
      const plugin = this.plugins.get(name);
      if (plugin) {
        console.log(`Disposing plugin: ${name}`);
        plugin.dispose();
        this.plugins.delete(name);
      }

      disposedOrder.push(name);
    };

    // 从每个根节点开始销毁
    this.plugins.forEach((_, name) => {
      disposePlugin(name);
    });

    console.log(`Disposed plugins in order: ${disposedOrder.join(", ")}`);
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

    // 检查是否有其他插件依赖于此插件
    const dependents: string[] = [];
    this.plugins.forEach((plugin, pluginName) => {
      if (plugin.dependencies?.includes(name)) {
        dependents.push(pluginName);
      }
    });

    if (dependents.length > 0) {
      console.warn(
        `Cannot remove plugin ${name} because it is required by: ${dependents.join(", ")}`
      );
      return;
    }

    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.dispose();
      this.plugins.delete(name);
      console.log(`Plugin ${name} removed`);
    }
  }

  public getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 检查指定插件的依赖是否已全部满足
   */
  public areDependenciesSatisfied(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    const pending = this.pendingPlugins.get(pluginName);

    if (!plugin && !pending) {
      return false;
    }

    const dependencies = plugin ? plugin.dependencies || [] : pending ? pending.dependencies : [];

    return dependencies.every(dep => this.plugins.has(dep));
  }

  /**
   * 获取插件的依赖
   */
  public getPluginDependencies(pluginName: string): string[] {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return [];
    }
    return plugin.dependencies || [];
  }

  /**
   * 获取依赖于指定插件的所有插件
   */
  public getPluginDependents(pluginName: string): string[] {
    const dependents: string[] = [];
    this.plugins.forEach((plugin, name) => {
      if (plugin.dependencies?.includes(pluginName)) {
        dependents.push(name);
      }
    });
    return dependents;
  }
}

export default PluginService;
