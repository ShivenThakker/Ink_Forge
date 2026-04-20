import { loadOpenCV } from './opencvLoader';

export interface GridPoint {
  x: number;
  y: number;
}

export interface OrderedCorners {
  topLeft: GridPoint;
  topRight: GridPoint;
  bottomRight: GridPoint;
  bottomLeft: GridPoint;
}

export interface GridDetectionResult {
  corners: OrderedCorners;
  imageWidth: number;
  imageHeight: number;
  confidence: number;
  strategy: 'opencv-fiducial' | 'corner-window' | 'default';
  workingImageDataUrl: string;
}

const CORNER_WINDOW_RATIO = 0.26;
const DARK_THRESHOLD = 80;
const MIN_DARK_PIXELS = 100;
const TARGET_WARP_WIDTH = 1200;
const TARGET_WARP_HEIGHT = 1700;

// Ratios derived from TemplateDownload A4 layout constants.
const GRID_BOUNDS_RATIO = {
  left: 15 / 210,
  right: 195 / 210,
  top: 35 / 297,
  bottom: 274 / 297,
};

interface MarkerCandidate {
  center: GridPoint;
  area: number;
}

function average(points: GridPoint[]): GridPoint {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / Math.max(points.length, 1),
    y: sum.y / Math.max(points.length, 1),
  };
}

function readDarkPixels(
  imageData: ImageData,
  startX: number,
  endX: number,
  startY: number,
  endY: number,
): GridPoint[] {
  const points: GridPoint[] = [];
  const { data, width } = imageData;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx] ?? 255;
      const g = data[idx + 1] ?? 255;
      const b = data[idx + 2] ?? 255;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      if (luma <= DARK_THRESHOLD) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

function makeDefaultCorners(width: number, height: number): OrderedCorners {
  const marginX = Math.round(width * 0.1);
  const marginY = Math.round(height * 0.1);
  return {
    topLeft: { x: marginX, y: marginY },
    topRight: { x: width - marginX, y: marginY },
    bottomRight: { x: width - marginX, y: height - marginY },
    bottomLeft: { x: marginX, y: height - marginY },
  };
}

function clampCorners(corners: OrderedCorners, width: number, height: number): OrderedCorners {
  const clampPoint = (point: GridPoint): GridPoint => ({
    x: Math.min(Math.max(point.x, 0), width),
    y: Math.min(Math.max(point.y, 0), height),
  });

  return {
    topLeft: clampPoint(corners.topLeft),
    topRight: clampPoint(corners.topRight),
    bottomRight: clampPoint(corners.bottomRight),
    bottomLeft: clampPoint(corners.bottomLeft),
  };
}

function getTemplateGridCorners(width: number, height: number): OrderedCorners {
  return {
    topLeft: { x: width * GRID_BOUNDS_RATIO.left, y: height * GRID_BOUNDS_RATIO.top },
    topRight: { x: width * GRID_BOUNDS_RATIO.right, y: height * GRID_BOUNDS_RATIO.top },
    bottomRight: { x: width * GRID_BOUNDS_RATIO.right, y: height * GRID_BOUNDS_RATIO.bottom },
    bottomLeft: { x: width * GRID_BOUNDS_RATIO.left, y: height * GRID_BOUNDS_RATIO.bottom },
  };
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

function extractContourPoints(mat: { data32S?: Int32Array; data32F?: Float32Array }): GridPoint[] {
  if (mat.data32S && mat.data32S.length >= 8) {
    const points: GridPoint[] = [];
    for (let i = 0; i < mat.data32S.length; i += 2) {
      points.push({ x: mat.data32S[i], y: mat.data32S[i + 1] });
    }
    return points;
  }

  if (mat.data32F && mat.data32F.length >= 8) {
    const points: GridPoint[] = [];
    for (let i = 0; i < mat.data32F.length; i += 2) {
      points.push({ x: mat.data32F[i], y: mat.data32F[i + 1] });
    }
    return points;
  }

  return [];
}

function pickQuadrantMarkers(candidates: MarkerCandidate[], width: number, height: number): OrderedCorners | null {
  const inTop = (point: GridPoint) => point.y < height / 2;
  const inLeft = (point: GridPoint) => point.x < width / 2;

  const topLeft = candidates
    .filter((candidate) => inTop(candidate.center) && inLeft(candidate.center))
    .sort((a, b) => b.area - a.area)[0];
  const topRight = candidates
    .filter((candidate) => inTop(candidate.center) && !inLeft(candidate.center))
    .sort((a, b) => b.area - a.area)[0];
  const bottomRight = candidates
    .filter((candidate) => !inTop(candidate.center) && !inLeft(candidate.center))
    .sort((a, b) => b.area - a.area)[0];
  const bottomLeft = candidates
    .filter((candidate) => !inTop(candidate.center) && inLeft(candidate.center))
    .sort((a, b) => b.area - a.area)[0];

  if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
    return null;
  }

  return {
    topLeft: topLeft.center,
    topRight: topRight.center,
    bottomRight: bottomRight.center,
    bottomLeft: bottomLeft.center,
  };
}

