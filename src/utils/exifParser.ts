import exifr from 'exifr';

export interface UploadedPhotograph {
  src: string;
  alt: string;
  title: string;
  year: string;
  specs: string;
  credit: string;
  shootDateKey: string; // 格式 YYYY-MM-DD，用來精準對齊熱力圖日期
}

export async function parsePhotographs(files: FileList | File[]): Promise<UploadedPhotograph[]> {
  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));

  return Promise.all(
    imageFiles.map(async (file) => {
      const src = URL.createObjectURL(file);

      let exif: any = {};
      try {
        exif =
          (await exifr.parse(file, {
            pick: ['Make', 'Model', 'LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO', 'DateTimeOriginal'],
          })) || {};
      } catch {
        // 若無 EXIF 則使用預設值
      }

      const camera = exif.Model
        ? `${exif.Make ? exif.Make + ' ' : ''}${exif.Model}`.trim().toUpperCase()
        : 'DIGITAL ARCHIVE';

      const lens = exif.LensModel
        ? exif.LensModel.toUpperCase()
        : exif.FocalLength
        ? `${exif.FocalLength}MM`
        : 'PRIME LENS';

      const fNumber = exif.FNumber ? `F/${exif.FNumber}` : '';
      const shutter = exif.ExposureTime
        ? exif.ExposureTime < 1
          ? `1/${Math.round(1 / exif.ExposureTime)}S`
          : `${exif.ExposureTime}S`
        : '';
      const iso = exif.ISO ? `ISO ${exif.ISO}` : '';
      const exposure = [fNumber, shutter, iso].filter(Boolean).join(' ');

      const specs = [camera, lens, exposure].filter(Boolean).join(' · ') || 'RAW CAPTURE';

      const dateObj = exif.DateTimeOriginal ? new Date(exif.DateTimeOriginal) : new Date();
      const year = String(dateObj.getFullYear());
      // 取得本地 YYYY-MM-DD
      const shootDateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
        dateObj.getDate(),
      ).padStart(2, '0')}`;

      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      return {
        src,
        alt: cleanTitle,
        title: cleanTitle,
        year,
        specs,
        credit: 'MARA VENN STUDIO',
        shootDateKey,
      };
    }),
  );
}