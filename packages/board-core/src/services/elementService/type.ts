import { BaseRender } from "src/elements/baseElement/baseRender";
import type { IServiceInitParams } from "../../types";

export type IElementService = {
  init: (params: IServiceInitParams) => void;
  registerElement: <T extends Record<string, any>>(shape: IElement<T>) => void;
  getElement: <T extends Record<string, any>>(type: string) => IElement<T> | undefined;
  getAllElement: <T extends Record<string, any>>() => IElement<T>[];
  dispose: () => void;
}
export const IElementService = Symbol("IElementService");

export interface IElement<T extends Record<string, any> = Record<string, any>> {
  type: string;
  ctrlElement: any;
  saveInfoProvider: any
  render: new (board: any) => BaseRender<T>;
}
