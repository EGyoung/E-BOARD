import { IPlugin } from "../../plugins/type";
import { IServiceInitParams, IPluginInitParams } from "../../types";

export const IPluginService = Symbol("IPluginService");

export interface IPluginService {
  /**
   * 初始化服务
   */
  init(params: IServiceInitParams): void;

  /**
   * 销毁服务
   */
  dispose(): void;

  /**
   * 注册插件
   */
  registerPlugin(PluginClass: new ({ board }: IPluginInitParams) => IPlugin): void;

  /**
   * 移除插件
   */
  removePlugin(name: string): void;

  /**
   * 获取指定名称的插件
   */
  getPlugin(name: string): IPlugin | undefined;

  /**
   * 检查指定插件的依赖是否已全部满足
   */
  areDependenciesSatisfied(pluginName: string): boolean;

  /**
   * 获取插件的依赖
   */
  getPluginDependencies(pluginName: string): string[];

  /**
   * 获取依赖于指定插件的所有插件
   */
  getPluginDependents(pluginName: string): string[];

  /**
   * 检查插件是否为核心插件
   */
  isCorePlugin(name: string): boolean;
}
