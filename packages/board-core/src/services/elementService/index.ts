import { IBoard, IServiceInitParams } from "../../types";
import { commonElements } from "./commonElements";
import { IElement, IElementService } from "./type";

class ElementService implements IElementService {
  private board!: IBoard;
  private elementMap: Map<string, IElement<any>> = new Map();
  init = ({ board }: IServiceInitParams) => {
    this.board = board;
    this.registerCommonElements();
  };

  private registerCommonElements() {
    // 注册常用元素
    commonElements.forEach(element => {
      this.registerElement(element);
    })
  }

  public registerElement(shape: IElement<any>) {
    this.elementMap.set(shape.type, shape);
  }

  public getElement(type: string) {
    return this.elementMap.get(type);
  }

  public getAllElement() {
    return Array.from(this.elementMap.values());
  }

  public dispose(): void {
    this.elementMap.clear();
  }
}

export default ElementService;
