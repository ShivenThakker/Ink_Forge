// OpenCV.js lazy loader utility
// Loads OpenCV.js (~8MB WASM) on demand and caches it

type OpenCVResolve = (cv: OpenCV) => void;
type OpenCVReject = (error: Error) => void;

interface OpenCV {
  imread: (canvas: HTMLCanvasElement | string) => Mat;
  imshow: (canvas: HTMLCanvasElement | string, mat: Mat) => void;
  Mat: new (rows?: number, cols?: number, type?: number) => Mat;
  cvtColor: (src: Mat, dst: Mat, code: number) => void;
  GaussianBlur: (src: Mat, dst: Mat, ksize: Size, sigmaX: number) => void;
  adaptiveThreshold: (
    src: Mat,
    dst: Mat,
    maxValue: number,
    adaptiveMethod: number,
    thresholdType: number,
    blockSize: number,
    C: number
  ) => void;
  threshold: (src: Mat, dst: Mat, thresh: number, maxval: number, type: number) => void;
  findContours: (image: Mat, contours: Contours, hierarchy: Mat, mode: number, method: number) => void;
  contourArea: (contour: Mat, oriented?: boolean) => number;
  arcLength: (curve: Mat, closed: boolean) => number;
  approxPolyDP: (curve: Mat, approxCurve: Mat, epsilon: number, closed: boolean) => void;
  boundingRect: (points: Mat) => Rect;
  getPerspectiveTransform: (src: Point2[], dst: Point2[]) => Mat;
  warpPerspective: (src: Mat, dst: Mat, M: Mat, dsize: Size) => void;
  morphologyEx: (src: Mat, dst: Mat, op: number, kernel: Mat) => void;
  getStructuringElement: (shape: number, ksize: Size) => Mat;
  bitwise_not: (src: Mat, dst: Mat) => void;
  inRange: (src: Mat, lowerb: Scalar, upperb: Scalar, dst: Mat) => void;
  Point: new (x: number, y: number) => Point;
  Scalar: new (v0: number, v1?: number, v2?: number, v3?: number) => Scalar;
  Size: new (width: number, height: number) => Size;
  Rect: new (x: number, y: number, width: number, height: number) => Rect;
  COLOR_RGBA2GRAY: number;
  COLOR_RGB2GRAY: number;
  COLOR_GRAY2BGRA: number;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;
  ADAPTIVE_THRESH_MEAN_C: number;
  THRESH_BINARY: number;
  THRESH_BINARY_INV: number;
  THRESH_OTSU: number;
  RETR_EXTERNAL: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  CHAIN_APPROX_NONE: number;
  MORPH_CLOSE: number;
  MORPH_RECT: number;
  MORPH_ELLIPSE: number;
  MORPH_CROSS: number;
  CV_8UC1: number;
  CV_8UC3: number;
  CV_8UC4: number;
}

interface Mat {
  rows: number;
  cols: number;
  data: Uint8Array;
  delete: () => void;
  clone: () => Mat;
  copyTo: (dst: Mat) => void;
  roi: (rect: Rect) => Mat;
  at: (row: number, col: number) => number[];
  setTo: (value: Scalar) => void;
}

