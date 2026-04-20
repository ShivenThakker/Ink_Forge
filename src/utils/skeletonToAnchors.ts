import type { Anchor, LetterDefinition, Point, StrokeDefinition } from '../engine/types';
import { inferLetterType, normalizeLetter } from '../engine/normalize';
import type { ExtractedLetterCell } from './cellExtraction';

interface PixelPoint {
  x: number;
  y: number;
}

function pointKey(point: PixelPoint): string {
  return `${point.x},${point.y}`;
}

function parsePoint(key: string): PixelPoint {
  const [x, y] = key.split(',').map((value) => Number(value));
  return { x, y };
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDistance = -1;
  let index = -1;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance > epsilon && index > 0) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function mapAnchorCountToEpsilon(anchorCount: number): number {
  const clampedCount = Math.max(2, Math.min(50, anchorCount));
  const t = (clampedCount - 2) / 48;
  const maxEpsilon = 6;
  const minEpsilon = 0.2;
  return maxEpsilon - t * (maxEpsilon - minEpsilon);
}

function simplifyStrokePoints(points: Point[], anchorCount: number): Point[] {
  if (points.length <= 2) return points;
  const epsilon = mapAnchorCountToEpsilon(anchorCount);
  const simplified = rdp(points, epsilon);
  if (simplified.length >= 2) return simplified;
  return [points[0], points[points.length - 1]];
}

async function imageDataFromDataUrl(dataUrl: string): Promise<ImageData> {
  const image = new Image();
  image.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load skeleton image for anchor conversion.'));
  });

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create canvas for skeleton image parsing.');
  }

  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function extractInkPixels(imageData: ImageData): Set<string> {
  const pixels = new Set<string>();
  const { data, width, height } = imageData;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx] ?? 255;
      const g = data[idx + 1] ?? 255;
      const b = data[idx + 2] ?? 255;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma < 80) {
        pixels.add(pointKey({ x, y }));
      }
    }
  }

  return pixels;
}

function neighborKeys(point: PixelPoint, inkPixels: Set<string>): string[] {
  const neighbors: string[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const key = pointKey({ x: point.x + dx, y: point.y + dy });
      if (inkPixels.has(key)) {
        neighbors.push(key);
      }
    }
  }
  return neighbors;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function extractPaths(inkPixels: Set<string>): PixelPoint[][] {
  const adjacency = new Map<string, string[]>();
  for (const key of inkPixels) {
    adjacency.set(key, neighborKeys(parsePoint(key), inkPixels));
  }

  const visitedEdges = new Set<string>();
  const paths: PixelPoint[][] = [];

  const orderedNodes = [
    ...Array.from(adjacency.keys()).filter((key) => (adjacency.get(key)?.length ?? 0) !== 2),
    ...Array.from(adjacency.keys()).filter((key) => (adjacency.get(key)?.length ?? 0) === 2),
  ];

  const walkEdgePath = (start: string, next: string): string[] => {
    const path = [start, next];
    visitedEdges.add(edgeKey(start, next));

    let prev = start;
    let current = next;

    while (true) {
      const neighbors = adjacency.get(current) ?? [];
      const candidates = neighbors.filter((candidate) => candidate !== prev && !visitedEdges.has(edgeKey(current, candidate)));
      if (candidates.length !== 1) break;

      const candidate = candidates[0];
      path.push(candidate);
      visitedEdges.add(edgeKey(current, candidate));
      prev = current;
      current = candidate;

      if (candidate === start) break;
    }

    return path;
  };

  for (const node of orderedNodes) {
    const neighbors = adjacency.get(node) ?? [];
    for (const next of neighbors) {
      const key = edgeKey(node, next);
      if (visitedEdges.has(key)) continue;
      const pathKeys = walkEdgePath(node, next);
      if (pathKeys.length >= 2) {
        paths.push(pathKeys.map(parsePoint));
      }
    }
  }

  return paths;
}

function toAnchors(points: Point[], char: string, strokeIndex: number): Anchor[] {
  return points.map((point, anchorIndex) => ({
    id: `${char}_s${strokeIndex}_a${anchorIndex}`,
    x: point.x,
    y: point.y,
    type: 'normal',
  }));
}

function pixelPathToPoints(path: PixelPoint[]): Point[] {
  return path.map((point) => ({ x: point.x, y: point.y }));
}

function deriveEntryExit(strokes: StrokeDefinition[]): { entry?: Point; exit?: Point } {
  const nonEmpty = strokes.filter((stroke) => stroke.anchors.length > 0);
  if (nonEmpty.length === 0) return {};

  const first = nonEmpty[0].anchors[0];
  const lastStroke = nonEmpty[nonEmpty.length - 1];
  const last = lastStroke.anchors[lastStroke.anchors.length - 1];

  return {
    entry: { x: first.x, y: first.y },
    exit: { x: last.x, y: last.y },
  };
}

export async function convertCellToLetterDefinition(
  cell: ExtractedLetterCell,
  anchorCount: number,
): Promise<LetterDefinition> {
  const imageData = await imageDataFromDataUrl(cell.skeletonDataUrl);
  const inkPixels = extractInkPixels(imageData);
  const rawPaths = extractPaths(inkPixels);

  const strokes: StrokeDefinition[] = rawPaths
    .map((path, strokeIndex) => {
      const points = pixelPathToPoints(path);
      const simplified = simplifyStrokePoints(points, anchorCount);
      return {
        anchors: toAnchors(simplified, cell.letter, strokeIndex),
      };
    })
    .filter((stroke) => stroke.anchors.length >= 2);

  const fallbackStroke: StrokeDefinition[] = strokes.length > 0
    ? strokes
    : [{ anchors: [] }];

  const entryExit = deriveEntryExit(fallbackStroke);

  return normalizeLetter({
    char: cell.letter,
    type: inferLetterType(cell.letter),
    strokes: fallbackStroke,
    entry: entryExit.entry,
    exit: entryExit.exit,
  });
}
