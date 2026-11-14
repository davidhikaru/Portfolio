import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';

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

  const handleExport = async () => {
    if (!posterRef.current || isExporting) return;
    setIsExporting(true);

    try {
      // 輸出 1080 x 1920 (pixelRatio: 2 會將 540x960 的畫布精準放大為 1080x1920 高解析度)
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 540,
        height: 960,
      });

      const link = document.createElement('a');
      link.download = `${photographerName.toLowerCase().replace(/\s+/g, '-')}-exhibition-story.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('海報生成失敗（若使用外部 Unsplash 圖片可能有跨域限制，請測試本地上傳的照片）:', err);
      alert('海報匯出失敗：請先透過右上角 CURATE / STUDIO 上傳一張本地照片作為封面後再試一次！');
    } finally {
      setIsExporting(false);
    }
  };

  // 配合畫廊白 / 暗房黑的主題配色
  const bg = dark ? '#0E0E0E' : '#F9F8F6';
  const fg = dark ? '#F2F0EC' : '#141414';
  const muted = dark ? '#8C8881' : '#73706B';
  const border = dark ? '#262626' : '#E2DFD9';

  return (
    <>
      {/* 觸發按鈕（完美融入你原本的 view-switcher 工具列） */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        style={{
          marginLeft: 'auto',
          letterSpacing: '0.16em',
          fontSize: '11px',
          textTransform: 'uppercase',
          borderBottom: '1px solid currentColor',
          paddingBottom: '2px',
          opacity: isExporting ? 0.5 : 1,
          cursor: 'pointer',
        }}
      >
        {isExporting ? 'GENERATING POSTER...' : 'EXPORT IG STORY ↓'}
      </button>

      {/* 隱藏在畫面外的 9:16 美術館海報畫布 (540 x 960 -> 匯出為 1080 x 1920) */}
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
          {/* 海報頂部：攝影師署名與展覽編號 */}
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

            {/* 展覽大標題 */}
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

          {/* 海報中央：主打作品與美術館說明牌 */}
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

          {/* 海報底部：線上看展導流資訊 */}
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
            <span>DIGITAL EXHIBITION ARCHIVE</span>
            <span>VIEW FULL SERIES ↗</span>
          </div>
        </div>
      </div>
    </>
  );
};