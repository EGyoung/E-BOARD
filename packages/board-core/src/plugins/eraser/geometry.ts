import { BBox, Point, SegmentDistanceResult } from './type';

const EPSILON = 1e-7;

interface Interval {
  start: number;
  end: number;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const dot = (p1: Point, p2: Point) => {
  return p1.x * p2.x + p1.y * p2.y;
};

const interpolatePoint = (start: Point, end: Point, t: number): Point => {
  return {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  };
};

const isSamePoint = (p1: Point, p2: Point) => {
  return distance(p1, p2) <= EPSILON;
};

export const distance = (p1: Point, p2: Point) => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

export const calculateBBox = (points: Point[], padding = 0): BBox | null => {
  if (!points.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
};

export const isBBoxIntersect = (b1: BBox | null, b2: BBox | null) => {
  if (!b1 || !b2) return false;

  return !(
    b2.minX > b1.maxX ||
    b2.maxX < b1.minX ||
    b2.minY > b1.maxY ||
    b2.maxY < b1.minY
  );
};

export const pointLineSegmentDistance = (point: Point, start: Point, end: Point) => {
  const l2 = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;

  if (l2 === 0) return distance(point, start);

  let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  return distance(point, {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  });
};

export const minDistanceBetweenSegments = (
  p1: Point,
  p2: Point,
  q1: Point,
  q2: Point,
): SegmentDistanceResult => {
  const u = { x: p2.x - p1.x, y: p2.y - p1.y };
  const v = { x: q2.x - q1.x, y: q2.y - q1.y };
  const w = { x: p1.x - q1.x, y: p1.y - q1.y };

  const a = dot(u, u);
  const b = dot(u, v);
  const c = dot(v, v);
  const d = dot(u, w);
  const e = dot(v, w);

  if (a < EPSILON && c < EPSILON) {
    return {
      distance: distance(p1, q1),
      t: 0,
    };
  }

  if (a < EPSILON) {
    return {
      distance: pointLineSegmentDistance(p1, q1, q2),
      t: 0,
    };
  }

  if (c < EPSILON) {
    const t = clamp(dot({ x: q1.x - p1.x, y: q1.y - p1.y }, u) / a, 0, 1);
    return {
      distance: distance(q1, interpolatePoint(p1, p2, t)),
      t,
    };
  }

  const D = a * c - b * b;

  let sc: number;
  let sN: number;
  let sD = D;
  let tN: number;
  let tD = D;

  if (D < EPSILON) {
    sN = 0;
    sD = 1;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;

    if (sN < 0) {
      sN = 0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }

  if (tN < 0) {
    tN = 0;
    if (-d < 0) {
      sN = 0;
    } else if (-d > a) {
      sN = sD;
    } else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) {
      sN = 0;
    } else if (-d + b > a) {
      sN = sD;
    } else {
      sN = -d + b;
      sD = a;
    }
  }

  sc = Math.abs(sN) < EPSILON ? 0 : sN / sD;
  const tc = Math.abs(tN) < EPSILON ? 0 : tN / tD;
  const dP = {
    x: w.x + sc * u.x - tc * v.x,
    y: w.y + sc * u.y - tc * v.y,
  };

  return {
    distance: Math.sqrt(dP.x * dP.x + dP.y * dP.y),
    t: sc,
  };
};

// 做点剔除，求相交的点坐标
export const calculateStrokeFragments = (
  strokePoints: Point[], // 线段的点
  eraserPath: Point[], // 橡皮的路径点
  eraserRadius: number, // 橡皮擦半径
  strokeLineWidth = 1, // 线宽
): Point[][] => {
  if (strokePoints.length < 2) return [];
  if (eraserPath.length < 1) return [strokePoints.map(point => ({ ...point }))];

  const combinedRadius = eraserRadius + strokeLineWidth / 2;
  if (combinedRadius <= 0) return [strokePoints.map(point => ({ ...point }))];

  const fragments: Point[][] = [];
  let currentFragment: Point[] = [];

  const appendPoint = (point: Point) => {
    const lastPoint = currentFragment[currentFragment.length - 1];
    if (!lastPoint || !isSamePoint(lastPoint, point)) {
      currentFragment.push({ x: point.x, y: point.y });
    }
  };

  const closeCurrentFragment = () => {
    if (currentFragment.length > 1) fragments.push(currentFragment);
    currentFragment = [];
  };

  const addInterval = (intervals: Interval[], start: number, end: number) => {
    const clampedStart = clamp(start, 0, 1);
    const clampedEnd = clamp(end, 0, 1);
    if (clampedEnd + EPSILON < clampedStart) return;

    intervals.push({
      start: clampedStart,
      end: clampedEnd,
    });
  };

  const addPointInterval = (
    intervals: Interval[],
    segmentStart: Point,
    segmentEnd: Point,
    eraserPoint: Point,
    segmentLength: number,
    segmentLengthSquared: number,
  ) => {
    if (segmentLength < EPSILON) {
      if (distance(segmentStart, eraserPoint) <= combinedRadius) addInterval(intervals, 0, 1);
      return;
    }

    const segmentVector = {
      x: segmentEnd.x - segmentStart.x,
      y: segmentEnd.y - segmentStart.y,
    };
    const pointVector = {
      x: eraserPoint.x - segmentStart.x,
      y: eraserPoint.y - segmentStart.y,
    };
    const t = clamp(dot(pointVector, segmentVector) / segmentLengthSquared, 0, 1);
    const closestPoint = interpolatePoint(segmentStart, segmentEnd, t);
    const perpendicularDistance = distance(eraserPoint, closestPoint);

    if (perpendicularDistance > combinedRadius) return;

    const halfInterval = Math.sqrt(Math.max(0, combinedRadius ** 2 - perpendicularDistance ** 2)) / segmentLength;
    addInterval(intervals, t - halfInterval, t + halfInterval);
  };

  const addParallelSegmentInterval = (
    intervals: Interval[],
    segmentStart: Point,
    segmentEnd: Point,
    eraserStart: Point,
    eraserEnd: Point,
    segmentLength: number,
    segmentLengthSquared: number,
  ) => {
    const eraserLength = distance(eraserStart, eraserEnd);
    if (segmentLength < EPSILON || eraserLength < EPSILON) return;

    const segmentVector = {
      x: segmentEnd.x - segmentStart.x,
      y: segmentEnd.y - segmentStart.y,
    };
    const eraserVector = {
      x: eraserEnd.x - eraserStart.x,
      y: eraserEnd.y - eraserStart.y,
    };
    const cross = segmentVector.x * eraserVector.y - segmentVector.y * eraserVector.x;
    if (Math.abs(cross) > EPSILON * segmentLength * eraserLength) return;

    const distanceToLine = pointLineSegmentDistance(eraserStart, segmentStart, segmentEnd);
    if (distanceToLine > combinedRadius) return;

    const startT = dot({ x: eraserStart.x - segmentStart.x, y: eraserStart.y - segmentStart.y }, segmentVector) / segmentLengthSquared;
    const endT = dot({ x: eraserEnd.x - segmentStart.x, y: eraserEnd.y - segmentStart.y }, segmentVector) / segmentLengthSquared;
    const halfInterval = Math.sqrt(Math.max(0, combinedRadius ** 2 - distanceToLine ** 2)) / segmentLength;

    addInterval(intervals, Math.min(startT, endT) - halfInterval, Math.max(startT, endT) + halfInterval);
  };

  const mergeIntervals = (intervals: Interval[]) => {
    return intervals
      .sort((a, b) => a.start - b.start)
      .reduce<Interval[]>((merged, interval) => {
        const lastInterval = merged[merged.length - 1];
        if (!lastInterval || interval.start > lastInterval.end + EPSILON) {
          merged.push({ ...interval });
          return merged;
        }

        lastInterval.end = Math.max(lastInterval.end, interval.end);
        return merged;
      }, []);
  };

  for (let i = 0; i < strokePoints.length - 1; i++) {
    const segmentStart = strokePoints[i];
    const segmentEnd = strokePoints[i + 1];
    const segmentLength = distance(segmentStart, segmentEnd);
    const segmentLengthSquared = segmentLength ** 2;
    const erasedIntervals: Interval[] = [];

    if (eraserPath.length === 1) {
      addPointInterval(
        erasedIntervals,
        segmentStart,
        segmentEnd,
        eraserPath[0],
        segmentLength,
        segmentLengthSquared,
      );
    } else {
      for (let j = 0; j < eraserPath.length - 1; j++) {
        const eraserStart = eraserPath[j];
        const eraserEnd = eraserPath[j + 1];

        addPointInterval(erasedIntervals, segmentStart, segmentEnd, eraserStart, segmentLength, segmentLengthSquared);
        addPointInterval(erasedIntervals, segmentStart, segmentEnd, eraserEnd, segmentLength, segmentLengthSquared);
        addParallelSegmentInterval(
          erasedIntervals,
          segmentStart,
          segmentEnd,
          eraserStart,
          eraserEnd,
          segmentLength,
          segmentLengthSquared,
        );

        if (segmentLength < EPSILON) continue;

        const { distance: segmentDistance, t } = minDistanceBetweenSegments(
          segmentStart,
          segmentEnd,
          eraserStart,
          eraserEnd,
        );

        if (segmentDistance <= combinedRadius) {
          const halfInterval = Math.sqrt(Math.max(0, combinedRadius ** 2 - segmentDistance ** 2)) / segmentLength;
          addInterval(erasedIntervals, t - halfInterval, t + halfInterval);
        }
      }
    }

    const mergedErasedIntervals = mergeIntervals(erasedIntervals);
    const keptIntervals: Interval[] = [];
    let nextKeptStart = 0;

    mergedErasedIntervals.forEach(interval => {
      if (interval.start > nextKeptStart + EPSILON) {
        keptIntervals.push({ start: nextKeptStart, end: interval.start });
      }
      nextKeptStart = Math.max(nextKeptStart, interval.end);
    });

    if (nextKeptStart < 1 - EPSILON) {
      keptIntervals.push({ start: nextKeptStart, end: 1 });
    }

    if (!keptIntervals.length) {
      closeCurrentFragment();
      continue;
    }

    keptIntervals.forEach(keptInterval => {
      const keptStart = interpolatePoint(segmentStart, segmentEnd, keptInterval.start);
      const keptEnd = interpolatePoint(segmentStart, segmentEnd, keptInterval.end);

      if (keptInterval.start > EPSILON) closeCurrentFragment();
      appendPoint(keptStart);
      appendPoint(keptEnd);
      if (keptInterval.end < 1 - EPSILON) closeCurrentFragment();
    });
  }

  closeCurrentFragment();

  return fragments;
};

// 判断线段和橡皮是否发生了碰撞
export const isStrokeHitByEraserSegment = (
  strokePoints: Point[],
  strokeLineWidth: number,
  eraserSegmentStart: Point,
  eraserSegmentEnd: Point,
  eraserRadius: number,
) => {
  if (strokePoints.length < 2) return false;

  const strokeBBox = calculateBBox(strokePoints, strokeLineWidth / 2);
  const eraserBBox = calculateBBox([eraserSegmentStart, eraserSegmentEnd], eraserRadius + strokeLineWidth / 2);

  // 先判断AABB包围盒是否相交
  if (!isBBoxIntersect(strokeBBox, eraserBBox)) return false;

  for (let i = 0; i < strokePoints.length - 1; i++) {
    const { distance: segmentDistance } = minDistanceBetweenSegments(
      strokePoints[i],
      strokePoints[i + 1],
      eraserSegmentStart,
      eraserSegmentEnd,
    );

    if (segmentDistance < eraserRadius + strokeLineWidth / 2) {
      return true;
    }
  }

  return false;
};
