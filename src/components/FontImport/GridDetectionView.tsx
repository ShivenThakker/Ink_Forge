import React, { useMemo, useState } from 'react';
import type { GridPoint, OrderedCorners } from '../../utils/gridDetection';
import { getGridLines } from '../../utils/gridDetection';
import './FontImport.css';

interface GridDetectionViewProps {
  imageSrc: string;
  corners: OrderedCorners;
  imageWidth: number;
  imageHeight: number;
  confidence: number;
  strategy: string;
  onCornersChange: (corners: OrderedCorners) => void;
}

type CornerKey = keyof OrderedCorners;

const CORNER_KEYS: CornerKey[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function updateCorner(
  corners: OrderedCorners,
  key: CornerKey,
  point: GridPoint,
): OrderedCorners {
  return {
    ...corners,
    [key]: point,
  };
}

export function GridDetectionView({
  imageSrc,
  corners,
  imageWidth,
  imageHeight,
  confidence,
  strategy,
  onCornersChange,
}: GridDetectionViewProps) {
  const [draggingCorner, setDraggingCorner] = useState<CornerKey | null>(null);

  const lines = useMemo(() => getGridLines(corners, 4, 7), [corners]);

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingCorner) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * imageWidth;
    const y = ((event.clientY - bounds.top) / bounds.height) * imageHeight;

    onCornersChange(
      updateCorner(corners, draggingCorner, {
        x: clamp(x, 0, imageWidth),
        y: clamp(y, 0, imageHeight),
      }),
    );
  };

  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="grid-detection-view">
      <div className="detection-meta">
        <span>Detection strategy: {strategy}</span>
        <span>Confidence: {confidencePercent}%</span>
      </div>

      <div className="grid-detection-stage" style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}>
        <img src={imageSrc} alt="Uploaded template" />
        <svg
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          className="grid-overlay-svg"
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDraggingCorner(null)}
          onPointerLeave={() => setDraggingCorner(null)}
        >
          <polygon
            points={`${corners.topLeft.x},${corners.topLeft.y} ${corners.topRight.x},${corners.topRight.y} ${corners.bottomRight.x},${corners.bottomRight.y} ${corners.bottomLeft.x},${corners.bottomLeft.y}`}
            className="detected-quad"
          />

          {lines.map((line, index) => (
            <line
              key={index}
              x1={line[0].x}
              y1={line[0].y}
              x2={line[1].x}
              y2={line[1].y}
              className="detected-grid-line"
            />
          ))}

          {CORNER_KEYS.map((cornerKey) => {
            const point = corners[cornerKey];
            return (
              <g key={cornerKey}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={12}
                  className="detected-corner-hit"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDraggingCorner(cornerKey);
                  }}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={6}
                  className="detected-corner-dot"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <p className="detection-help">
        Drag the four corner handles to align the template if auto-detection is off.
      </p>
    </div>
  );
}

export default GridDetectionView;
