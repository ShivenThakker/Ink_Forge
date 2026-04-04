import type { HandwritingStyle, LetterDefinition, Point, StyleParameters } from './types';
import { catmullRomToPath, roundnessToTension } from './spline';
import { generateConnectors } from './connector';
import { layoutText } from './layout';
import { createSeededRng, jitterAngle, jitterPoints, shouldBreak, wobbleBaseline } from './variation';

export interface SingleLetterRenderOptions {
  roundness?: number;
  loopSize?: number;
  strokeCurvature?: number;
  slant?: number;
  strokeWidth?: number;
  strokeColor?: string;
  padding?: number;
  seed?: string | number;
  anchorJitter?: number;
  baselineJitter?: number;
  angleJitter?: number;
}

export interface SingleLetterRenderResult {
  path: string;
  viewBox: string;
  transform: string;
  width: number;
  height: number;
  svg: string;
}

export interface TextRenderResult {
  svg: string;
  width: number;
  height: number;
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
    loopSize = 1,
    strokeCurvature = 0.6,
    slant = 0,
    strokeWidth = 2,
    strokeColor = '#111111',
    padding = 8,
    seed = Date.now(),
    anchorJitter = 0,
    baselineJitter = 0,
    angleJitter = 0,
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
  const rng = createSeededRng(seed);
  const jitteredPoints = jitterPoints(points, anchorJitter, rng).map((point) => ({
    x: point.x,
    y: wobbleBaseline(point.y, baselineJitter, rng),
  }));

  const effectiveAngle = jitterAngle(0, angleJitter, rng);
  const { minX, minY, maxX, maxY } = getBounds(jitteredPoints);

  const width = Math.max(1, maxX - minX + padding * 2);
  const height = Math.max(1, maxY - minY + padding * 2);
  const translatedPoints = jitteredPoints.map((point) => ({
    x: point.x - minX + padding,
    y: point.y - minY + padding,
  }));

  const midY = height / 2;
  const loopScale = Math.max(0.4, Math.min(1.8, loopSize));
  const loopAdjustedPoints = translatedPoints.map((point) => ({
    x: point.x,
    y: midY + (point.y - midY) * loopScale,
  }));

  const curvatureFactor = Math.max(0.2, Math.min(1.6, strokeCurvature));
  const effectiveRoundness = Math.max(0, Math.min(1, roundness * curvatureFactor));
  const path = catmullRomToPath(loopAdjustedPoints, roundnessToTension(effectiveRoundness));
  const viewBox = `0 0 ${width} ${height}`;
  const transform = `skewX(${slant}) rotate(${effectiveAngle} ${width / 2} ${height / 2})`;
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

export function renderTextToSvg(
  text: string,
  style: HandwritingStyle,
  paramsOverride: Partial<StyleParameters> = {},
  seed: string | number = 'default-seed',
): TextRenderResult {
  const params: StyleParameters = {
    ...style.defaults,
    ...paramsOverride,
  };

  const layout = layoutText(text, style, params, `${seed}-layout`);
  const connectorPaths = generateConnectors(layout.letters, params.connectionSmoothness);
  const rng = createSeededRng(`${seed}-variation`);

  const letterPaths = layout.letters
    .map((letter, index) => {
      const shouldLiftPen = shouldBreak(params.strokeBreakChance, rng);

      const jittered = jitterPoints(letter.anchors, params.anchorJitter, rng).map((point) => ({
        x: point.x,
        y: wobbleBaseline(point.y, params.baselineJitter * 0.2, rng),
      }));

      const loopScale = Math.max(0.4, Math.min(1.8, params.loopSize));
      const loopAdjusted = jittered.map((point) => ({
        x: point.x,
        y: letter.baselineY + (point.y - letter.baselineY) * loopScale,
      }));

      const curvatureFactor = Math.max(0.2, Math.min(1.6, params.strokeCurvature));
      const effectiveRoundness = Math.max(0, Math.min(1, params.roundness * curvatureFactor));
      const path = catmullRomToPath(loopAdjusted, roundnessToTension(effectiveRoundness));
      const angle = jitterAngle(0, params.angleJitter, rng);
      const pivotX = letter.x + letter.width / 2;
      const pivotY = letter.baselineY;
      const transform = `rotate(${angle} ${pivotX} ${pivotY})`;

      const breakLength = Math.max(0, Math.min(80, params.strokeBreakLength));
      const dashLength = Math.max(0, 100 - breakLength);
      const dashAttrs = shouldLiftPen
        ? ` pathLength="100" stroke-dasharray="${dashLength} ${breakLength}" stroke-dashoffset="35"`
        : '';

      return `<path d="${path}" fill="none" stroke="${params.strokeColor}" stroke-width="${params.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" transform="${transform}" data-index="${index}"${dashAttrs}/>`;
    })
    .join('');

  const connectorMarkup = connectorPaths
    .map(
      (path) =>
        `<path d="${path}" fill="none" stroke="${params.strokeColor}" stroke-width="${Math.max(1, params.strokeWidth - 0.25)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>`,
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}"><g transform="skewX(${params.slant})">${connectorMarkup}${letterPaths}</g></svg>`;

  return {
    svg,
    width: layout.width,
    height: layout.height,
  };
}
