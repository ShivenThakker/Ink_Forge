import { useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { LetterEditor } from './components/LetterEditor';
import { PreviewCanvas } from './components/PreviewCanvas';
import { TopBar } from './components/TopBar';
import type { HandwritingStyle, LetterDefinition } from './engine/types';
import { DEFAULT_PARAMS } from './engine/types';
import { renderSingleLetter, renderTextToSvg } from './engine/renderer';
import { layoutText } from './engine/layout';
import { generateConnectors } from './engine/connector';
import { STYLE_NAMES, STYLE_PRESETS } from './styles';
import './App.css';

function App() {
  const [char, setChar] = useState('a');
  const [text, setText] = useState('hello');
  const [selectedStyle, setSelectedStyle] = useState('normal');
  const [params, setParams] = useState({ ...DEFAULT_PARAMS, ...STYLE_PRESETS.normal.defaults });
  const [customLetters, setCustomLetters] = useState<Record<string, LetterDefinition>>({});
  const [variationTick, setVariationTick] = useState(0);

  const handleExport = (definition: LetterDefinition) => {
    const normalizedChar = definition.char.toLowerCase();
    setCustomLetters((prev) => ({
      ...prev,
      [normalizedChar]: {
        ...definition,
        char: normalizedChar,
      },
    }));
    console.log('Exported:', definition);
  };

  const handleParamChange = <K extends keyof typeof params>(key: K, value: (typeof params)[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const baseStyle = STYLE_PRESETS[selectedStyle] ?? STYLE_PRESETS.normal;

  const activeStyle: HandwritingStyle = {
    ...baseStyle,
    defaults: params,
    letters: {
      ...baseStyle.letters,
      ...customLetters,
    },
  };

  const layoutResult = layoutText(text, activeStyle, params, `layout-${variationTick}-${text}`);
  const loopScale = Math.max(0.4, Math.min(1.8, params.loopSize));
  const loopAdjustedLetters = layoutResult.letters.map((letter) => ({
    ...letter,
    anchors: letter.anchors.map((anchor) => ({
      ...anchor,
      y: letter.baselineY + (anchor.y - letter.baselineY) * loopScale,
    })),
  }));
  const connectorPaths = generateConnectors(loopAdjustedLetters, params.connectionSmoothness);
  const fullPipeline = renderTextToSvg(text, activeStyle, params, `pipeline-${variationTick}-${text}`);

  const handleApplyPreset = (styleName: string) => {
    const preset = STYLE_PRESETS[styleName];
    if (!preset) return;
    setSelectedStyle(styleName);
    setParams({ ...DEFAULT_PARAMS, ...preset.defaults });
  };

  const handleExportSvg = () => {
    const blob = new Blob([fullPipeline.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkforge_${selectedStyle}_${text || 'sample'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const editorChar = char.toLowerCase();
  const editorSourceAnchors = activeStyle.letters[editorChar]?.anchors ?? [];
  const editorSourceVersion = JSON.stringify(editorSourceAnchors);
  const latestExport = customLetters[editorChar];

  const renderResult = latestExport
    ? renderSingleLetter(latestExport, {
        roundness: params.roundness,
        slant: params.slant,
        strokeColor: params.strokeColor,
        strokeWidth: params.strokeWidth,
        seed: `${latestExport.char}-${variationTick}`,
        anchorJitter: params.anchorJitter,
        baselineJitter: params.baselineJitter,
        angleJitter: params.angleJitter,
      })
    : null;

  return (
    <div className="app">
      <TopBar
        char={char}
        text={text}
        selectedStyle={selectedStyle}
        styles={STYLE_NAMES}
        onCharChange={setChar}
        onTextChange={setText}
        onStyleChange={handleApplyPreset}
        onApplyPreset={handleApplyPreset}
        onExportSvg={handleExportSvg}
      />

      <section className="live-workspace">
        <div className="workspace-output">
          <PreviewCanvas
            layoutResult={layoutResult}
            connectorPaths={connectorPaths}
            params={params}
            fullPipelineSvg={fullPipeline.svg}
            fullPipelineWidth={fullPipeline.width}
            fullPipelineHeight={fullPipeline.height}
            onReflow={() => setVariationTick((v) => v + 1)}
          />
        </div>
        <ControlPanel params={params} onParamChange={handleParamChange} />
      </section>

      <main className="app-main">
        <LetterEditor
          key={`${editorChar}:${editorSourceVersion}`}
          char={char}
          sourceLetter={activeStyle.letters[editorChar]}
          onExport={handleExport}
        />
      </main>

      {Object.keys(customLetters).length > 0 && (
        <aside className="exported-preview">
          <h3>Custom Letters ({Object.keys(customLetters).length})</h3>
          {renderResult && (
            <div className="renderer-preview">
              <div className="renderer-preview-header">
                <h4>Renderer Preview (Phase 4 Variation)</h4>
                <button onClick={() => setVariationTick((v) => v + 1)}>
                  Re-render Variation
                </button>
              </div>
              <svg viewBox={renderResult.viewBox} width="260" height="180" role="img" aria-label="Rendered letter preview">
                <path
                  d={renderResult.path}
                  fill="none"
                  stroke={params.strokeColor}
                  strokeWidth={params.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform={renderResult.transform}
                />
              </svg>
            </div>
          )}
          <pre>{JSON.stringify(customLetters, null, 2)}</pre>
        </aside>
      )}
    </div>
  );
}

export default App;