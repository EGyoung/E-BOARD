import { Emitter } from "@e-board/board-utils";
import type EBoard from "../../board";
import { IServiceInitParams } from "../../types";

import { ITransformService } from "./type";

class TransformService implements ITransformService {
  private board!: EBoard;

  private x: number = 0; // 画布坐标

  private y: number = 0;

  private zoom: number = 1;

  private readonly _onTransformChange = new Emitter<{ x: number; y: number; zoom: number }>()

  public readonly onTransformChange = this._onTransformChange.event;

  init = ({ board }: IServiceInitParams) => {
    this.board = board as EBoard;
    this.initAttribute();
  };

  private initAttribute = () => {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
  };

  public getView = () => {
    return {
      x: this.x,
      y: this.y,
      zoom: this.zoom
    };
  };

  /**
   * 设置视图信息（位置和缩放）
   * @param view 包含位置和缩放信息的对象
   */
  public setView = (view: { x?: number; y?: number; zoom?: number }) => {
    if (view.x !== undefined) this.x = view.x;
    if (view.y !== undefined) this.y = view.y;
    if (view.zoom !== undefined) this.zoom = view.zoom;
    // console.log(this.getView(), "getView");
    if (view.x !== undefined || view.y !== undefined || view.zoom !== undefined) {
      const ctx = this.board.getCtx();
      const canvas = this.board.getCanvas();
      if (!ctx || !canvas) return;
      const renderService = this.board.getService('renderService')
      renderService.reRender();
      this._onTransformChange.fire({ x: this.x, y: this.y, zoom: this.zoom });
    }
  };

  public transformPoint(point: { x: number; y: number }, inverse: boolean = false) {
    const view = this.getView();
    // console.log(view.zoom, "view.zoom");
    if (inverse) {
      /**
       * 画布坐标: 不考虑缩放和平移的坐标
       * 世界坐标: 考虑缩放和平移的坐标
       */
      // 从画布坐标转换到世界坐标
      return {
        x: point.x / view.zoom + view.x,
        y: point.y / view.zoom + view.y
      };
    }
    // 从世界坐标转换到画布坐标
    return {
      x: (point.x - view.x) * view.zoom,
      y: (point.y - view.y) * view.zoom
    };
  }

  public dispose(): void { }
}

/**
 *
 *  公式：
 *
 */

export default TransformService;
