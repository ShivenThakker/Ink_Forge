// Core types for InkForge

export interface Point {
  x: number;
  y: number;
}

export interface Anchor extends Point {
  id: string;
  type: 'normal' | 'entry' | 'exit';
}

export interface StrokeDefinition {
  anchors: Anchor[];
}

export type LetterVerticalType = 'xheight' | 'ascender' | 'descender';

export interface LetterDefinition {
  char: string;
  strokes: StrokeDefinition[];
  type?: LetterVerticalType;
  entry?: Point;
  exit?: Point;
}

export interface HandwritingStyle {
  name: string;
  letters: Record<string, LetterDefinition>;
  defaults: StyleParameters;
}

export interface PositionedLetter {
  char: string;
  strokes: StrokeDefinition[];
  entry: Point | null;
  exit: Point | null;
  x: number;
  baselineY: number;
  width: number;
}

export interface StyleParameters {
  // Layout
  anchorCount: number;
  spacing: number;
  slant: number;
  baselineJitter: number;
  spacingJitter: number;
  // Shape
  roundness: number;
  loopSize: number;
  strokeCurvature: number;
  connectionSmoothness: number;
  // Randomness
  anchorJitter: number;
  angleJitter: number;
  // Stroke
  strokeWidth: number;
  strokeColor: string;
  strokeBreakChance: number;
  strokeBreakLength: number;
}

export const DEFAULT_PARAMS: StyleParameters = {
  anchorCount: 3,
  spacing: 50,
  slant: 0,
  baselineJitter: 2,
  spacingJitter: 5,
  roundness: 0.5,
  loopSize: 1,
  strokeCurvature: 0.6,
  connectionSmoothness: 0.5,
  anchorJitter: 2,
  angleJitter: 5,
  strokeWidth: 2,
  strokeColor: '#000000',
  strokeBreakChance: 0,
  strokeBreakLength: 10,
};