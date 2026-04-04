import { useState } from 'react';
import { LetterEditor } from './components/LetterEditor';
import type { LetterDefinition } from './engine/types';
import { renderSingleLetter } from './engine/renderer';
import './App.css';

function App() {
  const [char, setChar] = useState('a');
  const [exportedLetters, setExportedLetters] = useState<LetterDefinition[]>([]);

  const handleExport = (definition: LetterDefinition) => {
    setExportedLetters(prev => [...prev, definition]);
    console.log('Exported:', definition);
  };

  const latestExport = exportedLetters[exportedLetters.length - 1];
  const renderResult = latestExport
    ? renderSingleLetter(latestExport, {
        roundness: 0.5,
        slant: 8,
        strokeColor: '#111111',
        strokeWidth: 2,
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
      </header>

      <main className="app-main">
        <LetterEditor char={char} onExport={handleExport} />
      </main>

      {exportedLetters.length > 0 && (
        <aside className="exported-preview">
          <h3>Exported Letters ({exportedLetters.length})</h3>
          {renderResult && (
            <div className="renderer-preview">
              <h4>Renderer Preview (Phase 3)</h4>
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
    </div>
  );
}

export default App;