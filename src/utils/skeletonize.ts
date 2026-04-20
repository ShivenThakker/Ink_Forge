function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

function neighbors(grid: number[][], x: number, y: number): number[] {
  return [
    grid[y - 1]?.[x] ?? 0,
    grid[y - 1]?.[x + 1] ?? 0,
    grid[y]?.[x + 1] ?? 0,
    grid[y + 1]?.[x + 1] ?? 0,
    grid[y + 1]?.[x] ?? 0,
    grid[y + 1]?.[x - 1] ?? 0,
    grid[y]?.[x - 1] ?? 0,
    grid[y - 1]?.[x - 1] ?? 0,
  ];
}

function transitionCount(values: number[]): number {
  let transitions = 0;
  for (let i = 0; i < values.length; i += 1) {
    const current = values[i];
    const next = values[(i + 1) % values.length];
    if (current === 0 && next === 1) {
      transitions += 1;
    }
  }
  return transitions;
}

function otsuThreshold(grayscale: Uint8ClampedArray): number {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < grayscale.length; i += 1) {
    histogram[grayscale[i]] += 1;
  }

  const total = grayscale.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 127;

  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i];
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;

    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

function imageDataToBinaryGrid(imageData: ImageData): number[][] {
  const { width, height, data } = imageData;
  const grayscale = new Uint8ClampedArray(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    const r = data[idx] ?? 255;
    const g = data[idx + 1] ?? 255;
    const b = data[idx + 2] ?? 255;
    grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const threshold = otsuThreshold(grayscale);
  const grid: number[][] = Array.from({ length: height }, () => new Array<number>(width).fill(0));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = grayscale[y * width + x];
      grid[y][x] = value <= threshold ? 1 : 0;
    }
  }

  return grid;
}

function zhangSuenThin(initialGrid: number[][]): number[][] {
  const grid = cloneGrid(initialGrid);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  if (height < 3 || width < 3) {
    return grid;
  }

  let changed = true;
  let guard = 0;

  while (changed && guard < 200) {
    guard += 1;
    changed = false;

    const toDeleteStep1: Array<{ x: number; y: number }> = [];
    const toDeleteStep2: Array<{ x: number; y: number }> = [];

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        if (grid[y][x] !== 1) continue;

        const n = neighbors(grid, x, y);
        const count = n.reduce((acc, value) => acc + value, 0);
        const transitions = transitionCount(n);

        if (count < 2 || count > 6) continue;
        if (transitions !== 1) continue;
        if (n[0] * n[2] * n[4] !== 0) continue;
        if (n[2] * n[4] * n[6] !== 0) continue;

        toDeleteStep1.push({ x, y });
      }
    }

    if (toDeleteStep1.length > 0) {
      changed = true;
      for (const point of toDeleteStep1) {
        grid[point.y][point.x] = 0;
      }
    }

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        if (grid[y][x] !== 1) continue;

        const n = neighbors(grid, x, y);
        const count = n.reduce((acc, value) => acc + value, 0);
        const transitions = transitionCount(n);

        if (count < 2 || count > 6) continue;
        if (transitions !== 1) continue;
        if (n[0] * n[2] * n[6] !== 0) continue;
        if (n[0] * n[4] * n[6] !== 0) continue;

        toDeleteStep2.push({ x, y });
      }
    }

    if (toDeleteStep2.length > 0) {
      changed = true;
      for (const point of toDeleteStep2) {
        grid[point.y][point.x] = 0;
      }
    }
  }

  return grid;
}

function skeletonGridToImageData(grid: number[][]): ImageData {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const buffer = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const ink = grid[y][x] === 1;
      buffer[idx] = ink ? 0 : 255;
      buffer[idx + 1] = ink ? 0 : 255;
      buffer[idx + 2] = ink ? 0 : 255;
      buffer[idx + 3] = 255;
    }
  }

  return new ImageData(buffer, width, height);
}

function analyzeSkeleton(grid: number[][]): { branchPoints: number; skeletonPixels: number; qualityScore: number } {
  let branchPoints = 0;
  let skeletonPixels = 0;

  for (let y = 1; y < grid.length - 1; y += 1) {
    for (let x = 1; x < grid[0].length - 1; x += 1) {
      if (grid[y][x] !== 1) continue;
      skeletonPixels += 1;
      const count = neighbors(grid, x, y).reduce((acc, value) => acc + value, 0);
      if (count >= 3) {
        branchPoints += 1;
      }
    }
  }

  const complexityRatio = branchPoints / Math.max(skeletonPixels, 1);
  const qualityScore = clamp(Math.round((1 - clamp(complexityRatio * 14, 0, 1)) * 100), 0, 100);

  return { branchPoints, skeletonPixels, qualityScore };
}

export interface SkeletonizationResult {
  skeletonDataUrl: string;
  branchPoints: number;
  skeletonPixels: number;
  qualityScore: number;
}

export function skeletonizeCellImageData(imageData: ImageData): SkeletonizationResult {
  const binary = imageDataToBinaryGrid(imageData);
  const thinned = zhangSuenThin(binary);
  const analysis = analyzeSkeleton(thinned);

  const outputImageData = skeletonGridToImageData(thinned);
  const canvas = document.createElement('canvas');
  canvas.width = outputImageData.width;
  canvas.height = outputImageData.height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create canvas for skeleton rendering.');
  }

  context.putImageData(outputImageData, 0, 0);

  return {
    skeletonDataUrl: canvas.toDataURL('image/png'),
    branchPoints: analysis.branchPoints,
    skeletonPixels: analysis.skeletonPixels,
    qualityScore: analysis.qualityScore,
  };
}
