import { useState, useCallback, useRef } from 'react';
import type { Anchor, LetterDefinition, Point } from '../engine/types';
import { catmullRomToPath, roundnessToTension } from '../engine/spline';
import './LetterEditor.css';

const GRID_SIZE = 100;
const SVG_SIZE = 500;
const SCALE = SVG_SIZE / GRID_SIZE;

interface LetterEditorProps {
  char?: string;
  onExport?: (definition: LetterDefinition) => void;
}

export function LetterEditor({ char = 'a', onExport }: LetterEditorProps) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const generateId = () => `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const screenToGrid = useCallback((clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / SCALE;
    const y = (clientY - rect.top) / SCALE;
    return {
      x: Math.max(0, Math.min(GRID_SIZE, Math.round(x * 10) / 10)),
      y: Math.max(0, Math.min(GRID_SIZE, Math.round(y * 10) / 10)),
    };
  }, []);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (draggedId) return; // Don't add while dragging
    if (e.target !== svgRef.current && !(e.target as Element).classList.contains('grid-line')) return;

    const pos = screenToGrid(e.clientX, e.clientY);

    // First anchor is entry, last is exit, others are normal
    const type: Anchor['type'] = anchors.length === 0 ? 'entry' : 'normal';

    setAnchors(prev => {
      const newAnchors = [...prev, { id: generateId(), ...pos, type }];
      // Mark last as exit
      if (newAnchors.length > 1) {
        newAnchors[newAnchors.length - 1].type = 'exit';
        if (newAnchors.length > 2) {
          newAnchors[newAnchors.length - 2].type = 'normal';
        }
      }
      return newAnchors;
    });
  }, [anchors, draggedId, screenToGrid]);

  const handleMouseDown = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedId) return;
    const pos = screenToGrid(e.clientX, e.clientY);
    setAnchors(prev => prev.map(a => (a.id === draggedId ? { ...a, ...pos } : a)));
  }, [draggedId, screenToGrid]);

  const handleMouseUp = useCallback(() => {
    setDraggedId(null);
  }, []);

  const handleAnchorClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setAnchors(prev => prev.map(a => {
      if (a.id !== id) return a;
      // Cycle: normal -> entry -> exit -> normal
      const nextType: Anchor['type'] = a.type === 'normal' ? 'entry' : a.type === 'entry' ? 'exit' : 'normal';
      return { ...a, type: nextType };
    }));
  }, []);

  const clearAnchors = () => setAnchors([]);

  const handleExport = () => {
    const definition: LetterDefinition = { char, anchors };
    if (onExport) {
      onExport(definition);
    } else {
      const json = JSON.stringify(definition, null, 2);
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
          <button onClick={clearAnchors} disabled={anchors.length === 0}>
            Clear
          </button>
          <button onClick={handleExport} disabled={anchors.length < 2}>
            Export JSON
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="editor-canvas"
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid */}
        <defs>
          <pattern id="grid" width={SCALE * 10} height={SCALE * 10} patternUnits="userSpaceOnUse">
            <path d={`M ${SCALE * 10} 0 L 0 0 0 ${SCALE * 10}`} fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={SVG_SIZE} height={SVG_SIZE} fill="url(#grid)" className="grid-background" />

        {/* Baseline indicator */}
        <line
          x1="0" y1={SCALE * 70}
          x2={SVG_SIZE} y2={SCALE * 70}
          stroke="#ccc"
          strokeDasharray="5,5"
          className="grid-line"
        />

        {/* Curve preview */}
        {anchors.length >= 2 && (
          <path
            d={catmullRomToPath(anchors.map((a) => ({ x: a.x * SCALE, y: a.y * SCALE })), roundnessToTension(0.5))}
            fill="none"
            stroke="#333"
            strokeWidth="2"
          />
        )}

        {/* Anchor points */}
        {anchors.map((anchor, i) => (
          <g key={anchor.id}>
            <circle
              cx={anchor.x * SCALE}
              cy={anchor.y * SCALE}
              r={8}
              fill={anchor.type === 'entry' ? '#22c55e' : anchor.type === 'exit' ? '#ef4444' : '#3b82f6'}
              stroke="white"
              strokeWidth="2"
              style={{ cursor: 'grab' }}
              onMouseDown={() => handleMouseDown(anchor.id)}
              onClick={(e) => handleAnchorClick(e, anchor.id)}
            />
            <text
              x={anchor.x * SCALE}
              y={anchor.y * SCALE - 15}
              textAnchor="middle"
              fontSize="10"
              fill="#666"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>

      <div className="editor-legend">
        <span className="legend-item entry">● Entry</span>
        <span className="legend-item exit">● Exit</span>
        <span className="legend-item normal">● Normal</span>
      </div>

      <div className="editor-instructions">
        <p>Click to add anchors. Drag to move. Click anchor to toggle type.</p>
        <p>First anchor = entry (green), last = exit (red). Grid: 100×100</p>
      </div>
    </div>
  );
}