interface Contours {
  size: number;
  get: (index: number) => Mat;
  push: (mat: Mat) => void;
  delete: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface Point2 {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface Scalar {
  value: number[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// OpenCV.js constants (will be populated after loading)
export const CV = {
  COLOR_RGBA2GRAY: 7,
  COLOR_RGB2GRAY: 7,
  COLOR_GRAY2BGRA: 8,
  ADAPTIVE_THRESH_GAUSSIAN_C: 1,
  ADAPTIVE_THRESH_MEAN_C: 0,
  THRESH_BINARY: 0,
  THRESH_BINARY_INV: 1,
  THRESH_OTSU: 8,
  RETR_EXTERNAL: 0,
  RETR_LIST: 1,
  CHAIN_APPROX_SIMPLE: 2,
  CHAIN_APPROX_NONE: 1,
  MORPH_CLOSE: 3,
  MORPH_RECT: 0,
  MORPH_ELLIPSE: 2,
  MORPH_CROSS: 1,
  CV_8UC1: 0,
  CV_8UC3: 16,
  CV_8UC4: 24,
};

// Singleton state
let cvInstance: OpenCV | null = null;
let isLoading = false;
const waitingQueue: { resolve: OpenCVResolve; reject: OpenCVReject }[] = [];
const OPENCV_CDN_URL = '/opencv.js';

function getGlobalScope(): { cv?: OpenCV; importScripts?: (...urls: string[]) => void } {
  return globalThis as unknown as { cv?: OpenCV; importScripts?: (...urls: string[]) => void };
}

function resolveQueue(instance: OpenCV): void {
  waitingQueue.forEach(({ resolve }) => resolve(instance));
  waitingQueue.length = 0;
}

function rejectQueue(error: Error): void {
  waitingQueue.forEach(({ reject }) => reject(error));
  waitingQueue.length = 0;
}

async function waitForOpenCVGlobal(timeoutMs = 30000): Promise<OpenCV> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const maybeCV = getGlobalScope().cv as OpenCV | Promise<OpenCV> | undefined;
    if (maybeCV) {
      if (typeof (maybeCV as Promise<OpenCV>).then === 'function') {
        return await (maybeCV as Promise<OpenCV>);
      }
      return maybeCV;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('OpenCV.js load timeout');
}

async function loadOpenCVInWorker(): Promise<OpenCV> {
  const response = await fetch(OPENCV_CDN_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenCV.js: ${response.status}`);
  }
  const scriptText = await response.text();
  (new Function(scriptText))();

  return waitForOpenCVGlobal();
}

// Load OpenCV.js and return the cv object
export async function loadOpenCV(): Promise<OpenCV> {
  // Already loaded
  if (cvInstance) {
    return cvInstance;
  }

  // Currently loading - wait in queue
  if (isLoading) {
    return new Promise((resolve, reject) => {
      waitingQueue.push({ resolve, reject });
    });
  }

  isLoading = true;

  return new Promise((resolve, reject) => {
    const globalScope = getGlobalScope();

    // Check if already loaded globally
    if (globalScope.cv) {
      cvInstance = globalScope.cv;
      isLoading = false;
      resolve(cvInstance);
      return;
    }

    if (typeof document === 'undefined') {
      loadOpenCVInWorker()
        .then((cv) => {
          cvInstance = cv;
          isLoading = false;
          resolveQueue(cv);
          resolve(cv);
        })
        .catch((error) => {
          isLoading = false;
          const normalizedError = error instanceof Error ? error : new Error('Failed to load OpenCV.js');
          rejectQueue(normalizedError);
          reject(normalizedError);
        });
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = OPENCV_CDN_URL;
    script.async = true;

    script.onload = () => {
      // Wait for cv to be available (OpenCV.js sets it asynchronously)
      const checkCV = setInterval(() => {
        const maybeCV = getGlobalScope().cv;
        if (maybeCV) {
          clearInterval(checkCV);
          cvInstance = maybeCV;
          isLoading = false;

          // Resolve all waiting promises
          resolveQueue(cvInstance);

          resolve(cvInstance);
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkCV);
        if (!cvInstance) {
          isLoading = false;
          const error = new Error('OpenCV.js load timeout');
          rejectQueue(error);
          reject(error);
        }
      }, 30000);
    };

    script.onerror = () => {
      isLoading = false;
      const error = new Error('Failed to load OpenCV.js');
      rejectQueue(error);
      reject(error);
    };

    document.head.appendChild(script);
  });
}

// Check if OpenCV is loaded
export function isOpenCVLoaded(): boolean {
  return cvInstance !== null;
}

// Get OpenCV instance (throws if not loaded)
export function getOpenCV(): OpenCV {
  if (!cvInstance) {
    throw new Error('OpenCV not loaded. Call loadOpenCV() first.');
  }
  return cvInstance;
}

export type { OpenCV, Mat, Contours, Point, Size, Scalar, Rect };