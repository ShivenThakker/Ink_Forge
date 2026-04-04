interface TopBarProps {
  char: string;
  text: string;
  selectedStyle: string;
  styles: string[];
  onCharChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onStyleChange: (style: string) => void;
  onApplyPreset: (preset: string) => void;
  onExportSvg: () => void;
}

export function TopBar({
  char,
  text,
  selectedStyle,
  styles,
  onCharChange,
  onTextChange,
  onStyleChange,
  onApplyPreset,
  onExportSvg,
}: TopBarProps) {
  return (
    <header className="app-header">
      <h1>InkForge</h1>
      <div className="char-selector">
        <label htmlFor="char-input">Letter:</label>
        <input
          id="char-input"
          type="text"
          maxLength={1}
          value={char}
          onChange={(e) => onCharChange(e.target.value)}
          className="char-input"
        />
      </div>
      <div className="text-selector">
        <label htmlFor="text-input">Text:</label>
        <input
          id="text-input"
          type="text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="text-input"
        />
      </div>
      <div className="style-selector">
        <label htmlFor="style-select">Style:</label>
        <select id="style-select" value={selectedStyle} onChange={(e) => onStyleChange(e.target.value)}>
          {styles.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </div>
      <div className="preset-buttons">
        {styles.map((preset) => (
          <button key={preset} onClick={() => onApplyPreset(preset)}>
            {preset}
          </button>
        ))}
      </div>
      <button className="export-btn" onClick={onExportSvg}>Export SVG</button>
    </header>
  );
}
