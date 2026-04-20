import type { ExtractedLetterCell } from '../../utils/cellExtraction';
import type { LetterImportOverride } from '../../utils/fontAssembly';
import './FontImport.css';

interface ReviewScreenProps {
  letters: ExtractedLetterCell[];
  overrides: Record<string, LetterImportOverride>;
  onToggleInclude: (letter: string) => void;
  onToggleReverse: (letter: string) => void;
  onAnchorCountChange: (letter: string, anchorCount: number) => void;
}

export function ReviewScreen({
  letters,
  overrides,
  onToggleInclude,
  onToggleReverse,
  onAnchorCountChange,
}: ReviewScreenProps) {
  return (
    <div className="review-screen">
      <div className="review-grid">
        {letters.map((cell) => {
          const override = overrides[cell.letter.toLowerCase()] ?? {
            included: true,
            reverseDirection: false,
            anchorCount: 16,
          };
          const flagged = cell.confidence < 25;
          return (
            <div key={cell.letter} className={`review-letter ${flagged ? 'flagged' : ''} ${!override.included ? 'excluded' : ''}`}>
              <div className="review-letter-image-pair">
                <div className="review-letter-image-wrap">
                  <img src={cell.imageDataUrl} alt={`Extracted ${cell.letter}`} className="review-letter-image" />
                </div>
                <div className="review-letter-image-wrap">
                  <img src={cell.skeletonDataUrl} alt={`Skeleton ${cell.letter}`} className="review-letter-image" />
                </div>
              </div>
              <div className="review-letter-label">{cell.letter.toUpperCase()}</div>
              <div className="review-letter-confidence">Confidence: {cell.confidence}%</div>
              <div className="review-letter-confidence">Branches: {cell.branchPoints}</div>
              <div className="review-letter-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={override.included}
                    onChange={() => onToggleInclude(cell.letter)}
                  />
                  Include
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={override.reverseDirection}
                    onChange={() => onToggleReverse(cell.letter)}
                  />
                  Reverse
                </label>
                <label>
                  Anchors
                  <input
                    type="range"
                    min={4}
                    max={40}
                    step={1}
                    value={override.anchorCount}
                    onChange={(event) => onAnchorCountChange(cell.letter, Number(event.target.value))}
                  />
                  <span>{override.anchorCount}</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReviewScreen;
