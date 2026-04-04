import type { LetterDefinition, Point } from './types';
import { catmullRomToPath, roundnessToTension } from './spline';

export interface SingleLetterRenderOptions {
  roundness?: number;
  slant?: number;
  strokeWidth?: number;
  strokeColor?: string;
  padding?: number;
}

export interface SingleLetterRenderResult {
  path: string;
  viewBox: string;
  transform: string;
  width: number;
  height: number;
  svg: string;
}

function getBounds(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const first = points[0];
  return points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxX: Math.max(acc.maxX, point.x),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: first.x, minY: first.y, maxX: first.x, maxY: first.y },
  );
}

export function renderSingleLetter(letter: LetterDefinition, options: SingleLetterRenderOptions = {}): SingleLetterRenderResult {
  const {
    roundness = 0.5,
    slant = 0,
    strokeWidth = 2,
    strokeColor = '#111111',
    padding = 8,
  } = options;

  const sortedAnchors = [...letter.anchors];
  if (sortedAnchors.length === 0) {
    return {
      path: '',
      viewBox: '0 0 100 100',
      transform: 'skewX(0)',
      width: 100,
      height: 100,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>',
    };
  }

  const points = sortedAnchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
  const { minX, minY, maxX, maxY } = getBounds(points);

  const width = Math.max(1, maxX - minX + padding * 2);
  const height = Math.max(1, maxY - minY + padding * 2);
  const translatedPoints = points.map((point) => ({
    x: point.x - minX + padding,
    y: point.y - minY + padding,
  }));

  const path = catmullRomToPath(translatedPoints, roundnessToTension(roundness));
  const viewBox = `0 0 ${width} ${height}`;
  const transform = `skewX(${slant})`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${path}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" transform="${transform}"/></svg>`;

  return {
    path,
    viewBox,
    transform,
    width,
    height,
    svg,
  };
}
