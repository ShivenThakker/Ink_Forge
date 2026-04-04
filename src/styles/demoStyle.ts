import type { HandwritingStyle } from '../engine/types';

export const demoStyle: HandwritingStyle = {
  name: 'demo-neat',
  defaults: {
    anchorCount: 6,
    spacing: 14,
    slant: 8,
    baselineJitter: 1.2,
    spacingJitter: 1.8,
    roundness: 0.6,
    connectionSmoothness: 0.5,
    anchorJitter: 0.8,
    angleJitter: 1.2,
    strokeWidth: 2,
    strokeColor: '#111111',
    strokeBreakChance: 0,
    strokeBreakLength: 8,
  },
  letters: {
    h: {
      char: 'h',
      anchors: [
        { id: 'h-1', x: 8, y: 70, type: 'entry' },
        { id: 'h-2', x: 12, y: 22, type: 'normal' },
        { id: 'h-3', x: 16, y: 70, type: 'normal' },
        { id: 'h-4', x: 30, y: 48, type: 'normal' },
        { id: 'h-5', x: 42, y: 70, type: 'exit' },
      ],
    },
    e: {
      char: 'e',
      anchors: [
        { id: 'e-1', x: 8, y: 62, type: 'entry' },
        { id: 'e-2', x: 16, y: 52, type: 'normal' },
        { id: 'e-3', x: 32, y: 56, type: 'normal' },
        { id: 'e-4', x: 34, y: 69, type: 'normal' },
        { id: 'e-5', x: 18, y: 72, type: 'normal' },
        { id: 'e-6', x: 38, y: 70, type: 'exit' },
      ],
    },
    l: {
      char: 'l',
      anchors: [
        { id: 'l-1', x: 10, y: 70, type: 'entry' },
        { id: 'l-2', x: 14, y: 18, type: 'normal' },
        { id: 'l-3', x: 18, y: 68, type: 'normal' },
        { id: 'l-4', x: 24, y: 70, type: 'exit' },
      ],
    },
    o: {
      char: 'o',
      anchors: [
        { id: 'o-1', x: 8, y: 66, type: 'entry' },
        { id: 'o-2', x: 16, y: 54, type: 'normal' },
        { id: 'o-3', x: 30, y: 54, type: 'normal' },
        { id: 'o-4', x: 36, y: 66, type: 'normal' },
        { id: 'o-5', x: 28, y: 74, type: 'normal' },
        { id: 'o-6', x: 16, y: 74, type: 'normal' },
        { id: 'o-7', x: 38, y: 70, type: 'exit' },
      ],
    },
  },
};