async function detectGridWithOpenCV(image: HTMLImageElement): Promise<GridDetectionResult | null> {
  try {
    const cv = (await loadOpenCV()) as unknown as {
      Mat: new () => {
        rows: number;
        cols: number;
        data32S?: Int32Array;
        data32F?: Float32Array;
        delete: () => void;
      };
      MatVector: new () => {
        size: () => number;
        get: (index: number) => {
          delete: () => void;
        };
        delete: () => void;
      };
      Size: new (w: number, h: number) => unknown;
      CV_32FC2: number;
      COLOR_RGBA2GRAY: number;
      THRESH_BINARY_INV: number;
      THRESH_OTSU: number;
      RETR_LIST: number;
      CHAIN_APPROX_SIMPLE: number;
      imread: (canvas: HTMLCanvasElement) => {
        rows: number;
        cols: number;
        delete: () => void;
      };
      imshow: (canvas: HTMLCanvasElement, mat: unknown) => void;
      cvtColor: (src: unknown, dst: unknown, code: number) => void;
      GaussianBlur: (src: unknown, dst: unknown, ksize: unknown, sigmaX: number, sigmaY?: number) => void;
      threshold: (src: unknown, dst: unknown, thresh: number, maxval: number, type: number) => void;
      findContours: (src: unknown, contours: unknown, hierarchy: unknown, mode: number, method: number) => void;
      contourArea: (contour: unknown) => number;
      arcLength: (curve: unknown, closed: boolean) => number;
      approxPolyDP: (curve: unknown, approxCurve: unknown, epsilon: number, closed: boolean) => void;
      boundingRect: (contour: unknown) => { x: number; y: number; width: number; height: number };
      matFromArray: (rows: number, cols: number, type: number, data: number[]) => {
        delete: () => void;
      };
      getPerspectiveTransform: (src: unknown, dst: unknown) => {
        delete: () => void;
      };
      warpPerspective: (src: unknown, dst: unknown, matrix: unknown, size: unknown) => void;
    };

    const sourceCanvas = document.createElement('canvas');
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceCtx = sourceCanvas.getContext('2d');

    if (!sourceCtx) {
      return null;
    }

    sourceCtx.drawImage(image, 0, 0, width, height);

    const src = cv.imread(sourceCanvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const binary = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.threshold(blurred, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const minArea = Math.max(350, (width * height) * 0.00008);
    const candidates: MarkerCandidate[] = [];

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < minArea) {
        contour.delete();
        continue;
      }

      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, perimeter * 0.05, true);

      if (approx.rows === 4) {
        const rect = cv.boundingRect(approx);
        const ratio = rect.width / Math.max(rect.height, 1);

        if (ratio > 0.6 && ratio < 1.4) {
          const points = extractContourPoints(approx);
          if (points.length === 4) {
            const center = average(points);
            candidates.push({ center, area });
          }
        }
      }

      approx.delete();
      contour.delete();
    }

    const markerCenters = pickQuadrantMarkers(candidates, width, height);
    if (!markerCenters) {
      src.delete();
      gray.delete();
      blurred.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();
      return null;
    }

    const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      markerCenters.topLeft.x, markerCenters.topLeft.y,
      markerCenters.topRight.x, markerCenters.topRight.y,
      markerCenters.bottomRight.x, markerCenters.bottomRight.y,
      markerCenters.bottomLeft.x, markerCenters.bottomLeft.y,
    ]);

    const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      TARGET_WARP_WIDTH, 0,
      TARGET_WARP_WIDTH, TARGET_WARP_HEIGHT,
      0, TARGET_WARP_HEIGHT,
    ]);

    const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, transform, new cv.Size(TARGET_WARP_WIDTH, TARGET_WARP_HEIGHT));

    const warpedCanvas = document.createElement('canvas');
    warpedCanvas.width = TARGET_WARP_WIDTH;
    warpedCanvas.height = TARGET_WARP_HEIGHT;
    cv.imshow(warpedCanvas, warped);

    const result: GridDetectionResult = {
      corners: getTemplateGridCorners(TARGET_WARP_WIDTH, TARGET_WARP_HEIGHT),
      imageWidth: TARGET_WARP_WIDTH,
      imageHeight: TARGET_WARP_HEIGHT,
      confidence: Math.min(0.99, 0.55 + Math.min(candidates.length, 10) / 20),
      strategy: 'opencv-fiducial',
      workingImageDataUrl: canvasToDataUrl(warpedCanvas),
    };

    src.delete();
    gray.delete();
    blurred.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
    srcPoints.delete();
    dstPoints.delete();
    transform.delete();
    warped.delete();

    return result;
  } catch {
    return null;
  }
}

