import React, { useState, useCallback } from 'react';
import { TemplateDownload } from './TemplateDownload';
import { GridDetectionView } from './GridDetectionView';
import { ReviewScreen } from './ReviewScreen';
import { UploadZone } from './UploadZone';
import { detectGridFromDataUrl, type OrderedCorners } from '../../utils/gridDetection';
import { extractLetterCellsFromDataUrl, type ExtractedLetterCell } from '../../utils/cellExtraction';
import { buildFontStyleFromExtractedCells } from '../../utils/fontAssembly';
import './FontImport.css';

type ImportStep = 'template' | 'upload' | 'detect' | 'extract' | 'review' | 'complete';

interface FontImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (fontData: {
    key: string;
    style: import('../../engine/types').HandwritingStyle;
    source: string;
  }) => void;
}

export const FontImportModal: React.FC<FontImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<ImportStep>('template');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detectedCorners, setDetectedCorners] = useState<OrderedCorners | null>(null);
  const [detectedImageWidth, setDetectedImageWidth] = useState(0);
  const [detectedImageHeight, setDetectedImageHeight] = useState(0);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [detectionStrategy, setDetectionStrategy] = useState('default');
  const [workingImage, setWorkingImage] = useState<string | null>(null);
  const [extractedLetters, setExtractedLetters] = useState<ExtractedLetterCell[]>([]);
  const [fontName, setFontName] = useState('My Handwriting');

  const handleImageUpload = useCallback((_file: File, dataUrl: string) => {
    setUploadedImage(dataUrl);
    setDetectedCorners(null);
    setDetectedImageWidth(0);
    setDetectedImageHeight(0);
    setDetectionConfidence(0);
    setDetectionStrategy('default');
    setWorkingImage(null);
    setExtractedLetters([]);
    setError(null);
    setStep('detect');
  }, []);

  const handleDetectGrid = useCallback(async () => {
    if (!uploadedImage) return;

    setIsProcessing(true);
    setError(null);
    setProgress(15);

    try {
      setProgress(40);
      const result = await detectGridFromDataUrl(uploadedImage);
      setProgress(75);

      setDetectedCorners(result.corners);
      setDetectedImageWidth(result.imageWidth);
      setDetectedImageHeight(result.imageHeight);
      setDetectionConfidence(result.confidence);
      setDetectionStrategy(result.strategy);
      setWorkingImage(result.workingImageDataUrl);

      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect grid. Please ensure fiducial markers are visible.');
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedImage]);

  const handleExtractLetters = useCallback(async () => {
    if (!detectedCorners) return;

    const imageForExtraction = workingImage ?? uploadedImage;
    if (!imageForExtraction) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      setProgress(20);
      const extracted = await extractLetterCellsFromDataUrl(imageForExtraction, detectedCorners);
      setProgress(85);
      setExtractedLetters(extracted);
      setProgress(100);

      // Move to review step
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract letters. Please check image quality.');
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedImage, detectedCorners, workingImage]);

  const handleCornersChange = useCallback((corners: OrderedCorners) => {
    setDetectedCorners(corners);
  }, []);

  const handleAcceptAll = useCallback(() => {
    const run = async () => {
      setIsProcessing(true);
      setError(null);
      setProgress(10);
      try {
        const built = await buildFontStyleFromExtractedCells(extractedLetters, {
          name: fontName.trim() || 'My Handwriting',
          key: fontName.trim() || 'my-handwriting',
          source: 'scan',
          anchorCount: 16,
        });

        setProgress(100);
        onImportComplete(built);
        setStep('complete');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to build font style.');
      } finally {
        setIsProcessing(false);
      }
    };

    void run();
  }, [onImportComplete, extractedLetters, fontName]);

  const handleBack = useCallback(() => {
    switch (step) {
      case 'upload':
        setStep('template');
        break;
      case 'detect':
        setStep('upload');
        break;
      case 'extract':
        setStep('detect');
        break;
      case 'review':
        setStep('extract');
        break;
      default:
        break;
    }
  }, [step]);

  const handleReset = useCallback(() => {
    setStep('template');
    setUploadedImage(null);
    setIsProcessing(false);
    setProgress(0);
    setError(null);
    setDetectedCorners(null);
    setDetectedImageWidth(0);
    setDetectedImageHeight(0);
    setDetectionConfidence(0);
    setDetectionStrategy('default');
    setWorkingImage(null);
    setExtractedLetters([]);
    setFontName('My Handwriting');
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (step) {
      case 'template':
        return (
          <div className="template-step">
            <TemplateDownload />
            <div className="step-actions">
              <button
                className="btn btn-primary"
                onClick={() => setStep('upload')}
              >
                I've Printed the Template →
              </button>
            </div>
          </div>
        );

      case 'upload':
        return (
          <div className="upload-step">
            <p>
              Take a clear photo of your completed template. Make sure all four
              corner markers are visible and the lighting is even.
            </p>
            <UploadZone
              onImageUpload={handleImageUpload}
              disabled={isProcessing}
            />
            {uploadedImage && (
              <div className="image-preview">
                <img src={uploadedImage} alt="Uploaded template" />
              </div>
            )}
          </div>
        );

      case 'detect':
        return (
          <div className="detect-step">
            <p>Image uploaded! Now detecting the grid pattern...</p>
            {(workingImage ?? uploadedImage) && detectedCorners && detectedImageWidth > 0 && detectedImageHeight > 0 && (
              <GridDetectionView
                imageSrc={workingImage ?? uploadedImage ?? ''}
                corners={detectedCorners}
                imageWidth={detectedImageWidth}
                imageHeight={detectedImageHeight}
                confidence={detectionConfidence}
                strategy={detectionStrategy}
                onCornersChange={handleCornersChange}
              />
            )}
            {isProcessing && (
              <div className="import-progress">
                <div className="import-progress-bar">
                  <div
                    className="import-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="import-progress-text">
                  Detecting fiducial markers... {progress}%
                </div>
              </div>
            )}
            {error && <div className="import-error">{error}</div>}
            {!isProcessing && (
              <div className="import-actions">
                <button className="btn btn-secondary" onClick={handleBack}>
                  ← Back
                </button>
                <button className="btn btn-primary" onClick={handleDetectGrid}>
                  {detectedCorners ? 'Detect Again' : 'Detect Grid'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep('extract')}
                  disabled={!detectedCorners}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        );

      case 'extract':
        return (
          <div className="extract-step">
            <p>Grid detected! Now extracting letters...</p>
            {isProcessing && (
              <div className="import-progress">
                <div className="import-progress-bar">
                  <div
                    className="import-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="import-progress-text">
                  Processing letters... {progress}%
                </div>
              </div>
            )}
            {error && <div className="import-error">{error}</div>}
            {!isProcessing && (
              <div className="import-actions">
                <button className="btn btn-secondary" onClick={handleBack}>
                  ← Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleExtractLetters}
                  disabled={!detectedCorners}
                >
                  Extract Letters
                </button>
              </div>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="review-step">
            <p>
              Letters extracted! Review them below. Letters with low confidence
              are highlighted in red.
            </p>
            <div className="font-name-input-row">
              <label htmlFor="font-name-input">Font name</label>
              <input
                id="font-name-input"
                value={fontName}
                onChange={(event) => setFontName(event.target.value)}
                placeholder="My Handwriting"
              />
            </div>
            <ReviewScreen letters={extractedLetters} />
            <div className="import-actions">
              <button className="btn btn-secondary" onClick={handleBack}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={handleAcceptAll}>
                Accept All & Import
              </button>
            </div>
            {isProcessing && (
              <div className="import-progress">
                <div className="import-progress-bar">
                  <div
                    className="import-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="import-progress-text">
                  Building font style... {progress}%
                </div>
              </div>
            )}
          </div>
        );

      case 'complete':
        return (
          <div className="complete-step">
            <p>Font imported successfully!</p>
            <div className="import-actions">
              <button className="btn btn-primary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const stepTitles: Record<ImportStep, string> = {
    template: 'Step 1: Download Template',
    upload: 'Step 2: Upload Photo',
    detect: 'Step 3: Detect Grid',
    extract: 'Step 4: Extract Letters',
    review: 'Step 5: Review & Import',
    complete: 'Complete!',
  };

  return (
    <div className="font-import-modal" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="font-import-modal-content">
        <div className="font-import-modal-header">
          <h2>{stepTitles[step]}</h2>
          <button className="font-import-modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        {error && (
          <div className="import-error" style={{ color: 'red', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {renderStepContent()}
      </div>
    </div>
  );
};

export default FontImportModal;