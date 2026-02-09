// import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
// import { IRenderService } from "../renderService/type";

import { IElement, IElementService } from "./type";

class ElementService<Params extends Record<string, any>> implements IElementService<Params> {
  private board!: IBoard;
  private elementMap: Map<string, IElement<Params>> = new Map();
  init = ({ board }: IServiceInitParams) => {
    this.board = board;
  };

  public registerElement(shape: IElement<Params>) {
    this.elementMap.set(shape.type, shape);
  }

  public getElement(type: string) {
    return this.elementMap.get(type);
  }

  public getAllElement() {
    return Array.from(this.elementMap.values());
  }

  public dispose(): void { }
}

export default ElementService;
