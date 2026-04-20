import React, { useCallback } from 'react';
import './FontImport.css';

// A4 dimensions in mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Convert mm to pixels at 96 DPI (for screen display)
const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX;
const A4_HEIGHT_PX = A4_HEIGHT_MM * MM_TO_PX;

// Grid layout: 4 columns x 7 rows = 28 cells (26 for letters, 2 unused)
const COLS = 4;
const ROWS = 7;

// Margins and spacing (in mm, then converted)
const MARGIN_MM = 15;
const CELL_GAP_MM = 3;
const FIDUCIAL_SIZE_MM = 12;
const FIDUCIAL_MARGIN_MM = 8;

// Cell dimensions (calculated from available space)
const AVAILABLE_WIDTH_MM = A4_WIDTH_MM - 2 * MARGIN_MM;
const AVAILABLE_HEIGHT_MM = A4_HEIGHT_MM - 2 * MARGIN_MM - 2 * FIDUCIAL_MARGIN_MM - FIDUCIAL_SIZE_MM;
const CELL_WIDTH_MM = (AVAILABLE_WIDTH_MM - (COLS - 1) * CELL_GAP_MM) / COLS;
const CELL_HEIGHT_MM = (AVAILABLE_HEIGHT_MM - (ROWS - 1) * CELL_GAP_MM) / ROWS;

// Guide line positions within cell (as fractions of cell height)
const GUIDES = {
  ascender: 0.15,   // Top of ascender letters (t, l, h, etc.)
  xHeight: 0.40,    // Top of lowercase letters (x-height)
  baseline: 0.70,   // Baseline
  descender: 0.90,   // Bottom of descender letters (g, y, p, etc.)
};

// Convert mm to SVG units (using 96 DPI)
const mm = (value: number) => value * MM_TO_PX;

interface FiducialMarkerProps {
  x: number;
  y: number;
  size: number;
  pattern: number; // 0-3 for unique patterns
}

// Fiducial marker with unique nested-square pattern
const FiducialMarker: React.FC<FiducialMarkerProps> = ({ x, y, size, pattern }) => {
  const layers = 3;
  const step = size / (layers * 2 + 1);

  return (
    <g>
      {/* Outer square */}
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        fill="black"
      />
      {/* Inner white square */}
      <rect
        x={x + step}
        y={y + step}
        width={size - 2 * step}
        height={size - 2 * step}
        fill="white"
      />
      {/* Pattern-specific inner design */}
      {pattern === 0 && (
        // Top-left: small centered square
        <rect
          x={x + 2 * step}
          y={y + 2 * step}
          width={step * 2}
          height={step * 2}
          fill="black"
        />
      )}
      {pattern === 1 && (
        // Top-right: horizontal bar
        <rect
          x={x + step}
          y={y + 2 * step}
          width={size - 2 * step}
          height={step}
          fill="black"
        />
      )}
      {pattern === 2 && (
        // Bottom-left: vertical bar
        <rect
          x={x + 2 * step}
          y={y + step}
          width={step}
          height={size - 2 * step}
          fill="black"
        />
      )}
      {pattern === 3 && (
        // Bottom-right: cross
        <>
          <rect
            x={x + step}
            y={y + 2 * step}
            width={size - 2 * step}
            height={step}
            fill="black"
          />
          <rect
            x={x + 2 * step}
            y={y + step}
            width={step}
            height={size - 2 * step}
            fill="black"
          />
        </>
      )}
    </g>
  );
};

interface LetterCellProps {
  x: number;
  y: number;
  width: number;
  height: number;
  letter: string;
}

// Individual letter cell with guide lines and letter label
const LetterCell: React.FC<LetterCellProps> = ({ x, y, width, height, letter }) => {
  const guideY = (name: keyof typeof GUIDES) => y + height * GUIDES[name];

  return (
    <g className="letter-cell">
      {/* Cell border (light gray to not interfere with skeleton detection) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="white"
        stroke="#cccccc"
        strokeWidth={1}
      />

      {/* Letter label (small, top-left) */}
      <text
        x={x + 3}
        y={y + 10}
        fontSize={10}
        fill="#aaaaaa"
        fontFamily="Arial, sans-serif"
      >
        {letter.toUpperCase()}
      </text>

      {/* Guide lines */}
      <line
        x1={x + 2}
        y1={guideY('ascender')}
        x2={x + width - 2}
        y2={guideY('ascender')}
        stroke="#dddddd"
        strokeWidth={0.5}
        strokeDasharray="2,2"
      />
      <line
        x1={x + 2}
        y1={guideY('xHeight')}
        x2={x + width - 2}
        y2={guideY('xHeight')}
        stroke="#cccccc"
        strokeWidth={0.5}
      />
      <line
        x1={x + 2}
        y1={guideY('baseline')}
        x2={x + width - 2}
        y2={guideY('baseline')}
        stroke="#999999"
        strokeWidth={1}
      />
      <line
        x1={x + 2}
        y1={guideY('descender')}
        x2={x + width - 2}
        y2={guideY('descender')}
        stroke="#dddddd"
        strokeWidth={0.5}
        strokeDasharray="2,2"
      />
    </g>
  );
};

