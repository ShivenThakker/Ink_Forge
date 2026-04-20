import type { GridPoint, OrderedCorners } from './gridDetection';
import { interpolate } from './gridDetection';
import { skeletonizeCellImageData } from './skeletonize';

export interface ExtractedLetterCell {
  letter: string;
  imageDataUrl: string;
  skeletonDataUrl: string;
  confidence: number;
  branchPoints: number;
  skeletonPixels: number;
  bounds: { x: number; y: number; width: number; height: number };
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const GRID_COLS = 4;
const GRID_ROWS = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function cellQuad(corners: OrderedCorners, row: number, col: number): GridPoint[] {
  const leftTop = interpolate(corners.topLeft, corners.bottomLeft, row / GRID_ROWS);
  const leftBottom = interpolate(corners.topLeft, corners.bottomLeft, (row + 1) / GRID_ROWS);
  const rightTop = interpolate(corners.topRight, corners.bottomRight, row / GRID_ROWS);
  const rightBottom = interpolate(corners.topRight, corners.bottomRight, (row + 1) / GRID_ROWS);

  const topLeft = interpolate(leftTop, rightTop, col / GRID_COLS);
  const topRight = interpolate(leftTop, rightTop, (col + 1) / GRID_COLS);
  const bottomRight = interpolate(leftBottom, rightBottom, (col + 1) / GRID_COLS);
  const bottomLeft = interpolate(leftBottom, rightBottom, col / GRID_COLS);

  return [topLeft, topRight, bottomRight, bottomLeft];
}

function quadBounds(quad: GridPoint[], width: number, height: number): { x: number; y: number; width: number; height: number } {
  const xs = quad.map((point) => point.x);
  const ys = quad.map((point) => point.y);

  const minX = clamp(Math.floor(Math.min(...xs)), 0, width - 1);
  const maxX = clamp(Math.ceil(Math.max(...xs)), 1, width);
  const minY = clamp(Math.floor(Math.min(...ys)), 0, height - 1);
  const maxY = clamp(Math.ceil(Math.max(...ys)), 1, height);

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function estimateInkConfidence(imageData: ImageData): number {
  const { data } = imageData;
  let dark = 0;
  const total = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < 115) {
      dark += 1;
    }
  }

  const ratio = dark / Math.max(total, 1);
  return clamp(Math.round(ratio * 650), 0, 100);
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load uploaded image for extraction.'));
  });

  return image;
}

export async function extractLetterCellsFromDataUrl(
  dataUrl: string,
  corners: OrderedCorners,
): Promise<ExtractedLetterCell[]> {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext('2d');

  if (!sourceContext) {
    throw new Error('Could not create source canvas for extraction.');
  }

  sourceContext.drawImage(image, 0, 0, width, height);

  const extracted: ExtractedLetterCell[] = [];

  for (let index = 0; index < LETTERS.length; index += 1) {
    const letter = LETTERS[index];
    const row = Math.floor(index / GRID_COLS);
    const col = index % GRID_COLS;
    const quad = cellQuad(corners, row, col);
    const bounds = quadBounds(quad, width, height);

    const cellImageData = sourceContext.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
    const inkConfidence = estimateInkConfidence(cellImageData);
    const skeleton = skeletonizeCellImageData(cellImageData);
    const confidence = clamp(Math.round((inkConfidence * 0.35) + (skeleton.qualityScore * 0.65)), 0, 100);

    const cellCanvas = document.createElement('canvas');
    cellCanvas.width = bounds.width;
    cellCanvas.height = bounds.height;
    const cellContext = cellCanvas.getContext('2d');

    if (!cellContext) {
      throw new Error('Could not create cell canvas for extraction.');
    }

    cellContext.putImageData(cellImageData, 0, 0);

    extracted.push({
      letter,
      imageDataUrl: cellCanvas.toDataURL('image/png'),
      skeletonDataUrl: skeleton.skeletonDataUrl,
      confidence,
      branchPoints: skeleton.branchPoints,
      skeletonPixels: skeleton.skeletonPixels,
      bounds,
    });
  }

  return extracted;
}
