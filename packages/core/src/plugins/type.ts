import { IBoard } from "../types";

export interface IPluginInitParams {
  board: IBoard;
}

export interface IPlugin<Exports = any> {
  pluginName: string;
  init(params: IPluginInitParams): void;
  dispose(): void;
  dependencies?: string[]; // 依赖的插件列表
  exports?: Exports
}
