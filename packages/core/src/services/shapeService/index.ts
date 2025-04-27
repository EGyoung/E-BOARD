// import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
// import { IRenderService } from "../renderService/type";

import { IShape, IShapeService } from "./type";

class ShapeService<Params extends Record<string, any>> implements IShapeService {
  private board!: IBoard;
  private shapeMap: Map<string, IShape<Params>> = new Map();
  init = ({ board }: IServiceInitParams) => {
    this.board = board;
  };

  public registerShape(shape: IShape<Params>) {
    this.shapeMap.set(shape.type, shape);
  }

  public getShape(type: string) {
    return this.shapeMap.get(type);
  }

  public getAllShapes() {
    return Array.from(this.shapeMap.values());
  }

  public dispose(): void {}
}

export default ShapeService;
