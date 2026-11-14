import React, { useState, useRef } from 'react';
import { Upload, X, Check } from 'lucide-react';
import { parseUploadedPhotos, ParsedPhoto } from '../utils/exifParser';

interface StudioUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotosAdded: (newPhotos: ParsedPhoto[]) => void;
}

export const StudioUploader: React.FC<StudioUploaderProps> = ({
  isOpen,
  onClose,
  onPhotosAdded,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentCount, setRecentCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    const parsed = await parseUploadedPhotos(files);
    onPhotosAdded(parsed);
    setRecentCount(parsed.length);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl bg-[#F9F8F6] dark:bg-[#141414] border border-neutral-300 dark:border-neutral-800 p-8 shadow-2xl">
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-neutral-500 mb-2">
          CURATE / STUDIO ARCHIVE
        </p>
        <h2 className="font-serif text-3xl text-neutral-900 dark:text-neutral-100 mb-6">
          Import Contact Sheet
        </h2>

        {/* 拖放區域 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border border-dashed transition-all py-16 px-6 text-center ${
            isDragging
              ? 'border-amber-600 bg-amber-500/5'
              : 'border-neutral-400 dark:border-neutral-700 hover:border-neutral-800 dark:hover:border-neutral-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          <Upload className="w-6 h-6 mx-auto mb-4 text-neutral-500" />
          <p className="font-serif text-lg text-neutral-800 dark:text-neutral-200 mb-1">
            {isProcessing
              ? 'Reading EXIF & Developing Contact Sheet...'
              : 'Drop high-res photographs here, or click to browse'}
          </p>
          <p className="font-mono text-xs text-neutral-500">
            AUTO-EXTRACTS CAMERA METADATA & UPDATES SHUTTER HEATMAP
          </p>
        </div>

        {/* 上傳成功提示 */}
        {recentCount !== null && (
          <div className="mt-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 pt-4">
            <span className="flex items-center gap-2 font-mono text-xs text-emerald-700 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              {recentCount} FRAMES ADDED TO EXHIBITION & HEATMAP
            </span>
            <button
              onClick={onClose}
              className="font-mono text-xs tracking-widest uppercase underline underline-offset-4"
            >
              View Gallery →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};