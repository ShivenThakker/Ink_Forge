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
import { demoStyle } from './styles/demoStyle';
import './App.css';

function App() {
  const [char, setChar] = useState('a');
  const [text, setText] = useState('hello');
  const [params, setParams] = useState({ ...DEFAULT_PARAMS, ...demoStyle.defaults });
  const [exportedLetters, setExportedLetters] = useState<LetterDefinition[]>([]);
  const [variationTick, setVariationTick] = useState(0);

  const handleExport = (definition: LetterDefinition) => {
    setExportedLetters(prev => [...prev, definition]);
    console.log('Exported:', definition);
  };

  const handleParamChange = <K extends keyof typeof params>(key: K, value: (typeof params)[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const latestExport = exportedLetters[exportedLetters.length - 1];

  const customLetters = exportedLetters.reduce<Record<string, LetterDefinition>>((acc, letter) => {
    if (letter.char) {
      acc[letter.char.toLowerCase()] = letter;
    }
    return acc;
  }, {});

  const activeStyle: HandwritingStyle = {
    ...demoStyle,
    defaults: params,
    letters: {
      ...demoStyle.letters,
      ...customLetters,
    },
  };

  const layoutResult = layoutText(text, activeStyle, params, `layout-${variationTick}-${text}`);
  const connectorPaths = generateConnectors(layoutResult.letters, params.connectionSmoothness);
  const fullPipeline = renderTextToSvg(text, activeStyle, params, `pipeline-${variationTick}-${text}`);

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
      <TopBar char={char} text={text} onCharChange={setChar} onTextChange={setText} />

      <ControlPanel params={params} onParamChange={handleParamChange} />

      <main className="app-main">
        <LetterEditor char={char} onExport={handleExport} />
      </main>

      {exportedLetters.length > 0 && (
        <aside className="exported-preview">
          <h3>Exported Letters ({exportedLetters.length})</h3>
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
          <pre>{JSON.stringify(exportedLetters, null, 2)}</pre>
        </aside>
      )}

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
  );
}

export default App;