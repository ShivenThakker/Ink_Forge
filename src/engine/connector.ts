import type { Point, PositionedLetter } from './types';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createConnectorPath(exit: Point, entry: Point, connectionSmoothness: number): string {
  const smoothness = clamp01(connectionSmoothness);
  const dx = entry.x - exit.x;
  const handle = Math.max(6, Math.abs(dx) * (0.25 + smoothness * 0.55));
  const rise = Math.max(2, Math.min(12, Math.abs(dx) * (0.12 + smoothness * 0.16)));

  const cp1x = exit.x + handle;
  const cp1y = exit.y - rise;
  const cp2x = entry.x - handle;
  const cp2y = entry.y - rise;

  return `M ${exit.x} ${exit.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${entry.x} ${entry.y}`;
}

export function generateConnectors(letters: PositionedLetter[], connectionSmoothness: number): string[] {
  const connectors: string[] = [];

  if (connectionSmoothness <= 0.12) {
    return connectors;
  }

  for (let i = 0; i < letters.length - 1; i++) {
    const current = letters[i];
    const next = letters[i + 1];

    const exit = current.exit;
    const entry = next.entry;

    if (!exit || !entry) continue;

    const dx = entry.x - exit.x;
    const dy = Math.abs(entry.y - exit.y);
    const isReasonableGap = dx >= 3 && dx <= 22;
    const isBaselineAligned = dy <= 7;
    if (!isReasonableGap || !isBaselineAligned) {
      continue;
    }

    connectors.push(createConnectorPath(exit, entry, connectionSmoothness));
  }

  return connectors;
}
