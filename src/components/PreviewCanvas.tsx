import { catmullRomToPath, roundnessToTension } from '../engine/spline';
import type { LayoutResult } from '../engine/layout';
import type { StyleParameters } from '../engine/types';

interface PreviewCanvasProps {
  layoutResult: LayoutResult;
  connectorPaths: string[];
  params: StyleParameters;
  fullPipelineSvg: string;
  fullPipelineWidth: number;
  fullPipelineHeight: number;
  onReflow: () => void;
}

export function PreviewCanvas({
  layoutResult,
  connectorPaths,
  params,
  fullPipelineSvg,
  fullPipelineWidth,
  fullPipelineHeight,
  onReflow,
}: PreviewCanvasProps) {
  const loopScale = Math.max(0.4, Math.min(1.8, params.loopSize));
  const curvatureFactor = Math.max(0.2, Math.min(1.6, params.strokeCurvature));
  const effectiveRoundness = Math.max(0, Math.min(1, params.roundness * curvatureFactor));

  return (
    <>
      <section className="layout-preview">
        <div className="layout-preview-header">
          <h3>Preview Canvas</h3>
          <button onClick={onReflow}>Reflow Layout</button>
        </div>
        <svg viewBox={`0 0 ${layoutResult.width} ${layoutResult.height}`} width="100%" height="220" role="img" aria-label="Multi-letter layout preview">
          <line x1="0" y1="90" x2={layoutResult.width} y2="90" stroke="#d7d7d7" strokeDasharray="4,4" />
          {connectorPaths.map((connectorPath, index) => (
            <path
              key={`connector-${index}`}
              d={connectorPath}
              fill="none"
              stroke={params.strokeColor}
              strokeWidth={params.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {layoutResult.letters.map((letter, index) => (
            <path
              key={`${letter.char}-${index}`}
              d={catmullRomToPath(
                letter.anchors.map((anchor) => ({
                  x: anchor.x,
                  y: letter.baselineY + (anchor.y - letter.baselineY) * loopScale,
                })),
                roundnessToTension(effectiveRoundness),
              )}
              fill="none"
              stroke={params.strokeColor}
              strokeWidth={params.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        {layoutResult.missingChars.length > 0 && (
          <p className="missing-glyphs">Missing letter definitions: {layoutResult.missingChars.join(', ')}</p>
        )}
      </section>

      <section className="pipeline-preview">
        <h3>Full Pipeline SVG</h3>
        <div
          className="pipeline-preview-svg"
          style={{ aspectRatio: `${Math.max(fullPipelineWidth, 1)} / ${Math.max(fullPipelineHeight, 1)}` }}
          dangerouslySetInnerHTML={{ __html: fullPipelineSvg }}
        />
      </section>
    </>
  );
}
