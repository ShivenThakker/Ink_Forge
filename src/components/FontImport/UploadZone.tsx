import React, { useCallback, useState, useRef } from 'react';
import './FontImport.css';

interface UploadZoneProps {
  onImageUpload: (file: File, dataUrl: string) => void;
  accept?: string;
  disabled?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onImageUpload,
  accept = 'image/png,image/jpeg,image/jpg',
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.match(/^image\/(png|jpe?g)$/)) {
        alert('Please upload a PNG or JPEG image');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          onImageUpload(file, dataUrl);
        }
      };
      reader.readAsDataURL(file);
    },
    [onImageUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input so same file can be uploaded again
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div
      className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <div className="upload-zone-icon">📷</div>
      <div className="upload-zone-text">
        Drag and drop your photo here, or click to browse
      </div>
      <div className="upload-zone-hint">
        Supports PNG and JPEG images
      </div>
    </div>
  );
};

export default UploadZone;