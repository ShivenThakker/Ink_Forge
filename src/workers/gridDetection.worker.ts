import * as Comlink from 'comlink';
import { loadOpenCV } from '../utils/opencvLoader';
import type { GridPoint, OrderedCorners } from '../utils/gridDetection';

const TARGET_WARP_WIDTH = 1200;
const TARGET_WARP_HEIGHT = 1700;
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

interface WorkerGridDetectionResult {
  corners: OrderedCorners;
  imageWidth: number;
  imageHeight: number;
  confidence: number;
  strategy: 'opencv-fiducial';
  workingImageDataUrl: string;
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

function getTemplateGridCorners(width: number, height: number): OrderedCorners {
  return {
    topLeft: { x: width * GRID_BOUNDS_RATIO.left, y: height * GRID_BOUNDS_RATIO.top },
    topRight: { x: width * GRID_BOUNDS_RATIO.right, y: height * GRID_BOUNDS_RATIO.top },
    bottomRight: { x: width * GRID_BOUNDS_RATIO.right, y: height * GRID_BOUNDS_RATIO.bottom },
    bottomLeft: { x: width * GRID_BOUNDS_RATIO.left, y: height * GRID_BOUNDS_RATIO.bottom },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert worker image blob to data URL.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read worker image blob.'));
    reader.readAsDataURL(blob);
  });
}

async function detectGrid(imageData: ImageData): Promise<WorkerGridDetectionResult | null> {
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
      INTER_AREA: number;
      matFromImageData: (imageData: ImageData) => {
        rows: number;
        cols: number;
        delete: () => void;
      };
      imshow: (canvas: OffscreenCanvas, mat: unknown) => void;
      resize: (src: unknown, dst: unknown, dsize: unknown, fx?: number, fy?: number, interpolation?: number) => void;
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

    const srcFull = cv.matFromImageData(imageData);
    const width = srcFull.cols;
    const height = srcFull.rows;

    const MAX_DIM = 1200;
    const scale = Math.min(MAX_DIM / width, MAX_DIM / height, 1.0);
    let working = srcFull;
    if (scale < 1.0) {
      const resized = new cv.Mat();
      const newSize = new cv.Size(Math.round(width * scale), Math.round(height * scale));
      cv.resize(srcFull, resized, newSize, 0, 0, cv.INTER_AREA);
      working = resized;
    }

    const scaleFactor = scale;
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const binary = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.threshold(blurred, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    console.log('[contours] count:', contours.size());

    if (contours.size() > 2000) {
      if (working !== srcFull) working.delete();
      srcFull.delete();
      gray.delete();
      blurred.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();
      throw new Error(`Too many contours: ${contours.size()} -- image too complex or threshold failed`);
    }

    const minArea = Math.max(350, (working.cols * working.rows) * 0.00008);
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

    const markerCenters = pickQuadrantMarkers(candidates, working.cols, working.rows);
    if (!markerCenters) {
      if (working !== srcFull) {
        working.delete();
      }
      srcFull.delete();
      gray.delete();
      blurred.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();
      return null;
    }

    const mapToOriginal = (point: GridPoint): GridPoint => {
      if (scaleFactor >= 1.0) {
        return point;
      }

      return {
        x: point.x / scaleFactor,
        y: point.y / scaleFactor,
      };
    };

    const mappedMarkerCenters = {
      topLeft: mapToOriginal(markerCenters.topLeft),
      topRight: mapToOriginal(markerCenters.topRight),
      bottomRight: mapToOriginal(markerCenters.bottomRight),
      bottomLeft: mapToOriginal(markerCenters.bottomLeft),
    };

    const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      mappedMarkerCenters.topLeft.x, mappedMarkerCenters.topLeft.y,
      mappedMarkerCenters.topRight.x, mappedMarkerCenters.topRight.y,
      mappedMarkerCenters.bottomRight.x, mappedMarkerCenters.bottomRight.y,
      mappedMarkerCenters.bottomLeft.x, mappedMarkerCenters.bottomLeft.y,
    ]);

    const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      TARGET_WARP_WIDTH, 0,
      TARGET_WARP_WIDTH, TARGET_WARP_HEIGHT,
      0, TARGET_WARP_HEIGHT,
    ]);

    const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
    const warped = new cv.Mat();
    cv.warpPerspective(srcFull, warped, transform, new cv.Size(TARGET_WARP_WIDTH, TARGET_WARP_HEIGHT));

    const warpedCanvas = new OffscreenCanvas(TARGET_WARP_WIDTH, TARGET_WARP_HEIGHT);
    cv.imshow(warpedCanvas, warped);
    const blob = await warpedCanvas.convertToBlob({ type: 'image/png' });

    const result: WorkerGridDetectionResult = {
      corners: getTemplateGridCorners(TARGET_WARP_WIDTH, TARGET_WARP_HEIGHT),
      imageWidth: TARGET_WARP_WIDTH,
      imageHeight: TARGET_WARP_HEIGHT,
      confidence: Math.min(0.99, 0.55 + Math.min(candidates.length, 10) / 20),
      strategy: 'opencv-fiducial',
      workingImageDataUrl: await blobToDataUrl(blob),
    };

    if (working !== srcFull) {
      working.delete();
    }
    srcFull.delete();
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
  } catch (e) {
    console.error('WORKER INTERNAL ERROR:', e);
    throw e;
  }
}

const workerApi = {
  detectGrid,
};

Comlink.expose(workerApi);

export type GridWorker = typeof workerApi;
