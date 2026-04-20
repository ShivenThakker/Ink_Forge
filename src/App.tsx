import { useMemo, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { LetterEditor } from './components/LetterEditor';
import { PreviewCanvas } from './components/PreviewCanvas';
import { TopBar } from './components/TopBar';
import { FontImportModal } from './components/FontImport';
import type { HandwritingStyle, LetterDefinition } from './engine/types';
import { DEFAULT_PARAMS } from './engine/types';
import { renderTextToSvg } from './engine/renderer';
import { STYLE_NAMES, STYLE_PRESETS } from './styles';
import './App.css';

interface ImportedFontPayload {
  key: string;
  style: HandwritingStyle;
  source: string;
}

function App() {
  const [char, setChar] = useState('a');
  const [text, setText] = useState('hello');
  const [selectedStyle, setSelectedStyle] = useState('normal');
  const [params, setParams] = useState({ ...DEFAULT_PARAMS, ...STYLE_PRESETS.normal.defaults });
  const [customLetters, setCustomLetters] = useState<Record<string, LetterDefinition>>({});
  const [importedStyles, setImportedStyles] = useState<Record<string, HandwritingStyle>>({});
  const [pipelineVariationTick, setPipelineVariationTick] = useState(0);
  const [lockedVariationTick, setLockedVariationTick] = useState(0);
  const [isFontImportOpen, setIsFontImportOpen] = useState(false);

  const allStyles = useMemo(
    () => ({ ...STYLE_PRESETS, ...importedStyles }),
    [importedStyles],
  );
  const styleNames = useMemo(
    () => Object.keys(allStyles),
    [allStyles],
  );

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
    setPipelineVariationTick((v) => v + 1);
  };

  const baseStyle = allStyles[selectedStyle] ?? STYLE_PRESETS.normal;

  const activeStyle: HandwritingStyle = {
    ...baseStyle,
    defaults: params,
    letters: {
      ...baseStyle.letters,
      ...customLetters,
    },
  };

  const pipelineSeed = `pipeline-variation-${pipelineVariationTick}`;
  const lockedSeed = `locked-variation-${lockedVariationTick}`;

  const fullPipeline = renderTextToSvg(text, activeStyle, params, `${pipelineSeed}:${text}`);

  const handleApplyPreset = (styleName: string) => {
    const preset = allStyles[styleName];
    if (!preset) return;
    setSelectedStyle(styleName);
    setParams({ ...DEFAULT_PARAMS, ...preset.defaults });
    setPipelineVariationTick((v) => v + 1);
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

  const handleFontImportComplete = (fontData: ImportedFontPayload) => {
    setImportedStyles((prev) => ({
      ...prev,
      [fontData.key]: fontData.style,
    }));
    setSelectedStyle(fontData.key);
    setParams({ ...DEFAULT_PARAMS, ...fontData.style.defaults });
    setPipelineVariationTick((v) => v + 1);
    setIsFontImportOpen(false);
  };

  const editorChar = char.toLowerCase();
  const editorSourceStrokes = activeStyle.letters[editorChar]?.strokes ?? [];
  const editorSourceVersion = JSON.stringify(editorSourceStrokes);
  const latestExport = customLetters[editorChar];

  const customPreview = latestExport
    ? renderTextToSvg(latestExport.char, activeStyle, params, `${lockedSeed}:${latestExport.char}`)
    : null;

  return (
    <div className="app">
      <TopBar
        char={char}
        text={text}
        selectedStyle={selectedStyle}
        styles={styleNames.length > 0 ? styleNames : STYLE_NAMES}
        onCharChange={setChar}
        onTextChange={setText}
        onStyleChange={handleApplyPreset}
        onApplyPreset={handleApplyPreset}
        onExportSvg={handleExportSvg}
        onOpenFontImport={() => setIsFontImportOpen(true)}
      />

      <section className="live-workspace">
        <div className="workspace-output">
          <PreviewCanvas
            renderKey={pipelineVariationTick}
            fullPipelineSvg={fullPipeline.svg}
            fullPipelineWidth={fullPipeline.width}
            fullPipelineHeight={fullPipeline.height}
            onReflow={() => setPipelineVariationTick((v) => v + 1)}
          />
        </div>
        <ControlPanel params={params} onParamChange={handleParamChange} />
      </section>

      <main className="app-main">
        <LetterEditor
          key={`${editorChar}:${editorSourceVersion}`}
          char={char}
          sourceLetter={activeStyle.letters[editorChar]}
          anchorCount={params.anchorCount}
          onExport={handleExport}
        />
      </main>

      {Object.keys(customLetters).length > 0 && (
        <aside className="exported-preview">
          <h3>Custom Letters ({Object.keys(customLetters).length})</h3>
          {customPreview && (
            <div className="renderer-preview">
              <div className="renderer-preview-header">
                <h4>Renderer Preview (Phase 4 Variation)</h4>
                <button onClick={() => setLockedVariationTick((v) => v + 1)}>
                  Re-render Variation
                </button>
              </div>
              <div
                className="pipeline-preview-svg"
                style={{ aspectRatio: `${Math.max(customPreview.width, 1)} / ${Math.max(customPreview.height, 1)}` }}
                role="img"
                aria-label="Rendered letter preview"
                dangerouslySetInnerHTML={{ __html: customPreview.svg }}
              />
            </div>
          )}
          <pre>{JSON.stringify(customLetters, null, 2)}</pre>
        </aside>
      )}

      <FontImportModal
        isOpen={isFontImportOpen}
        onClose={() => setIsFontImportOpen(false)}
        onImportComplete={handleFontImportComplete}
      />
    </div>
  );
}

export default App;