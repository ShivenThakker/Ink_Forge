import type { HandwritingStyle, LetterDefinition, StyleParameters } from '../engine/types';
import { DEFAULT_PARAMS } from '../engine/types';
import type { ExtractedLetterCell } from './cellExtraction';
import { convertCellToLetterDefinition } from './skeletonToAnchors';

export interface BuildFontStyleOptions {
  name: string;
  key: string;
  source?: string;
  defaults?: Partial<StyleParameters>;
  anchorCount?: number;
}

export interface BuiltFontStyle {
  key: string;
  style: HandwritingStyle;
  source: string;
}

function sanitizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `imported-${Date.now()}`;
}

export async function buildFontStyleFromExtractedCells(
  cells: ExtractedLetterCell[],
  options: BuildFontStyleOptions,
): Promise<BuiltFontStyle> {
  const letters: Record<string, LetterDefinition> = {};
  const anchorCount = options.anchorCount ?? 14;

  for (const cell of cells) {
    const letter = await convertCellToLetterDefinition(cell, anchorCount);
    letters[cell.letter.toLowerCase()] = letter;
  }

  const style: HandwritingStyle = {
    name: options.name,
    defaults: { ...DEFAULT_PARAMS, ...(options.defaults ?? {}) },
    letters,
  };

  return {
    key: sanitizeKey(options.key || options.name),
    style,
    source: options.source ?? 'scan',
  };
}
