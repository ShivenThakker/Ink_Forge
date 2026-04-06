import type { Anchor, HandwritingStyle, LetterDefinition, LetterVerticalType, Point, StrokeDefinition } from '../engine/types';
import { inferLetterType } from '../engine/normalize';
import messy from './messy.json';
import neat from './neat.json';
import normal from './normal.json';
import scrawl from './scrawl.json';

type RawAnchor =
  | { id?: string; x: number; y: number; type?: Anchor['type'] }
  | [number, number];

interface RawStroke {
  anchors: RawAnchor[];
}

interface RawLetterDefinition {
  char?: string;
  type?: LetterVerticalType;
  anchors?: RawAnchor[];
  strokes?: RawStroke[];
  entry?: RawAnchor;
  exit?: RawAnchor;
}

interface RawStyle {
  name: string;
  defaults: HandwritingStyle['defaults'];
  letters: Record<string, RawLetterDefinition>;
}

function normalizePoint(value: RawAnchor | undefined): Point | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const [x = 0, y = 0] = value;
    return { x, y };
  }
  return { x: value.x, y: value.y };
}

function normalizeAnchor(value: RawAnchor, id: string): Anchor {
  if (Array.isArray(value)) {
    return {
      id,
      x: value[0] ?? 0,
      y: value[1] ?? 0,
      type: 'normal',
    };
  }

  return {
    id: value.id ?? id,
    x: value.x,
    y: value.y,
    type: value.type ?? 'normal',
  };
}

function normalizeStrokes(letter: RawLetterDefinition, char: string): StrokeDefinition[] {
  if (Array.isArray(letter.strokes)) {
    return letter.strokes.map((stroke, strokeIndex) => ({
      anchors: (stroke.anchors ?? []).map((anchor, anchorIndex) =>
        normalizeAnchor(anchor, `${char}_s${strokeIndex}_a${anchorIndex}`),
      ),
    }));
  }

  const legacyAnchors = letter.anchors ?? [];
  return [
    {
      anchors: legacyAnchors.map((anchor, anchorIndex) =>
        normalizeAnchor(anchor, `${char}_s0_a${anchorIndex}`),
      ),
    },
  ];
}

function inferEntryExit(strokes: StrokeDefinition[]): { entry?: Point; exit?: Point } {
  const nonEmpty = strokes.filter((stroke) => stroke.anchors.length > 0);
  if (nonEmpty.length === 0) {
    return {};
  }

  const first = nonEmpty[0].anchors[0];
  const lastStroke = nonEmpty[nonEmpty.length - 1];
  const last = lastStroke.anchors[lastStroke.anchors.length - 1];
  return {
    entry: { x: first.x, y: first.y },
    exit: { x: last.x, y: last.y },
  };
}

function normalizeLetter(rawLetter: RawLetterDefinition, key: string): LetterDefinition {
  const char = (rawLetter.char ?? key).toLowerCase();
  const strokes = normalizeStrokes(rawLetter, char);
  const inferred = inferEntryExit(strokes);

  return {
    char,
    type: rawLetter.type ?? inferLetterType(char),
    strokes,
    entry: normalizePoint(rawLetter.entry) ?? inferred.entry,
    exit: normalizePoint(rawLetter.exit) ?? inferred.exit,
  };
}

function normalizeStyle(rawStyle: RawStyle): HandwritingStyle {
  const normalizedLetters: Record<string, LetterDefinition> = {};

  for (const [key, letter] of Object.entries(rawStyle.letters ?? {})) {
    normalizedLetters[key.toLowerCase()] = normalizeLetter(letter, key);
  }

  return {
    name: rawStyle.name,
    defaults: rawStyle.defaults,
    letters: normalizedLetters,
  };
}

export const STYLE_PRESETS: Record<string, HandwritingStyle> = {
  neat: normalizeStyle(neat as RawStyle),
  normal: normalizeStyle(normal as RawStyle),
  messy: normalizeStyle(messy as RawStyle),
  scrawl: normalizeStyle(scrawl as RawStyle),
};

export const STYLE_NAMES = Object.keys(STYLE_PRESETS);
