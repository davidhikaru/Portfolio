import React, { useState } from 'react';

interface StoryPosterExportProps {
  dark: boolean;
  photographerName?: string;
  exhibitionNumber: string;
  exhibitionTitle: string;
  exhibitionSubtitle?: string;
  dateRange: string;
  coverImageSrc: string;
  coverPhotoTitle: string;
  coverPhotoSpecs: string;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

async function loadImageViaBlob(url: string): Promise<HTMLImageElement> {
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
      img.src = objectUrl;
    });
  } catch {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
}

export const StoryPosterExport: React.FC<StoryPosterExportProps> = ({
  dark,
  photographerName = 'MARA VENN',
  exhibitionNumber,
  exhibitionTitle,
  exhibitionSubtitle = '',
  dateRange,
  coverImageSrc,
  coverPhotoTitle,
  coverPhotoSpecs,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleShareToInstagram = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const W = 1080;
      const H = 1920;
      const pad = 96;
      const contentW = W - pad * 2;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      const bg = dark ? '#0E0E0E' : '#F9F8F6';
      const fg = dark ? '#F2F0EC' : '#141414';
      const muted = dark ? '#8C8881' : '#73706B';
      const border = dark ? '#262626' : '#E2DFD9';
      const frameBg = dark ? '#181818' : '#EFECE6';

      // Background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Top Header Bar
      ctx.fillStyle = muted;
      ctx.font = '500 22px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(photographerName.toUpperCase(), pad, 136);

      ctx.textAlign = 'right';
      ctx.fillText(exhibitionNumber.toUpperCase(), W - pad, 136);

      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad, 174);
      ctx.lineTo(W - pad, 174);
      ctx.stroke();

      // Exhibition Title
      ctx.textAlign = 'left';
      ctx.fillStyle = fg;
      ctx.font = '400 108px Georgia, "Times New Roman", serif';
      const titleLines = wrapTextLines(ctx, exhibitionTitle, contentW, 2);
      let cursorY = 300;
      titleLines.forEach((line) => {
        ctx.fillText(line, pad, cursorY);
        cursorY += 112;
      });

      if (exhibitionSubtitle) {
        ctx.fillStyle = muted;
        ctx.font = 'italic 48px Georgia, "Times New Roman", serif';
        ctx.fillText(exhibitionSubtitle, pad, cursorY - 24);
        cursorY += 46;
      }

      // Date Range
      ctx.fillStyle = muted;
      ctx.font = '400 22px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(dateRange.toUpperCase(), pad, cursorY + 12);

      // Cover Artwork Frame (Centered Aspect-Fit inside Gallery Mat)
      const boxTop = 620;
      const boxH = 920;
      ctx.fillStyle = frameBg;
      ctx.fillRect(pad, boxTop, contentW, boxH);

      const img = await loadImageViaBlob(coverImageSrc);
      const scale = Math.min(contentW / img.width, boxH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = pad + (contentW - drawW) / 2;
      const drawY = boxTop + (boxH - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Artwork Caption
      const captionY = boxTop + boxH + 54;
      ctx.fillStyle = fg;
      ctx.font = 'italic 30px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'left';
      ctx.fillText(`01 — ${coverPhotoTitle}`, pad, captionY);

      ctx.fillStyle = muted;
      ctx.font = '400 20px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(coverPhotoSpecs.toUpperCase(), W - pad, captionY);

      // Bottom Footer Rule & Colophon
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(pad, H - 156);
      ctx.lineTo(W - pad, H - 156);
      ctx.stroke();

      ctx.fillStyle = muted;
      ctx.font = '400 20px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('STUDIO FOLIO ARCHIVE', pad, H - 98);

      ctx.textAlign = 'right';
      ctx.fillText('VIEW EXHIBITION ↗', W - pad, H - 98);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG blob'))),
          'image/png',
        );
      });

      const fileName = `${photographerName.toLowerCase().replace(/\s+/g, '-')}-story.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Native mobile share sheet -> tap Instagram to open directly in IG Stories
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${exhibitionTitle} — ${photographerName}`,
        });
        return;
      }

      // Desktop / fallback: download PNG poster
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = objectUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('IG Story export failed:', err);
        alert('UNABLE TO EXPORT POSTER: Please try again in a moment.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleShareToInstagram}
      disabled={isExporting}
      className="ig-share-btn"
      style={{
        marginLeft: 'auto',
        letterSpacing: '0.16em',
        fontSize: '10px',
        textTransform: 'uppercase',
        borderBottom: '1px solid currentColor',
        paddingBottom: '2px',
        opacity: isExporting ? 0.5 : 1,
        cursor: 'pointer',
      }}
    >
      {isExporting ? 'GENERATING POSTER...' : 'SHARE TO IG STORY ↗'}
    </button>
  );
};