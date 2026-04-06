import type { StyleParameters } from '../engine/types';

interface ControlPanelProps {
  params: StyleParameters;
  onParamChange: <K extends keyof StyleParameters>(key: K, value: StyleParameters[K]) => void;
}

interface SliderSpec {
  key: keyof StyleParameters;
  label: string;
  min: number;
  max: number;
  step: number;
}

function SliderRow({
  params,
  onParamChange,
  spec,
}: {
  params: StyleParameters;
  onParamChange: <K extends keyof StyleParameters>(key: K, value: StyleParameters[K]) => void;
  spec: SliderSpec;
}) {
  const value = params[spec.key] as number;
  return (
    <label className="control-row">
      <span>{spec.label}</span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(e) => onParamChange(spec.key, Number(e.target.value) as StyleParameters[typeof spec.key])}
      />
      <strong>{value}</strong>
    </label>
  );
}

export function ControlPanel({ params, onParamChange }: ControlPanelProps) {
  const layoutSliders: SliderSpec[] = [
    { key: 'anchorCount', label: 'Anchor Count', min: 2, max: 50, step: 1 },
    { key: 'spacing', label: 'Spacing', min: 2, max: 40, step: 1 },
    { key: 'slant', label: 'Slant', min: -20, max: 20, step: 1 },
    { key: 'baselineJitter', label: 'Baseline Jitter', min: 0, max: 8, step: 0.1 },
    { key: 'spacingJitter', label: 'Spacing Jitter', min: 0, max: 12, step: 0.1 },
  ];

  const shapeSliders: SliderSpec[] = [
    { key: 'roundness', label: 'Roundness', min: 0, max: 1, step: 0.01 },
    { key: 'loopSize', label: 'Loop Size', min: 0.5, max: 1.6, step: 0.01 },
    { key: 'strokeCurvature', label: 'Stroke Curvature', min: 0.2, max: 1.4, step: 0.01 },
    { key: 'connectionSmoothness', label: 'Connection Smoothness', min: 0, max: 1, step: 0.01 },
  ];

  const randomSliders: SliderSpec[] = [
    { key: 'anchorJitter', label: 'Anchor Jitter', min: 0, max: 4, step: 0.1 },
    { key: 'angleJitter', label: 'Angle Jitter', min: 0, max: 8, step: 0.1 },
  ];

  const strokeSliders: SliderSpec[] = [
    { key: 'strokeWidth', label: 'Stroke Width', min: 1, max: 8, step: 0.1 },
    { key: 'strokeBreakChance', label: 'Break Chance', min: 0, max: 1, step: 0.01 },
    { key: 'strokeBreakLength', label: 'Break Length', min: 0, max: 20, step: 0.1 },
  ];

  return (
    <aside className="control-panel">
      <h3>Control Panel</h3>

      <section>
        <h4>Layout</h4>
        {layoutSliders.map((spec) => (
          <SliderRow key={spec.key} params={params} onParamChange={onParamChange} spec={spec} />
        ))}
      </section>

      <section>
        <h4>Shape</h4>
        {shapeSliders.map((spec) => (
          <SliderRow key={spec.key} params={params} onParamChange={onParamChange} spec={spec} />
        ))}
      </section>

      <section>
        <h4>Randomness</h4>
        {randomSliders.map((spec) => (
          <SliderRow key={spec.key} params={params} onParamChange={onParamChange} spec={spec} />
        ))}
      </section>

      <section>
        <h4>Stroke</h4>
        <label className="control-row control-color-row">
          <span>Stroke Color</span>
          <input
            type="color"
            value={params.strokeColor}
            onChange={(e) => onParamChange('strokeColor', e.target.value)}
          />
          <strong>{params.strokeColor}</strong>
        </label>
        {strokeSliders.map((spec) => (
          <SliderRow key={spec.key} params={params} onParamChange={onParamChange} spec={spec} />
        ))}
      </section>
    </aside>
  );
}
