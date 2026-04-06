import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { LetterDefinition, Point, StrokeDefinition } from '../engine/types';
import { catmullRomToPath, roundnessToTension } from '../engine/spline';
import { normalizeLetter } from '../engine/normalize';
import './LetterEditor.css';

const GRID_SIZE = 100;
const SVG_SIZE = 500;
const SCALE = SVG_SIZE / GRID_SIZE;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

interface LetterEditorProps {
  char?: string;
  sourceLetter?: LetterDefinition;
  anchorCount?: number;
  onExport?: (definition: LetterDefinition) => void;
}

interface EditorStroke extends StrokeDefinition {
  id: string;
}

function createStrokeId() {
  return `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyEditorStrokes(): EditorStroke[] {
  return [{ id: createStrokeId(), anchors: [] }];
}

function cloneLetterStrokes(sourceLetter?: LetterDefinition): EditorStroke[] {
  const sourceStrokes = sourceLetter?.strokes ?? [];
  if (sourceStrokes.length === 0) return [{ id: createStrokeId(), anchors: [] }];

  return sourceStrokes.map((stroke) => ({
    id: createStrokeId(),
    anchors: stroke.anchors.map((anchor) => ({ ...anchor })),
  }));
}

function getEntryExit(strokes: EditorStroke[]): Pick<LetterDefinition, 'entry' | 'exit'> {
  const nonEmpty = strokes.filter((stroke) => stroke.anchors.length > 0);
  if (nonEmpty.length === 0) {
    return { entry: undefined, exit: undefined };
  }

  const first = nonEmpty[0].anchors[0];
  const lastStroke = nonEmpty[nonEmpty.length - 1];
  const last = lastStroke.anchors[lastStroke.anchors.length - 1];
  return {
    entry: { x: first.x, y: first.y },
    exit: { x: last.x, y: last.y },
  };
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

  for (let i = 1; i < points.length - 1; i++) {
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
  const clampedCount = Math.max(2, Math.min(30, anchorCount));
  const t = (clampedCount - 2) / 28;
  const maxEpsilon = 6;
  const minEpsilon = 0.35;
  return maxEpsilon - t * (maxEpsilon - minEpsilon);
}

function simplifyStrokePoints(points: Point[], anchorCount: number): Point[] {
  if (points.length <= 2) return points;
  const epsilon = mapAnchorCountToEpsilon(anchorCount);
  const simplified = rdp(points, epsilon);
  if (simplified.length >= 2) return simplified;
  return [points[0], points[points.length - 1]];
}

export function LetterEditor({ char = 'a', sourceLetter, anchorCount = 8, onExport }: LetterEditorProps) {
  const [strokes, setStrokes] = useState<EditorStroke[]>(() => createEmptyEditorStrokes());
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [isMiddleMoveActive, setIsMiddleMoveActive] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isPanActive, setIsPanActive] = useState(false);
  const [toolMode, setToolMode] = useState<'anchor' | 'pencil'>('anchor');
  const [freehandStrokes, setFreehandStrokes] = useState<Point[][]>([]);
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);
  const [history, setHistory] = useState<EditorStroke[][]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<{ mouseX: number; mouseY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const suppressNextCanvasClickRef = useRef(false);

  const generateId = () => `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const strokePalette = useMemo(() => ['#2563eb', '#16a34a', '#d97706', '#0891b2', '#dc2626', '#7c3aed'], []);

  const cloneStrokes = useCallback((value: EditorStroke[]): EditorStroke[] => value.map((stroke) => ({
    ...stroke,
    anchors: stroke.anchors.map((anchor) => ({ ...anchor })),
  })), []);

  const pushHistorySnapshot = useCallback((snapshot: EditorStroke[]) => {
    setHistory((prev) => [...prev, cloneStrokes(snapshot)].slice(-120));
  }, [cloneStrokes]);

  const commitStructuralChange = useCallback((updater: (prev: EditorStroke[]) => EditorStroke[]) => {
    setStrokes((prev) => {
      pushHistorySnapshot(prev);
      return updater(prev);
    });
  }, [pushHistorySnapshot]);

  useEffect(() => {
    const next = createEmptyEditorStrokes();
    setStrokes(next);
    setSelectedStrokeId(next[0]?.id ?? null);
    setSelectedAnchorId(null);
    setIsMiddleMoveActive(false);
    setFreehandStrokes([]);
    setIsDrawingFreehand(false);
    setHistory([]);
  }, [sourceLetter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (selectedAnchorId) {
        commitStructuralChange((prev) =>
          prev.map((stroke) => ({
            ...stroke,
            anchors: stroke.anchors.filter((anchor) => anchor.id !== selectedAnchorId),
          })),
        );
        setSelectedAnchorId(null);
        return;
      }

      if (!selectedStrokeId) return;
      commitStructuralChange((prev) => {
        if (prev.length <= 1) {
          return [{ id: createStrokeId(), anchors: [] }];
        }
        const filtered = prev.filter((stroke) => stroke.id !== selectedStrokeId);
        return filtered.length > 0 ? filtered : [{ id: createStrokeId(), anchors: [] }];
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commitStructuralChange, selectedAnchorId, selectedStrokeId]);

  useEffect(() => {
    if (selectedStrokeId && strokes.some((stroke) => stroke.id === selectedStrokeId)) return;
    setSelectedStrokeId(strokes[0]?.id ?? null);
  }, [selectedStrokeId, strokes]);

  useEffect(() => {
    if (!selectedAnchorId) return;
    const exists = strokes.some((stroke) => stroke.anchors.some((anchor) => anchor.id === selectedAnchorId));
    if (!exists) {
      setSelectedAnchorId(null);
    }
  }, [selectedAnchorId, strokes]);

  const screenToGrid = useCallback((clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const gridScaleX = rect.width / GRID_SIZE;
    const gridScaleY = rect.height / GRID_SIZE;
    const x = (clientX - rect.left) / gridScaleX;
    const y = (clientY - rect.top) / gridScaleY;
    return {
      x: Math.max(0, Math.min(GRID_SIZE, Math.round(x * 10) / 10)),
      y: Math.max(0, Math.min(GRID_SIZE, Math.round(y * 10) / 10)),
    };
  }, []);

  const handleWheelZoom = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    const viewportX = event.clientX - wrapRect.left;
    const viewportY = event.clientY - wrapRect.top;
    const contentX = wrap.scrollLeft + viewportX;
    const contentY = wrap.scrollTop + viewportY;

    setZoom((prev) => {
      const next = prev + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
      const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
      const rounded = Math.round(clamped * 10) / 10;

      const worldX = contentX / prev;
      const worldY = contentY / prev;

      requestAnimationFrame(() => {
        const currentWrap = canvasWrapRef.current;
        if (!currentWrap) return;
        if (rounded <= 1) {
          currentWrap.scrollLeft = 0;
          currentWrap.scrollTop = 0;
          return;
        }
        currentWrap.scrollLeft = worldX * rounded - viewportX;
        currentWrap.scrollTop = worldY * rounded - viewportY;
      });

      return rounded;
    });
  }, []);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (suppressNextCanvasClickRef.current) {
      suppressNextCanvasClickRef.current = false;
      return;
    }

    if (toolMode !== 'anchor') return;
    const target = e.target as Element;
    const isCanvasSurface =
      target === svgRef.current ||
      target.classList.contains('grid-line') ||
      target.classList.contains('grid-background');
    if (!isCanvasSurface) return;

    if (selectedAnchorId) {
      setSelectedAnchorId(null);
      return;
    }

    const pos = screenToGrid(e.clientX, e.clientY);

    commitStructuralChange((prev) => {
      const targetStrokeId = selectedStrokeId || prev[0]?.id;
      if (!targetStrokeId) {
        return [{ id: createStrokeId(), anchors: [{ id: generateId(), ...pos, type: 'normal' }] }];
      }

      return prev.map((stroke) =>
        stroke.id === targetStrokeId
          ? {
              ...stroke,
              anchors: [...stroke.anchors, { id: generateId(), ...pos, type: 'normal' }],
            }
          : stroke,
      );
    });
  }, [commitStructuralChange, screenToGrid, selectedAnchorId, selectedStrokeId, toolMode]);

  const handlePanMouseDownCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || zoom <= 1 || toolMode !== 'anchor') return;
    const target = event.target as Element;
    const isCanvasSurface =
      target === svgRef.current ||
      target.classList.contains('grid-line') ||
      target.classList.contains('grid-background');
    if (!isCanvasSurface) return;

    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    panStateRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      scrollLeft: wrap.scrollLeft,
      scrollTop: wrap.scrollTop,
    };
    setIsPanActive(true);
    suppressNextCanvasClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, [toolMode, zoom]);

  const handlePanMouseMoveCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanActive) return;
    const panState = panStateRef.current;
    const wrap = canvasWrapRef.current;
    if (!panState || !wrap) return;

    const dx = event.clientX - panState.mouseX;
    const dy = event.clientY - panState.mouseY;
    wrap.scrollLeft = panState.scrollLeft - dx;
    wrap.scrollTop = panState.scrollTop - dy;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      suppressNextCanvasClickRef.current = true;
    }

    event.preventDefault();
    event.stopPropagation();
  }, [isPanActive]);

  const stopPan = useCallback(() => {
    panStateRef.current = null;
    setIsPanActive(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (toolMode !== 'anchor') return;

    const nextStrokeId = createStrokeId();
    commitStructuralChange((prev) => [...prev, { id: nextStrokeId, anchors: [] }]);
    setSelectedStrokeId(nextStrokeId);
    setSelectedAnchorId(null);
  }, [commitStructuralChange, toolMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanActive) return;

    if (toolMode === 'pencil') {
      if (!isDrawingFreehand) return;
      const pos = screenToGrid(e.clientX, e.clientY);
      setFreehandStrokes((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const current = next[next.length - 1];
        const last = current[current.length - 1];
        if (!last || Math.hypot(last.x - pos.x, last.y - pos.y) >= 0.2) {
          current.push(pos);
        }
        return next;
      });
      return;
    }

    if (!selectedAnchorId || !isMiddleMoveActive) return;
    const pos = screenToGrid(e.clientX, e.clientY);
    setStrokes((prev) => {
      let changed = false;
      const next = prev.map((stroke) => ({
        ...stroke,
        anchors: stroke.anchors.map((anchor) => {
          if (anchor.id !== selectedAnchorId) return anchor;
          if (anchor.x === pos.x && anchor.y === pos.y) return anchor;
          changed = true;
          return { ...anchor, ...pos };
        }),
      }));
      return changed ? next : prev;
    });
  }, [isDrawingFreehand, isMiddleMoveActive, isPanActive, screenToGrid, selectedAnchorId, toolMode]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (toolMode === 'pencil') {
      if (e.button !== 0) return;
      const pos = screenToGrid(e.clientX, e.clientY);
      setFreehandStrokes((prev) => [...prev, [pos]]);
      setIsDrawingFreehand(true);
      return;
    }

    if (e.button !== 1 || !selectedAnchorId) return;
    e.preventDefault();
    pushHistorySnapshot(strokes);
    setIsMiddleMoveActive(true);
  }, [pushHistorySnapshot, screenToGrid, selectedAnchorId, strokes, toolMode]);

  const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (toolMode === 'pencil') {
      if (e.button !== 0) return;
      setIsDrawingFreehand(false);
      return;
    }

    if (e.button !== 1) return;
    setIsMiddleMoveActive(false);
  }, [toolMode]);

  const handleAnchorClick = useCallback((e: React.MouseEvent, id: string, strokeId: string) => {
    if (toolMode !== 'anchor') return;
    e.stopPropagation();
    setSelectedStrokeId(strokeId);
    if (selectedAnchorId === id) {
      setSelectedAnchorId(null);
      setIsMiddleMoveActive(false);
      return;
    }
    setSelectedAnchorId(id);
    setIsMiddleMoveActive(false);
  }, [selectedAnchorId, toolMode]);

  const handleStrokeSelect = useCallback((e: React.MouseEvent, strokeId: string) => {
    if (toolMode !== 'anchor') return;
    e.stopPropagation();
    setSelectedStrokeId(strokeId);
    setSelectedAnchorId(null);
    setIsMiddleMoveActive(false);
  }, [toolMode]);

  const clearAnchors = useCallback(() => {
    const id = createStrokeId();
    commitStructuralChange(() => [{ id, anchors: [] }]);
    setSelectedStrokeId(id);
    setSelectedAnchorId(null);
    setIsMiddleMoveActive(false);
  }, [commitStructuralChange]);

  const deleteSelectedAnchor = useCallback(() => {
    if (!selectedAnchorId) return;
    commitStructuralChange((prev) =>
      prev.map((stroke) => ({
        ...stroke,
        anchors: stroke.anchors.filter((anchor) => anchor.id !== selectedAnchorId),
      })),
    );
    setSelectedAnchorId(null);
  }, [commitStructuralChange, selectedAnchorId]);

  const generateAnchorsFromDrawing = useCallback(() => {
    if (freehandStrokes.length === 0) return;

    const nextStrokes = freehandStrokes
      .map((strokePoints, strokeIndex) => {
        const simplified = simplifyStrokePoints(strokePoints, anchorCount);
        return {
          id: createStrokeId(),
          anchors: simplified.map((point, pointIndex) => ({
            id: `anchor_auto_${strokeIndex}_${pointIndex}_${Math.random().toString(36).slice(2, 7)}`,
            x: point.x,
            y: point.y,
            type: 'normal' as const,
          })),
        };
      })
      .filter((stroke) => stroke.anchors.length >= 2);

    if (nextStrokes.length === 0) return;

    pushHistorySnapshot(strokes);
    setStrokes(nextStrokes);
    setSelectedStrokeId(nextStrokes[0].id);
    setSelectedAnchorId(null);
    setToolMode('anchor');
    setIsDrawingFreehand(false);
  }, [anchorCount, freehandStrokes, pushHistorySnapshot, strokes]);

  const clearDrawing = useCallback(() => {
    setFreehandStrokes([]);
    setIsDrawingFreehand(false);
  }, []);

  const undoLastChange = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory;
      const snapshot = prevHistory[prevHistory.length - 1];
      setStrokes(cloneStrokes(snapshot));
      return prevHistory.slice(0, -1);
    });
    setSelectedAnchorId(null);
    setIsMiddleMoveActive(false);
  }, [cloneStrokes]);

  const normalizedSourceLetter = sourceLetter ? normalizeLetter(sourceLetter) : undefined;
  const sourceGhostStrokes = normalizedSourceLetter?.strokes?.filter((stroke) => stroke.anchors.length >= 2) ?? [];
  const guideLines = [
    { y: 10, label: 'Ascender' },
    { y: 45, label: 'x-height' },
    { y: 70, label: 'Baseline' },
    { y: 90, label: 'Descender' },
  ];

  const handleExport = () => {
    const persistedStrokes = strokes
      .filter((stroke) => stroke.anchors.length > 0)
      .map((stroke) => ({
        anchors: stroke.anchors.map((anchor) => ({ ...anchor })),
      }));
    const { entry, exit } = getEntryExit(strokes);
    const normalized = normalizeLetter({ char, strokes: persistedStrokes, entry, exit });
    if (onExport) {
      onExport(normalized);
    } else {
      const json = JSON.stringify(normalized, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `letter_${char}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="letter-editor">
      <div className="editor-header">
        <h3>Letter: <strong>{char}</strong></h3>
        <div className="editor-controls">
          <button
            onClick={() => {
              setToolMode('anchor');
              setIsDrawingFreehand(false);
            }}
            disabled={toolMode === 'anchor'}
          >
            Anchor Tool
          </button>
          <button
            onClick={() => {
              setToolMode('pencil');
              setSelectedAnchorId(null);
              setIsMiddleMoveActive(false);
            }}
            disabled={toolMode === 'pencil'}
          >
            Pencil Tool
          </button>
          <button onClick={generateAnchorsFromDrawing} disabled={freehandStrokes.length === 0}>
            Generate Anchors
          </button>
          <button onClick={clearDrawing} disabled={freehandStrokes.length === 0}>
            Clear Drawing
          </button>
          <button
            onClick={() => {
              const next = cloneLetterStrokes(sourceLetter);
              setStrokes(next);
              setSelectedStrokeId(next[0]?.id ?? null);
              setSelectedAnchorId(null);
              setIsMiddleMoveActive(false);
              setFreehandStrokes([]);
              setIsDrawingFreehand(false);
              setHistory([]);
            }}
            disabled={!sourceLetter || sourceLetter.strokes.length === 0}
          >
            Load Existing
          </button>
          <button onClick={undoLastChange} disabled={history.length === 0}>
            Undo
          </button>
          <button onClick={deleteSelectedAnchor} disabled={!selectedAnchorId}>
            Delete Anchor
          </button>
          <button onClick={clearAnchors} disabled={strokes.every((stroke) => stroke.anchors.length === 0)}>
            Clear
          </button>
          <button onClick={handleExport} disabled={strokes.every((stroke) => stroke.anchors.length < 2)}>
            Save Letter
          </button>
        </div>
      </div>

      <div className="zoom-controls">
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <button
          onClick={() => {
            setZoom(1);
            const wrap = canvasWrapRef.current;
            if (wrap) {
              wrap.scrollLeft = 0;
              wrap.scrollTop = 0;
            }
          }}
          disabled={zoom === 1}
        >
          Reset Zoom
        </button>
      </div>

      <div
        ref={canvasWrapRef}
        className={`editor-canvas-wrap ${zoom > 1 ? 'is-pannable' : ''} ${isPanActive ? 'is-panning' : ''}`}
        style={{ overflow: 'hidden' }}
        onMouseDownCapture={handlePanMouseDownCapture}
        onMouseMoveCapture={handlePanMouseMoveCapture}
        onMouseUpCapture={stopPan}
        onMouseLeave={stopPan}
        onWheel={handleWheelZoom}
        onWheelCapture={handleWheelZoom}
      >
      <svg
        ref={svgRef}
        className="editor-canvas"
        width={SVG_SIZE * zoom}
        height={SVG_SIZE * zoom}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        onClick={handleSvgClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsMiddleMoveActive(false);
          setIsDrawingFreehand(false);
          stopPan();
        }}
      >
        {/* Layer 1: Ghost reference letter */}
        {sourceGhostStrokes.map((stroke, index) => (
          <path
            key={`ghost-letter-${index}`}
            d={catmullRomToPath(
              stroke.anchors.map((a) => ({ x: a.x * SCALE, y: a.y * SCALE })),
              roundnessToTension(0.5),
            )}
            fill="none"
            stroke="#4b5563"
            strokeWidth="2"
            opacity="0.15"
          />
        ))}

        {/* Layer 1: Always-on vertical guides */}
        {guideLines.map((guide) => (
          <g key={`guide-${guide.label}`}>
            <line
              x1="0"
              y1={guide.y * SCALE}
              x2={SVG_SIZE}
              y2={guide.y * SCALE}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="5,4"
              opacity="0.55"
            />
            <text
              x="6"
              y={guide.y * SCALE - 4}
              fill="#6b7280"
              fontSize="10"
              opacity="0.85"
            >
              {guide.label}
            </text>
          </g>
        ))}

        {/* Grid */}
        <defs>
          <pattern id="grid" width={SCALE * 10} height={SCALE * 10} patternUnits="userSpaceOnUse">
            <path d={`M ${SCALE * 10} 0 L 0 0 0 ${SCALE * 10}`} fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={SVG_SIZE} height={SVG_SIZE} fill="url(#grid)" className="grid-background" />
        <rect x="0.5" y="0.5" width={SVG_SIZE - 1} height={SVG_SIZE - 1} className="grid-boundary" />

        {/* Baseline indicator */}
        <line
          x1="0" y1={SCALE * 70}
          x2={SVG_SIZE} y2={SCALE * 70}
          stroke="#9aa3b2"
          strokeWidth="1.5"
          strokeDasharray="6,4"
          className="grid-line"
        />

        {/* Freehand ghost paths */}
        {freehandStrokes.map((strokePoints, index) => {
          if (strokePoints.length < 2) return null;
          const d = strokePoints
            .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${point.x * SCALE} ${point.y * SCALE}`)
            .join(' ');
          return (
            <path
              key={`freehand-${index}`}
              d={d}
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              opacity="0.38"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Stroke previews */}
        {strokes.map((stroke, strokeIndex) => {
          if (stroke.anchors.length < 2) return null;
          const isActive = stroke.id === selectedStrokeId;
          const baseColor = strokePalette[strokeIndex % strokePalette.length];
          return (
            <path
              key={`stroke-${stroke.id}`}
              d={catmullRomToPath(stroke.anchors.map((a) => ({ x: a.x * SCALE, y: a.y * SCALE })), roundnessToTension(0.5))}
              fill="none"
              stroke={isActive ? '#111827' : baseColor}
              strokeWidth={isActive ? 3 : 2}
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleStrokeSelect(e, stroke.id)}
            />
          );
        })}

        {/* Anchor points */}
        {strokes.map((stroke, strokeIndex) => {
          const isActive = stroke.id === selectedStrokeId;
          const baseColor = strokePalette[strokeIndex % strokePalette.length];
          return stroke.anchors.map((anchor, anchorIndex) => (
            <g key={anchor.id}>
              <circle
                cx={anchor.x * SCALE}
                cy={anchor.y * SCALE}
                r={isActive ? 7.5 : 6.5}
                fill={isActive ? '#111827' : baseColor}
                stroke={selectedAnchorId === anchor.id ? '#f59e0b' : 'white'}
                strokeWidth={selectedAnchorId === anchor.id ? '3' : '2'}
                style={{ cursor: 'grab' }}
                onClick={(e) => handleAnchorClick(e, anchor.id, stroke.id)}
              />
              <text
                x={anchor.x * SCALE}
                y={anchor.y * SCALE - 15}
                textAnchor="middle"
                fontSize="10"
                fill="#666"
              >
                {anchorIndex + 1}
              </text>
            </g>
          ));
        })}
      </svg>
      </div>

      <div className="editor-legend">
        <span className="legend-item active"><span className="legend-dot" />Active stroke</span>
        <span className="legend-item normal"><span className="legend-dot" />Inactive strokes</span>
      </div>

      <div className="editor-instructions">
        <p>Anchor Tool: left click empty space adds anchor, right click starts a new stroke segment.</p>
        <p>Pencil Tool: click and drag to draw. Use Generate Anchors to simplify drawing into anchors with RDP.</p>
        <p>Selected anchor moves only while middle mouse is held. Release to lock. Grid: 100×100</p>
      </div>
    </div>
  );
}