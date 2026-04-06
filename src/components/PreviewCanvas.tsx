interface PreviewCanvasProps {
  renderKey: number;
  fullPipelineSvg: string;
  fullPipelineWidth: number;
  fullPipelineHeight: number;
  onReflow: () => void;
}

export function PreviewCanvas({
  renderKey,
  fullPipelineSvg,
  fullPipelineWidth,
  fullPipelineHeight,
  onReflow,
}: PreviewCanvasProps) {
  return (
    <section className="layout-preview">
      <div className="layout-preview-header">
        <h3>Preview Canvas</h3>
        <button onClick={onReflow}>Reflow Layout</button>
      </div>
      <div
        key={`preview-${renderKey}`}
        className="pipeline-preview-svg"
        style={{ aspectRatio: `${Math.max(fullPipelineWidth, 1)} / ${Math.max(fullPipelineHeight, 1)}` }}
        dangerouslySetInnerHTML={{ __html: fullPipelineSvg }}
      />
    </section>
  );
}
