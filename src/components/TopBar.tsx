interface TopBarProps {
  char: string;
  text: string;
  onCharChange: (value: string) => void;
  onTextChange: (value: string) => void;
}

export function TopBar({ char, text, onCharChange, onTextChange }: TopBarProps) {
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
    </header>
  );
}
