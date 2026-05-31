import { IModel } from '../../services/modelService/type';

export interface Point {
  x: number;
  y: number;
}

export interface EraserPoint extends Point {
  erase?: boolean;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SegmentDistanceResult {
  distance: number;
  t: number;
}

export type LineModel = IModel<Record<string, any>> & {
  type: 'line';
  points: Point[];
};

export interface EraseTransactionState {
  eraserPath: Point[];
  affectedLines: Map<string, LineModel>; // 被擦除的线段元素
  tempFragments: Map<string, Point[][]>; // 被擦除的线段元素及其被擦除后所被分割的点集
}