// Main template SVG component
export const TemplateSVG: React.FC = () => {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // Calculate positions
  const gridStartX = mm(MARGIN_MM);
  const gridStartY = mm(MARGIN_MM + FIDUCIAL_SIZE_MM + FIDUCIAL_MARGIN_MM);
  const cellWidth = mm(CELL_WIDTH_MM);
  const cellHeight = mm(CELL_HEIGHT_MM);
  const cellGap = mm(CELL_GAP_MM);
  const fiducialSize = mm(FIDUCIAL_SIZE_MM);

  // Generate letter cells
  const cells = letters.map((letter, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      letter,
      x: gridStartX + col * (cellWidth + cellGap),
      y: gridStartY + row * (cellHeight + cellGap),
    };
  });

  return (
    <svg
      width={A4_WIDTH_PX}
      height={A4_HEIGHT_PX}
      viewBox={`0 0 ${A4_WIDTH_PX} ${A4_HEIGHT_PX}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: 'white' }}
    >
      {/* Title */}
      <text
        x={A4_WIDTH_PX / 2}
        y={mm(8)}
        textAnchor="middle"
        fontSize={14}
        fill="#666666"
        fontFamily="Arial, sans-serif"
      >
        InkForge Font Template - Write letters in the boxes below
      </text>

      {/* Fiducial markers (4 corners, unique patterns) */}
      <FiducialMarker
        x={mm(MARGIN_MM)}
        y={mm(MARGIN_MM)}
        size={fiducialSize}
        pattern={0}
      />
      <FiducialMarker
        x={A4_WIDTH_PX - mm(MARGIN_MM + FIDUCIAL_SIZE_MM)}
        y={mm(MARGIN_MM)}
        size={fiducialSize}
        pattern={1}
      />
      <FiducialMarker
        x={mm(MARGIN_MM)}
        y={A4_HEIGHT_PX - mm(MARGIN_MM + FIDUCIAL_SIZE_MM)}
        size={fiducialSize}
        pattern={2}
      />
      <FiducialMarker
        x={A4_WIDTH_PX - mm(MARGIN_MM + FIDUCIAL_SIZE_MM)}
        y={A4_HEIGHT_PX - mm(MARGIN_MM + FIDUCIAL_SIZE_MM)}
        size={fiducialSize}
        pattern={3}
      />

      {/* Letter cells */}
      {cells.map((cell) => (
        <LetterCell
          key={cell.letter}
          x={cell.x}
          y={cell.y}
          width={cellWidth}
          height={cellHeight}
          letter={cell.letter}
        />
      ))}

      {/* Instructions at bottom */}
      <text
        x={A4_WIDTH_PX / 2}
        y={A4_HEIGHT_PX - mm(8)}
        textAnchor="middle"
        fontSize={10}
        fill="#999999"
        fontFamily="Arial, sans-serif"
      >
        Write each letter clearly within the guide lines. Use black ink for best results.
      </text>
    </svg>
  );
};

// Download button component
export const TemplateDownload: React.FC = () => {
  const handleDownloadSVG = useCallback(() => {
    const svgElement = document.querySelector('.template-svg-container svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'inkforge-font-template.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="template-download">
      <h3>Font Import Template</h3>
      <p>
        Download and print this template to create your own handwriting font.
        Write each letter in its box following the guide lines.
      </p>

      <div className="template-preview template-svg-container">
        <TemplateSVG />
      </div>

      <div className="template-actions">
        <button onClick={handleDownloadSVG} className="btn btn-primary">
          Download SVG
        </button>
        <button onClick={handlePrint} className="btn btn-secondary">
          Print Template
        </button>
      </div>
    </div>
  );
};

export default TemplateDownload;