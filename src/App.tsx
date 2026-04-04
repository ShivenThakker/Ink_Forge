import { useState } from 'react';
import { LetterEditor } from './components/LetterEditor';
import type { LetterDefinition } from './engine/types';
import './App.css';

function App() {
  const [char, setChar] = useState('a');
  const [exportedLetters, setExportedLetters] = useState<LetterDefinition[]>([]);

  const handleExport = (definition: LetterDefinition) => {
    setExportedLetters(prev => [...prev, definition]);
    console.log('Exported:', definition);
  };

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
          <pre>{JSON.stringify(exportedLetters, null, 2)}</pre>
        </aside>
      )}
    </div>
  );
}

export default App;