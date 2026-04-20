import type { ExtractedLetterCell } from '../../utils/cellExtraction';
import './FontImport.css';

interface ReviewScreenProps {
  letters: ExtractedLetterCell[];
}

export function ReviewScreen({ letters }: ReviewScreenProps) {
  return (
    <div className="review-screen">
      <div className="review-grid">
        {letters.map((cell) => {
          const flagged = cell.confidence < 25;
          return (
            <div key={cell.letter} className={`review-letter ${flagged ? 'flagged' : ''}`}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReviewScreen;
