import React, { useRef, useState } from 'react';
import { toBlob } from 'html-to-image';

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

export const StoryPosterExport: React.FC<StoryPosterExportProps> = ({
  dark,
  photographerName = 'MARA VENN',
  exhibitionNumber,
  exhibitionTitle,
  exhibitionSubtitle = '& Concrete',
  dateRange,
  coverImageSrc,
  coverPhotoTitle,
  coverPhotoSpecs,
}) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleShareToInstagram = async () => {
    if (!posterRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const blob = await toBlob(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 540,
        height: 960,
      });

      if (!blob) {
        throw new Error('Poster blob generation returned null');
      }

      const fileName = `${photographerName.toLowerCase().replace(/\s+/g, '-')}-story.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Native mobile share sheet -> direct to Instagram Stories
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${exhibitionTitle} — ${photographerName}`,
        });
        return;
      }

      // Desktop / fallback: download poster PNG & launch Instagram on mobile
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = objectUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = 'instagram://story-camera';
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('IG Story export failed:', err);
        alert('POSTER EXPORT FAILED: Please ensure the cover work is uploaded to your cloud gallery and try again.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const bg = dark ? '#0E0E0E' : '#F9F8F6';
  const fg = dark ? '#F2F0EC' : '#141414';
  const muted = dark ? '#8C8881' : '#73706B';
  const border = dark ? '#262626' : '#E2DFD9';

  return (
    <>
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
        {isExporting ? 'PREPARING IG STORY...' : 'SHARE TO IG STORY ↗'}
      </button>

      {/* Hidden 9:16 Exhibition Story Poster Canvas (540x960 -> 1080x1920) */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <div
          ref={posterRef}
          style={{
            width: '540px',
            height: '960px',
            backgroundColor: bg,
            color: fg,
            padding: '56px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '11px',
                letterSpacing: '0.2em',
                color: muted,
                borderBottom: `1px solid ${border}`,
                paddingBottom: '18px',
                marginBottom: '44px',
              }}
            >
              <span>{photographerName}</span>
              <span>{exhibitionNumber}</span>
            </div>

            <h1
              style={{
                fontSize: '58px',
                lineHeight: 0.96,
                fontWeight: 400,
                letterSpacing: '-0.02em',
                margin: '0 0 18px 0',
              }}
            >
              {exhibitionTitle}
              <br />
              <span style={{ fontStyle: 'italic' }}>{exhibitionSubtitle}</span>
            </h1>

            <p
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '11px',
                letterSpacing: '0.18em',
                color: muted,
                margin: 0,
              }}
            >
              {dateRange}
            </p>
          </div>

          <div style={{ margin: '24px 0' }}>
            <div
              style={{
                width: '100%',
                height: '440px',
                overflow: 'hidden',
                backgroundColor: dark ? '#181818' : '#EFECE6',
                marginBottom: '14px',
              }}
            >
              <img
                src={coverImageSrc}
                alt={coverPhotoTitle}
                crossOrigin="anonymous"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: '12px',
              }}
            >
              <span style={{ fontStyle: 'italic' }}>01 — {coverPhotoTitle}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  color: muted,
                }}
              >
                {coverPhotoSpecs}
              </span>
            </div>
          </div>

          <div
            style={{
              borderTop: `1px solid ${border}`,
              paddingTop: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '10px',
              letterSpacing: '0.18em',
              color: muted,
            }}
          >
            <span>STUDIO FOLIO ARCHIVE</span>
            <span>VIEW EXHIBITION ↗</span>
          </div>
        </div>
      </div>
    </>
  );
};