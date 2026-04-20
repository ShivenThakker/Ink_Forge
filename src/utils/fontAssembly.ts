import type { HandwritingStyle, LetterDefinition, StyleParameters } from '../engine/types';
import { DEFAULT_PARAMS } from '../engine/types';
import type { ExtractedLetterCell } from './cellExtraction';
import { convertCellToLetterDefinition } from './skeletonToAnchors';

export interface LetterImportOverride {
  included: boolean;
  reverseDirection: boolean;
  anchorCount: number;
}

export interface BuildFontStyleOptions {
  name: string;
  key: string;
  source?: string;
  defaults?: Partial<StyleParameters>;
  anchorCount?: number;
  overrides?: Record<string, LetterImportOverride>;
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
    const override = options.overrides?.[cell.letter.toLowerCase()];
    if (override && !override.included) {
      continue;
    }

    const letter = await convertCellToLetterDefinition(
      cell,
      override?.anchorCount ?? anchorCount,
      { reverseDirection: override?.reverseDirection ?? false },
    );
    letters[cell.letter.toLowerCase()] = letter;
  }

  if (Object.keys(letters).length === 0) {
    throw new Error('No letters selected for import.');
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
