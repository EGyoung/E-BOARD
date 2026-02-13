import { BaseRender } from "src/elements/baseElement/baseRender";
import type { IServiceInitParams } from "../../types";

export type IElementService = {
  init: (params: IServiceInitParams) => void;
  registerElement: (shape: IElement<any>) => void;
  getElement: (type: string) => IElement<any> | undefined;
  getAllElement: () => IElement<any>[];
  dispose: () => void;
}
export const IElementService = Symbol("IElementService");

export interface IElement<T extends Record<string, any> = Record<string, any>> {
  type: string;
  ctrlElement: any;
  saveInfoProvider: any
  render: new (board: any) => BaseRender<T>;
}
