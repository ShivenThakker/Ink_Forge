import type { Anchor, HandwritingStyle, PositionedLetter, StyleParameters } from './types';
import { createSeededRng, jitterSpacing, wobbleBaseline } from './variation';

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

function getLetterBounds(anchors: Anchor[]): { minX: number; maxX: number } {
  const xs = anchors.map((anchor) => anchor.x);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
  };
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

    const definition = style.letters[char];
    if (!definition || definition.anchors.length < 2) {
      missingChars.add(char);
      cursorX += params.spacing * 0.75;
      continue;
    }

    const sampledAnchors = sampleAnchors(definition.anchors, params.anchorCount);
    const { minX, maxX } = getLetterBounds(sampledAnchors);
    const letterBaseline = wobbleBaseline(baselineY, params.baselineJitter, rng);

    const positionedAnchors = sampledAnchors.map((anchor) => ({
      ...anchor,
      x: cursorX + (anchor.x - minX),
      y: letterBaseline + (anchor.y - DESIGN_BASELINE),
    }));

    const width = Math.max(1, maxX - minX);
    letters.push({
      char,
      anchors: positionedAnchors,
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
