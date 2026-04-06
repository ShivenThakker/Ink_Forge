import type { HandwritingStyle, LetterDefinition, Point, StyleParameters } from './types';
import { catmullRomToPath, roundnessToTension } from './spline';
import { generateConnectors } from './connector';
import { layoutText } from './layout';
import { createSeededRng, jitterAngle, jitterPoints, shouldBreak, wobbleBaseline } from './variation';
import { normalizeLetter } from './normalize';

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
  paths: string[];
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

  const normalizedLetter = normalizeLetter(letter);
  const drawableStrokes = normalizedLetter.strokes.filter((stroke) => stroke.anchors.length >= 2);
  if (drawableStrokes.length === 0) {
    return {
      path: '',
      paths: [],
      viewBox: '0 0 100 100',
      transform: 'skewX(0)',
      width: 100,
      height: 100,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>',
    };
  }

  const rng = createSeededRng(seed);
  const jitteredStrokePoints = drawableStrokes.map((stroke) =>
    jitterPoints(stroke.anchors, anchorJitter, rng).map((point) => ({
      x: point.x,
      y: wobbleBaseline(point.y, baselineJitter, rng),
    })),
  );
  const jitteredPoints = jitteredStrokePoints.flatMap((stroke) => stroke);

  const effectiveAngle = jitterAngle(0, angleJitter, rng);
  const { minX, minY, maxX, maxY } = getBounds(jitteredPoints);

  const width = Math.max(1, maxX - minX + padding * 2);
  const height = Math.max(1, maxY - minY + padding * 2);
  const translatedStrokes = jitteredStrokePoints.map((stroke) =>
    stroke.map((point) => ({
      x: point.x - minX + padding,
      y: point.y - minY + padding,
    })),
  );

  const midY = height / 2;
  const loopScale = Math.max(0.4, Math.min(1.8, loopSize));
  const loopAdjustedStrokes = translatedStrokes.map((stroke) =>
    stroke.map((point) => ({
      x: point.x,
      y: midY + (point.y - midY) * loopScale,
    })),
  );

  const curvatureFactor = Math.max(0.2, Math.min(1.6, strokeCurvature));
  const effectiveRoundness = Math.max(0, Math.min(1, roundness * curvatureFactor));
  const paths = loopAdjustedStrokes.map((stroke) => catmullRomToPath(stroke, roundnessToTension(effectiveRoundness)));
  const path = paths.join(' ');
  const viewBox = `0 0 ${width} ${height}`;
  const transform = `skewX(${slant}) rotate(${effectiveAngle} ${width / 2} ${height / 2})`;
  const strokeMarkup = paths
    .map(
      (strokePath) =>
        `<path d="${strokePath}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" transform="${transform}"/>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${strokeMarkup}</svg>`;

  return {
    path,
    paths,
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
  const loopScale = Math.max(0.4, Math.min(1.8, params.loopSize));
  const loopAdjustedLetters = layout.letters.map((letter) => ({
    ...letter,
    strokes: letter.strokes.map((stroke) => ({
      anchors: stroke.anchors.map((anchor) => ({
        ...anchor,
        y: letter.baselineY + (anchor.y - letter.baselineY) * loopScale,
      })),
    })),
    entry: letter.entry
      ? {
          x: letter.entry.x,
          y: letter.baselineY + (letter.entry.y - letter.baselineY) * loopScale,
        }
      : null,
    exit: letter.exit
      ? {
          x: letter.exit.x,
          y: letter.baselineY + (letter.exit.y - letter.baselineY) * loopScale,
        }
      : null,
  }));
  const connectorPaths = generateConnectors(loopAdjustedLetters, params.connectionSmoothness);
  const rng = createSeededRng(`${seed}-variation`);

  const letterPaths = loopAdjustedLetters
    .map((letter, index) => {
      const shouldLiftPen = shouldBreak(params.strokeBreakChance, rng);

      const curvatureFactor = Math.max(0.2, Math.min(1.6, params.strokeCurvature));
      const effectiveRoundness = Math.max(0, Math.min(1, params.roundness * curvatureFactor));
      const angle = jitterAngle(0, params.angleJitter, rng);
      const pivotX = letter.x + letter.width / 2;
      const pivotY = letter.baselineY;
      const transform = `rotate(${angle} ${pivotX} ${pivotY})`;

      const breakLength = Math.max(0, Math.min(80, params.strokeBreakLength));
      const dashLength = Math.max(0, 100 - breakLength);
      const dashAttrs = shouldLiftPen
        ? ` pathLength="100" stroke-dasharray="${dashLength} ${breakLength}" stroke-dashoffset="35"`
        : '';

      return letter.strokes
        .filter((stroke) => stroke.anchors.length >= 2)
        .map((stroke, strokeIndex) => {
          const jitteredStroke = jitterPoints(stroke.anchors, params.anchorJitter, rng).map((point) => ({
            x: point.x,
            y: wobbleBaseline(point.y, params.baselineJitter * 0.2, rng),
          }));

          const path = catmullRomToPath(jitteredStroke, roundnessToTension(effectiveRoundness));
          return `<path d="${path}" fill="none" stroke="${params.strokeColor}" stroke-width="${params.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" transform="${transform}" data-index="${index}-${strokeIndex}"${dashAttrs}/>`;
        })
        .join('');
    })
    .join('');

  const connectorMarkup = connectorPaths
    .map(
      (path) =>
        `<path d="${path}" fill="none" stroke="${params.strokeColor}" stroke-width="${params.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}"><g transform="skewX(${params.slant})">${connectorMarkup}${letterPaths}</g></svg>`;

  return {
    svg,
    width: layout.width,
    height: layout.height,
  };
}
