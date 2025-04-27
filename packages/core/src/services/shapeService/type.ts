import { IServiceInitParams } from "../../types";

export interface IShapeService {
  init: (params: IServiceInitParams) => void;
  dispose: () => void;
}

export const IShapeService = Symbol("IShapeService");

export interface IShape<Params extends Record<string, any>> {
  type: string;
  params: Params;
}
