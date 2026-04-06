import type { Anchor, HandwritingStyle, Point, PositionedLetter, StrokeDefinition, StyleParameters } from './types';
import { createSeededRng, jitterSpacing, wobbleBaseline } from './variation';
import { normalizeLetter } from './normalize';

const DESIGN_BASELINE = 70;

function sampleAnchors(anchors: Anchor[], requestedCount: number): Anchor[] {
  if (anchors.length <= 2) return [...anchors];

  const target = Math.max(2, Math.min(anchors.length, Math.round(requestedCount)));
  if (target >= anchors.length) return [...anchors];

  const sampled: Anchor[] = [];
  for (let i = 0; i < target; i++) {
    const t = i / (target - 1);
    const sourceIndex = Math.round(t * (anchors.length - 1));
    sampled.push({ ...anchors[sourceIndex] });
  }
  return sampled;
}

function sampleStrokes(strokes: StrokeDefinition[], requestedCount: number): StrokeDefinition[] {
  const drawable = strokes.filter((stroke) => stroke.anchors.length > 0);
  if (drawable.length === 0) return [];

  const countPerStroke = Math.max(2, Math.round(requestedCount / drawable.length));
  return drawable.map((stroke) => ({
    anchors: sampleAnchors(stroke.anchors, countPerStroke),
  }));
}

function flattenAnchors(strokes: StrokeDefinition[]): Anchor[] {
  return strokes.flatMap((stroke) => stroke.anchors);
}

function getLetterBounds(strokes: StrokeDefinition[]): { minX: number; maxX: number } {
  const anchors = flattenAnchors(strokes);
  const xs = anchors.map((anchor) => anchor.x);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
  };
}

function resolveEntry(definitionEntry: Point | undefined, strokes: StrokeDefinition[]): Point | null {
  if (definitionEntry) return definitionEntry;
  const firstStroke = strokes.find((stroke) => stroke.anchors.length > 0);
  if (!firstStroke) return null;
  const first = firstStroke.anchors[0];
  return { x: first.x, y: first.y };
}

function resolveExit(definitionExit: Point | undefined, strokes: StrokeDefinition[]): Point | null {
  if (definitionExit) return definitionExit;
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (stroke.anchors.length > 0) {
      const last = stroke.anchors[stroke.anchors.length - 1];
      return { x: last.x, y: last.y };
    }
  }
  return null;
}

export interface LayoutResult {
  letters: PositionedLetter[];
  missingChars: string[];
  width: number;
  height: number;
}

export function layoutText(
  text: string,
  style: HandwritingStyle,
  params: StyleParameters,
  seed: string | number,
): LayoutResult {
  const rng = createSeededRng(seed);
  const letters: PositionedLetter[] = [];
  const missingChars = new Set<string>();

  let cursorX = 10;
  const baselineY = 90;

  for (const rawChar of text) {
    const char = rawChar.toLowerCase();

    if (char === ' ') {
      cursorX += params.spacing * 0.9;
      continue;
    }

    const sourceDefinition = style.letters[char];
    const definition = sourceDefinition ? normalizeLetter(sourceDefinition) : undefined;
    if (!definition || definition.strokes.length === 0) {
      missingChars.add(char);
      cursorX += params.spacing * 0.75;
      continue;
    }

    const sampledStrokes = sampleStrokes(definition.strokes, params.anchorCount);
    const sampledAnchors = flattenAnchors(sampledStrokes);
    const drawableStrokes = sampledStrokes.filter((stroke) => stroke.anchors.length >= 2);

    if (sampledAnchors.length < 2 || drawableStrokes.length === 0) {
      missingChars.add(char);
      cursorX += params.spacing * 0.75;
      continue;
    }

    const { minX, maxX } = getLetterBounds(sampledStrokes);
    const letterBaseline = wobbleBaseline(baselineY, params.baselineJitter, rng);

    const positionedStrokes = sampledStrokes.map((stroke) => ({
      anchors: stroke.anchors.map((anchor) => ({
        ...anchor,
        x: cursorX + (anchor.x - minX),
        y: letterBaseline + (anchor.y - DESIGN_BASELINE),
      })),
    }));

    const sourceEntry = resolveEntry(definition.entry, definition.strokes);
    const sourceExit = resolveExit(definition.exit, definition.strokes);
    const positionedEntry = sourceEntry
      ? {
          x: cursorX + (sourceEntry.x - minX),
          y: letterBaseline + (sourceEntry.y - DESIGN_BASELINE),
        }
      : null;
    const positionedExit = sourceExit
      ? {
          x: cursorX + (sourceExit.x - minX),
          y: letterBaseline + (sourceExit.y - DESIGN_BASELINE),
        }
      : null;

    const width = Math.max(1, maxX - minX);
    letters.push({
      char,
      strokes: positionedStrokes,
      entry: positionedEntry,
      exit: positionedExit,
      x: cursorX,
      baselineY: letterBaseline,
      width,
    });

    cursorX += width + jitterSpacing(params.spacing, params.spacingJitter, rng);
  }

  return {
    letters,
    missingChars: [...missingChars],
    width: Math.max(200, cursorX + 20),
    height: 160,
  };
}
