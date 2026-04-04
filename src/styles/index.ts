import type { HandwritingStyle } from '../engine/types';
import messy from './messy.json';
import neat from './neat.json';
import normal from './normal.json';
import scrawl from './scrawl.json';

export const STYLE_PRESETS: Record<string, HandwritingStyle> = {
  neat: neat as HandwritingStyle,
  normal: normal as HandwritingStyle,
  messy: messy as HandwritingStyle,
  scrawl: scrawl as HandwritingStyle,
};

export const STYLE_NAMES = Object.keys(STYLE_PRESETS);
