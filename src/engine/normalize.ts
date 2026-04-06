import type { LetterDefinition, LetterVerticalType, Point, StrokeDefinition } from './types';

export interface NormalizationGrid {
  size: number;
  baselineY: number;
  xHeightY: number;
  ascenderY: number;
  descenderY: number;
  leftX: number;
  targetWidth: number;
}

export const DEFAULT_NORMALIZATION_GRID: NormalizationGrid = {
  size: 100,
  baselineY: 70,
  xHeightY: 45,
  ascenderY: 10,
  descenderY: 90,
  leftX: 0,
  targetWidth: 28,
};

const ASCENDER_SET = new Set(['b', 'd', 'f', 'h', 'k', 'l', 't']);
const DESCENDER_SET = new Set(['g', 'j', 'p', 'q', 'y']);

export function inferLetterType(char: string): LetterVerticalType {
  const normalized = char.toLowerCase();
  if (ASCENDER_SET.has(normalized)) return 'ascender';
  if (DESCENDER_SET.has(normalized)) return 'descender';
  return 'xheight';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBounds(strokes: StrokeDefinition[]): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const points = strokes.flatMap((stroke) => stroke.anchors);
  if (points.length === 0) return null;

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, maxX, minY, maxY };
}

function normalizeLinear(value: number, srcMin: number, srcMax: number, dstMin: number, dstMax: number): number {
  const srcSpan = Math.max(1e-6, srcMax - srcMin);
  const t = (value - srcMin) / srcSpan;
  return dstMin + t * (dstMax - dstMin);
}

function normalizeY(pointY: number, bounds: { minY: number; maxY: number }, type: LetterVerticalType, grid: NormalizationGrid): number {
  const { minY, maxY } = bounds;
  const totalHeight = Math.max(1e-6, maxY - minY);

  if (type === 'xheight') {
    return normalizeLinear(pointY, minY, maxY, grid.xHeightY, grid.baselineY);
  }

  if (type === 'ascender') {
    const splitY = minY + totalHeight * 0.42;
    if (pointY <= splitY) {
      return normalizeLinear(pointY, minY, splitY, grid.ascenderY, grid.xHeightY);
    }
    return normalizeLinear(pointY, splitY, maxY, grid.xHeightY, grid.baselineY);
  }

  const splitY = minY + totalHeight * 0.58;
  if (pointY <= splitY) {
    return normalizeLinear(pointY, minY, splitY, grid.xHeightY, grid.baselineY);
  }
  return normalizeLinear(pointY, splitY, maxY, grid.baselineY, grid.descenderY);
}

function normalizePoint(
  point: Point,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  type: LetterVerticalType,
  grid: NormalizationGrid,
): Point {
  const sourceWidth = Math.max(1e-6, bounds.maxX - bounds.minX);

  const scaleX = grid.targetWidth / sourceWidth;

  const normalizedX = (point.x - bounds.minX) * scaleX + grid.leftX;
  const normalizedY = normalizeY(point.y, bounds, type, grid);

  return {
    x: clamp(normalizedX, 0, grid.size),
    y: clamp(normalizedY, 0, grid.size),
  };
}

export function normalizeStrokes(
  strokes: StrokeDefinition[],
  type: LetterVerticalType = 'xheight',
  grid: NormalizationGrid = DEFAULT_NORMALIZATION_GRID,
): StrokeDefinition[] {
  const bounds = getBounds(strokes);
  if (!bounds) return strokes.map((stroke) => ({ anchors: stroke.anchors.map((anchor) => ({ ...anchor })) }));

  return strokes.map((stroke) => ({
    anchors: stroke.anchors.map((anchor) => {
      const normalized = normalizePoint(anchor, bounds, type, grid);
      return {
        ...anchor,
        x: normalized.x,
        y: normalized.y,
      };
    }),
  }));
}

export function normalizeLetter(
  letter: LetterDefinition,
  grid: NormalizationGrid = DEFAULT_NORMALIZATION_GRID,
): LetterDefinition {
  const type = letter.type ?? inferLetterType(letter.char);
  const strokes = normalizeStrokes(letter.strokes, type, grid);
  const bounds = getBounds(letter.strokes);

  const normalizeOptionalPoint = (point?: Point): Point | undefined => {
    if (!point || !bounds) return point;
    return normalizePoint(point, bounds, type, grid);
  };

  return {
    ...letter,
    type,
    strokes,
    entry: normalizeOptionalPoint(letter.entry),
    exit: normalizeOptionalPoint(letter.exit),
  };
}
