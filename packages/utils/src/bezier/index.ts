interface Point {
  x: number;
  y: number;
}

/**
 * 计算二次贝塞尔曲线上的点
 * @param t 插值参数 (0-1)
 * @param p0 起点
 * @param p1 控制点
 * @param p2 终点
 * @returns 曲线上的点
 */
export function getQuadraticBezierPoint(t: number, p0: Point, p1: Point, p2: Point): Point {
  const x = Math.pow(1 - t, 2) * p0.x + 2 * (1 - t) * t * p1.x + Math.pow(t, 2) * p2.x;
  const y = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;
  return { x, y };
}

/**
 * 计算三次贝塞尔曲线上的点
 * @param t 插值参数 (0-1)
 * @param p0 起点
 * @param p1 第一控制点
 * @param p2 第二控制点
 * @param p3 终点
 * @returns 曲线上的点
 */
export function getCubicBezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const x =
    Math.pow(1 - t, 3) * p0.x +
    3 * Math.pow(1 - t, 2) * t * p1.x +
    3 * (1 - t) * Math.pow(t, 2) * p2.x +
    Math.pow(t, 3) * p3.x;
  const y =
    Math.pow(1 - t, 3) * p0.y +
    3 * Math.pow(1 - t, 2) * t * p1.y +
    3 * (1 - t) * Math.pow(t, 2) * p2.y +
    Math.pow(t, 3) * p3.y;
  return { x, y };
}

/**
 * 绘制平滑的贝塞尔曲线路径
 * @param ctx Canvas 2D上下文
 * @param points 路径点数组
 * @param tension 曲线张力 (0-1)，默认0.3
 */
// export function drawSmoothBezierPath(
//   ctx: CanvasRenderingContext2D,
//   points: Point[],
//   tension: number = 0.3
// ): void {
//   if (points.length < 2) return;

//   ctx.beginPath();
//   ctx.moveTo(points[0].x, points[0].y);

//   // 如果只有两个点，画直线
//   if (points.length === 2) {
//     ctx.lineTo(points[1].x, points[1].y);
//     return;
//   }

//   // 计算控制点并绘制曲线
//   for (let i = 0; i < points.length - 1; i++) {
//     const curr = points[i];
//     const next = points[i + 1];

//     // 计算控制点
//     let cp1x, cp1y, cp2x, cp2y;

//     if (i === 0) {
//       // 第一个点
//       cp1x = curr.x + (next.x - curr.x) * tension;
//       cp1y = curr.y + (next.y - curr.y) * tension;
//       cp2x = next.x - (next.x - curr.x) * tension;
//       cp2y = next.y - (next.y - curr.y) * tension;
//     } else if (i === points.length - 2) {
//       // 最后一个点
//       const prev = points[i - 1];
//       cp1x = curr.x + (next.x - prev.x) * tension;
//       cp1y = curr.y + (next.y - prev.y) * tension;
//       cp2x = next.x - (next.x - curr.x) * tension;
//       cp2y = next.y - (next.y - curr.y) * tension;
//     } else {
//       // 中间的点
//       const prev = points[i - 1];
//       const nextNext = points[i + 2];
//       cp1x = curr.x + (next.x - prev.x) * tension;
//       cp1y = curr.y + (next.y - prev.y) * tension;
//       cp2x = next.x - (nextNext.x - curr.x) * tension;
//       cp2y = next.y - (nextNext.y - curr.y) * tension;
//     }

//     ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y);
//   }
// }

// /**
//  * 创建平滑的贝塞尔曲线路径生成器
//  * @param tension 曲线张力 (0-1)，默认0.3
//  * @returns 路径生成器对象
//  */
// export function createSmoothPathGenerator(tension: number = 0.3) {
//   let points: Point[] = [];
//   let isDrawing = false;

//   return {
//     /**
//      * 开始新的路径
//      * @param x 起始点x坐标
//      * @param y 起始点y坐标
//      */
//     startPath(x: number, y: number) {
//       points = [{ x, y }];
//       isDrawing = true;
//     },

//     /**
//      * 添加新的点并更新路径
//      * @param ctx Canvas 2D上下文
//      * @param x 新点x坐标
//      * @param y 新点y坐标
//      */
//     addPoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
//       if (!isDrawing) return;

//       points.push({ x, y });
//       if (points.length >= 2) {
//         ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
//         drawSmoothBezierPath(ctx, points, tension);
//         ctx.stroke();
//       }
//     },

//     /**
//      * 结束路径
//      */
//     endPath() {
//       isDrawing = false;
//       points = [];
//     },

//     /**
//      * 获取当前路径的所有点
//      */
//     getPoints() {
//       return [...points];
//     }
//   };
// }