export function detectGridFromImageElement(image: HTMLImageElement): GridDetectionResult {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = width || 1000;
  rawCanvas.height = height || 1400;
  const rawCtx = rawCanvas.getContext('2d');
  if (rawCtx && width && height) {
    rawCtx.drawImage(image, 0, 0, width, height);
  }
  const rawDataUrl = canvasToDataUrl(rawCanvas);

  if (!width || !height) {
    return {
      corners: makeDefaultCorners(1000, 1400),
      imageWidth: 1000,
      imageHeight: 1400,
      confidence: 0,
      strategy: 'default',
      workingImageDataUrl: rawDataUrl,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    return {
      corners: makeDefaultCorners(width, height),
      imageWidth: width,
      imageHeight: height,
      confidence: 0,
      strategy: 'default',
      workingImageDataUrl: rawDataUrl,
    };
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);

  const windowWidth = Math.max(16, Math.floor(width * CORNER_WINDOW_RATIO));
  const windowHeight = Math.max(16, Math.floor(height * CORNER_WINDOW_RATIO));

  const topLeftPoints = readDarkPixels(imageData, 0, windowWidth, 0, windowHeight);
  const topRightPoints = readDarkPixels(imageData, width - windowWidth, width, 0, windowHeight);
  const bottomRightPoints = readDarkPixels(
    imageData,
    width - windowWidth,
    width,
    height - windowHeight,
    height,
  );
  const bottomLeftPoints = readDarkPixels(imageData, 0, windowWidth, height - windowHeight, height);

  const allCounts = [
    topLeftPoints.length,
    topRightPoints.length,
    bottomRightPoints.length,
    bottomLeftPoints.length,
  ];

  const enoughSignal = allCounts.every((count) => count >= MIN_DARK_PIXELS);

  if (!enoughSignal) {
    return {
      corners: makeDefaultCorners(width, height),
      imageWidth: width,
      imageHeight: height,
      confidence: Math.min(allCounts.reduce((a, b) => a + b, 0) / (MIN_DARK_PIXELS * 4), 0.5),
      strategy: 'default',
      workingImageDataUrl: rawDataUrl,
    };
  }

  const corners = clampCorners(
    {
      topLeft: average(topLeftPoints),
      topRight: average(topRightPoints),
      bottomRight: average(bottomRightPoints),
      bottomLeft: average(bottomLeftPoints),
    },
    width,
    height,
  );

  const meanCount = allCounts.reduce((a, b) => a + b, 0) / 4;
  const confidence = Math.min(1, meanCount / (MIN_DARK_PIXELS * 8));

  return {
    corners,
    imageWidth: width,
    imageHeight: height,
    confidence,
    strategy: 'corner-window',
    workingImageDataUrl: rawDataUrl,
  };
}

export async function detectGridFromDataUrl(dataUrl: string): Promise<GridDetectionResult> {
  const image = new Image();
  image.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load uploaded image.'));
  });

  const opencvDetected = await detectGridWithOpenCV(image);
  if (opencvDetected) {
    return opencvDetected;
  }

  return detectGridFromImageElement(image);
}

export function interpolate(a: GridPoint, b: GridPoint, t: number): GridPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function getGridLines(corners: OrderedCorners, cols = 4, rows = 7): GridPoint[][] {
  const lines: GridPoint[][] = [];

  for (let r = 0; r <= rows; r += 1) {
    const t = r / rows;
    const left = interpolate(corners.topLeft, corners.bottomLeft, t);
    const right = interpolate(corners.topRight, corners.bottomRight, t);
    lines.push([left, right]);
  }

  for (let c = 0; c <= cols; c += 1) {
    const t = c / cols;
    const top = interpolate(corners.topLeft, corners.topRight, t);
    const bottom = interpolate(corners.bottomLeft, corners.bottomRight, t);
    lines.push([top, bottom]);
  }

  return lines;
}
