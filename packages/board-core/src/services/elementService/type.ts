import { IServiceInitParams } from "../../types";

export interface IElementService<Params extends Record<string, any>> {
  init: (params: IServiceInitParams) => void;
  dispose: () => void;
}

export const IElementService = Symbol("IElementService");

export interface IElement<Params extends Record<string, any>> {
  type: string;
  model: {
    ctrlElement: any;
    data: any;
  }
}
