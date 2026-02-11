import type { IServiceInitParams } from "../../types";

export type IElementService = {
  init: (params: IServiceInitParams) => void;
  registerElement: (shape: IElement) => void;
  getElement: (type: string) => IElement | undefined;
  getAllElement: () => IElement[];
  dispose: () => void;
}
export const IElementService = Symbol("IElementService");

export interface IElement {
  type: string;
  ctrlElement: any;
  saveInfoProvider: any
}
