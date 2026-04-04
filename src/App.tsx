import { useState } from 'react';
import { LetterEditor } from './components/LetterEditor';
import type { HandwritingStyle, LetterDefinition } from './engine/types';
import { renderSingleLetter } from './engine/renderer';
import { layoutText } from './engine/layout';
import { catmullRomToPath, roundnessToTension } from './engine/spline';
import { demoStyle } from './styles/demoStyle';
import './App.css';

function App() {
  const [char, setChar] = useState('a');
  const [text, setText] = useState('hello');
  const [exportedLetters, setExportedLetters] = useState<LetterDefinition[]>([]);
  const [variationTick, setVariationTick] = useState(0);

  const handleExport = (definition: LetterDefinition) => {
    setExportedLetters(prev => [...prev, definition]);
    console.log('Exported:', definition);
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
    letters: {
      ...demoStyle.letters,
      ...customLetters,
    },
  };

  const layoutResult = layoutText(text, activeStyle, activeStyle.defaults, `layout-${variationTick}-${text}`);

  const renderResult = latestExport
    ? renderSingleLetter(latestExport, {
        roundness: 0.5,
        slant: 8,
        strokeColor: '#111111',
        strokeWidth: 2,
        seed: `${latestExport.char}-${variationTick}`,
        anchorJitter: 1.2,
        baselineJitter: 0.8,
        angleJitter: 1.5,
      })
    : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>InkForge - Letter Editor</h1>
        <div className="char-selector">
          <label>Letter: </label>
          <input
            type="text"
            maxLength={1}
            value={char}
            onChange={(e) => setChar(e.target.value)}
            className="char-input"
          />
        </div>
        <div className="text-selector">
          <label>Text: </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="text-input"
          />
        </div>
      </header>

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
                  stroke="#111111"
                  strokeWidth={2}
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

      <section className="layout-preview">
        <div className="layout-preview-header">
          <h3>Layout Preview (Phase 5)</h3>
          <button onClick={() => setVariationTick((v) => v + 1)}>Reflow Layout</button>
        </div>
        <svg viewBox={`0 0 ${layoutResult.width} ${layoutResult.height}`} width="100%" height="220" role="img" aria-label="Multi-letter layout preview">
          <line x1="0" y1="90" x2={layoutResult.width} y2="90" stroke="#d7d7d7" strokeDasharray="4,4" />
          {layoutResult.letters.map((letter, index) => (
            <path
              key={`${letter.char}-${index}`}
              d={catmullRomToPath(letter.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y })), roundnessToTension(activeStyle.defaults.roundness))}
              fill="none"
              stroke="#111111"
              strokeWidth={activeStyle.defaults.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        {layoutResult.missingChars.length > 0 && (
          <p className="missing-glyphs">
            Missing letter definitions: {layoutResult.missingChars.join(', ')}
          </p>
        )}
      </section>
    </div>
  );
}

export default App;