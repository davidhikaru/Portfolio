import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { parsePhotographs } from "./utils/exifParser";
import { StoryPosterExport } from "./components/StoryPosterExport";
import { supabase } from "./utils/supabaseClient";

type ArtistProfile = {
  id: string;
  display_name: string;
  location: string;
  bio: string;
  specialty: string;
  instagram_handle?: string;
  contact_email?: string;
  avatar_url?: string | null;
  available_for_commissions: boolean;
  isFeaturedDemo?: boolean;
};

type Exhibition = {
  id: string;
  user_id: string;
  title: string;
  location: string;
  period: string;
  description: string;
  isVirtualDefault?: boolean;
};

type Photograph = {
  id?: string;
  user_id?: string;
  exhibition_id?: string | null;
  src: string;
  thumbSrc?: string;
  alt: string;
  title: string;
  year: string;
  specs: string;
  credit: string;
  storyNote?: string;
  shootDateKey?: string;
  isCover?: boolean;
  createdAt?: string;
};

type ActivityDay = {
  date: Date;
  dateKey: string;
  dateLabel: string;
  count: number;
  level: number;
  exhibitionIndex: number;
  thumbnail: string;
};

type ConfirmDialogState = {
  eyebrow: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

const FALLBACK_GALLERY_IMAGE =
  "https://images.unsplash.com/photo-1693814610769-66238d08422a?auto=format&fit=crop&w=1800&q=88";

function getSafeImageSrc(src?: string | null): string {
  if (!src || typeof src !== "string") return FALLBACK_GALLERY_IMAGE;
  const trimmed = src.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  return FALLBACK_GALLERY_IMAGE;
}

function formatRelativeDate(isoString?: string, fallbackYear?: string): string {
  if (!isoString) return fallbackYear || "ARCHIVE";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return fallbackYear || "ARCHIVE";
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "JUST NOW";
  if (diffHours < 24) return `${diffHours}H AGO`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}D AGO`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })
    .format(date)
    .toUpperCase();
}

async function generateDualSizeBlobs(
  file: File,
): Promise<{ fullBlob: Blob; thumbBlob: Blob }> {
  const resizeToBlob = (
    maxDimension: number,
    quality: number,
    skipIfSmall: boolean,
  ): Promise<Blob> =>
    new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;

        if (
          skipIfSmall &&
          width <= maxDimension &&
          height <= maxDimension &&
          file.size <= 1.8 * 1024 * 1024
        ) {
          resolve(file);
          return;
        }

        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height >= width && height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });

  const [fullBlob, thumbBlob] = await Promise.all([
    resizeToBlob(2400, 0.92, true),
    resizeToBlob(800, 0.82, false),
  ]);

  return { fullBlob, thumbBlob };
}

function extractStoragePathFromUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string" || !url.includes("/portfolio-photos/")) return null;
  const marker = "/portfolio-photos/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

const MARA_VENN_PROFILE: ArtistProfile = {
  id: "featured-mara-venn",
  display_name: "Mara Venn",
  location: "REYKJAVÍK, IS · WORKING INTERNATIONALLY",
  bio: "Mara Venn photographs the quiet architecture of distance—where weather, memory, and built form briefly meet.",
  specialty: "EDITORIAL · LANDSCAPE · ARCHITECTURE",
  instagram_handle: "maravenn.archive",
  contact_email: "studio@maravenn.example",
  available_for_commissions: true,
  isFeaturedDemo: true,
};

const maraVennExhibitions: Exhibition[] = [
  {
    id: "mv-ex-1",
    user_id: "featured-mara-venn",
    title: "Shorelines & Concrete",
    location: "NORTH ATLANTIC",
    period: "2022—2024",
    description:
      "A study of distance, built form, and the quiet space between arrival and departure. Photographs made along the North Atlantic edge, 2022–2024.",
  },
  {
    id: "mv-ex-2",
    user_id: "featured-mara-venn",
    title: "Quiet Transit",
    location: "TOKYO / BERLIN",
    period: "2023",
    description: "Solitary figures in transitional stations between dusk and midnight.",
  },
];

const maraVennPhotographs: Photograph[] = [
  {
    id: "mv-1",
    user_id: "featured-mara-venn",
    exhibition_id: "mv-ex-1",
    src: "https://images.unsplash.com/photo-1533057917386-1c1477353a3c?auto=format&fit=crop&w=2200&q=88",
    thumbSrc: "https://images.unsplash.com/photo-1533057917386-1c1477353a3c?auto=format&fit=crop&w=900&q=82",
    alt: "A solitary person standing at the edge of a pale, misty sea",
    title: "The Measure of Distance",
    year: "2024",
    specs: "LEICA M6 · 35MM F/1.4 · PORTRA 400",
    credit: "MARA VENN",
    storyNote: "Shot ten minutes before fog closed the harbor wall along the southern coast.",
    isCover: true,
  },
  {
    id: "mv-2",
    user_id: "featured-mara-venn",
    exhibition_id: "mv-ex-1",
    src: "https://images.unsplash.com/photo-1767854507654-5852c55b8d2f?auto=format&fit=crop&w=1400&q=88",
    thumbSrc: "https://images.unsplash.com/photo-1767854507654-5852c55b8d2f?auto=format&fit=crop&w=900&q=82",
    alt: "Geometric concrete architecture and stairs in hard afternoon light",
    title: "Passage I",
    year: "2023",
    specs: "MAMIYA 7 II · 80MM F/4 · TRI-X 400",
    credit: "MARA VENN",
  },
  {
    id: "mv-3",
    user_id: "featured-mara-venn",
    exhibition_id: "mv-ex-1",
    src: "https://images.unsplash.com/photo-1767307804826-f7a0d2c9f622?auto=format&fit=crop&w=1400&q=88",
    thumbSrc: "https://images.unsplash.com/photo-1767307804826-f7a0d2c9f622?auto=format&fit=crop&w=900&q=82",
    alt: "Tree shadows falling across a white wall with an arched window",
    title: "Passage II",
    year: "2023",
    specs: "MAMIYA 7 II · 80MM F/4 · TRI-X 400",
    credit: "MARA VENN",
  },
  {
    id: "mv-4",
    user_id: "featured-mara-venn",
    exhibition_id: "mv-ex-1",
    src: "https://images.unsplash.com/photo-1507408167442-88d2ef62e386?auto=format&fit=crop&w=2200&q=88",
    thumbSrc: "https://images.unsplash.com/photo-1507408167442-88d2ef62e386?auto=format&fit=crop&w=900&q=82",
    alt: "A small figure standing on a ridge above a field of fog",
    title: "Weather Study, No. 6",
    year: "2024",
    specs: "HASSELBLAD 500C/M · 80MM F/2.8 · DELTA 100",
    credit: "MARA VENN",
  },
  {
    id: "mv-5",
    user_id: "featured-mara-venn",
    exhibition_id: "mv-ex-1",
    src: "https://images.unsplash.com/photo-1777792405713-e0a895c8457c?auto=format&fit=crop&w=1400&q=88",
    thumbSrc: "https://images.unsplash.com/photo-1777792405713-e0a895c8457c?auto=format&fit=crop&w=900&q=82",
    alt: "A dark narrow hallway ending in a single illuminated window",
    title: "Darkroom Window",
    year: "2022",
    specs: "LEICA Q2 · 28MM F/1.7 · ISO 1600",
    credit: "MARA VENN",
  },
  {
    id: "mv-6",
    user_id: "featured-mara-venn",
    exhibition_id: "mv-ex-1",
    src: "https://images.unsplash.com/photo-1693814610769-66238d08422a?auto=format&fit=crop&w=1800&q=88",
    thumbSrc: "https://images.unsplash.com/photo-1693814610769-66238d08422a?auto=format&fit=crop&w=900&q=82",
    alt: "A quiet monochrome gallery room with a bench and framed artwork",
    title: "After the Visitors",
    year: "2024",
    specs: "PENTAX 67 · 105MM F/2.4 · T-MAX 400",
    credit: "MARA VENN",
  },
  {
    id: "mv-7",
    user_id: "featured-mara-venn",
    exhibition_id: "mv-ex-2",
    src: "https://images.unsplash.com/photo-1722131073730-0b2bd13c9bff?auto=format&fit=crop&w=1800&q=88",
    thumbSrc: "https://images.unsplash.com/photo-1722131073730-0b2bd13c9bff?auto=format&fit=crop&w=900&q=82",
    alt: "A person in a suit waiting alone for a train",
    title: "Platform 04, Shinjuku",
    year: "2023",
    specs: "LEICA M6 · 50MM F/2 · CINESTILL 800T",
    credit: "MARA VENN",
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function buildActivity(
  artistPhotos: Photograph[],
  artistExhibitions: Exhibition[],
  isDemo: boolean,
): ActivityDay[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (53 * 7 - 1));

  const uploadMap = new Map<string, { count: number; thumb: string; exIdx: number }>();
  artistPhotos.forEach((p) => {
    if (p.shootDateKey) {
      const prev = uploadMap.get(p.shootDateKey);
      const foundExIdx = artistExhibitions.findIndex((e) => e.id === p.exhibition_id);
      uploadMap.set(p.shootDateKey, {
        count: (prev?.count || 0) + 1,
        thumb: getSafeImageSrc(p.thumbSrc || p.src),
        exIdx: foundExIdx >= 0 ? foundExIdx : 0,
      });
    }
  });

  const fallbackThumb = getSafeImageSrc(artistPhotos[0]?.thumbSrc || artistPhotos[0]?.src);

  return Array.from({ length: 53 * 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = toDateKey(date);

    const signal = (index * 17 + index * index * 3) % 31;
    const active = isDemo && (signal < 12 || index % 43 === 0);
    const baseCount = active ? ((index * 7) % 18) + 2 : 0;

    const uploaded = uploadMap.get(dateKey);
    const count = baseCount + (uploaded ? uploaded.count * 4 : 0);

    return {
      date,
      dateKey,
      dateLabel: new Intl.DateTimeFormat("en", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(date),
      count,
      level: count === 0 ? 0 : count < 6 ? 1 : count < 11 ? 2 : count < 16 ? 3 : 4,
      exhibitionIndex: uploaded ? uploaded.exIdx : isDemo ? index % 2 : 0,
      thumbnail: uploaded ? uploaded.thumb : fallbackThumb,
    };
  });
}

function Placard({ photo, number }: { photo: Photograph; number: string }) {
  return (
    <div className="placard">
      <div>
        <span>{number}</span>
        <p>
          <em>{photo.title}</em>, {photo.year}
        </p>
      </div>
      <p className="specs">{photo.specs}</p>
    </div>
  );
}

function PhotoButton({
  photo,
  index,
  className = "",
  number,
}: {
  photo: Photograph;
  index: number;
  className?: string;
  number: string;
}) {
  return (
    <figure className={className}>
      <motion.button
        className="photo-frame"
        onClick={() => window.dispatchEvent(new CustomEvent("open-photo", { detail: index }))}
        whileHover={{ scale: 0.997 }}
        transition={{ duration: 0.7, ease }}
        aria-label={`Open ${photo.title} in lightbox`}
      >
        <img
          src={getSafeImageSrc(photo.src)}
          alt={photo.alt}
          loading="lazy"
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
              e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
            }
          }}
        />
        <span className="view-cue">VIEW</span>
      </motion.button>
      <Placard photo={photo} number={number} />
    </figure>
  );
}

function ActivityHeatmap({
  dark,
  selectedDate,
  onSelect,
  artistPhotos,
  artistExhibitions,
  isDemo,
}: {
  dark: boolean;
  selectedDate: string | null;
  onSelect: (day: ActivityDay) => void;
  artistPhotos: Photograph[];
  artistExhibitions: Exhibition[];
  isDemo: boolean;
}) {
  const days = useMemo(
    () => buildActivity(artistPhotos, artistExhibitions, isDemo),
    [artistPhotos, artistExhibitions, isDemo],
  );
  const shootDays = days.filter((day) => day.count > 0).length;
  const totalFrames = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className="activity-section" aria-labelledby="activity-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SHUTTER ACTIVITY / PAST 12 MONTHS</p>
          <h2 id="activity-title">A year in exposures.</h2>
        </div>
        <p>
          {shootDays} SHOOT DAYS · {totalFrames.toLocaleString()} FRAMES
        </p>
      </div>

      <div className="heatmap-frame">
        <div className="heatmap-months" aria-hidden="true">
          {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map(
            (month) => (
              <span key={month}>{month}</span>
            ),
          )}
        </div>
        <div className="heatmap-scroll">
          <div className="heatmap-grid" aria-label="53 weeks of photographic activity">
            {days.map((day, index) => (
              <button
                key={day.dateKey}
                className={`activity-cell level-${day.level} ${
                  selectedDate === day.dateLabel ? "selected" : ""
                }`}
                style={
                  day.level > 0
                    ? ({
                        "--activity-color": dark
                          ? ["", "#4b2e16", "#805020", "#b87524", "#e2a54c"][day.level]
                          : ["", "#e9dfd0", "#d4b98f", "#b5844e", "#7d4f29"][day.level],
                      } as React.CSSProperties)
                    : undefined
                }
                onClick={() => day.count > 0 && onSelect(day)}
                aria-label={
                  day.count > 0
                    ? `${day.dateLabel}: ${day.count} photographs. Select this shoot.`
                    : `${day.dateLabel}: no photographs`
                }
                disabled={day.count === 0}
              >
                {day.count > 0 && (
                  <span className={`activity-tooltip ${index > 335 ? "tooltip-left" : ""}`}>
                    <img
                      src={day.thumbnail}
                      alt=""
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
                          e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
                        }
                      }}
                    />
                    <span>
                      <strong>{day.dateLabel}</strong>
                      {day.count} PHOTOGRAPHS
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="heatmap-key">
          <span>QUIET</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={`level-${level}`} />
          ))}
          <span>ACTIVE</span>
        </div>
      </div>
    </section>
  );
}

/* ==================== Curated Instagram-Style Stream + Directory (Home) ==================== */
function DiscoverView({
  artists,
  allPhotos,
  allExhibitions,
  onSelectArtist,
  onOpenExhibitionDirect,
  onOpenFeedLightbox,
  currentUserId,
  onOpenStudioOrLogin,
}: {
  artists: ArtistProfile[];
  allPhotos: Photograph[];
  allExhibitions: Exhibition[];
  onSelectArtist: (artistId: string) => void;
  onOpenExhibitionDirect: (artistId: string, exhibitionId: string) => void;
  onOpenFeedLightbox: (feedList: Photograph[], index: number) => void;
  currentUserId?: string;
  onOpenStudioOrLogin: () => void;
}) {
  const [homeMode, setHomeMode] = useState<"stream" | "directory">("stream");
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>("all");
  const [directoryFilter, setDirectoryFilter] = useState<"all" | "commissions">("all");

  const activeArtists = useMemo(() => {
    return artists.filter((artist) =>
      allPhotos.some((photo) => photo.user_id === artist.id),
    );
  }, [artists, allPhotos]);

  const streamPhotos = useMemo(() => {
    if (selectedArtistFilter === "all") return allPhotos;
    return allPhotos.filter((p) => p.user_id === selectedArtistFilter);
  }, [allPhotos, selectedArtistFilter]);

  const filteredArtists = useMemo(() => {
    if (directoryFilter === "commissions") {
      return activeArtists.filter((a) => a.available_for_commissions);
    }
    return activeArtists;
  }, [activeArtists, directoryFilter]);

  return (
    <motion.div
      key="discover"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      {/* Compact Editorial Masthead */}
      <section className="feed-masthead" id="top">
        <div className="feed-masthead-top">
          <div>
            <p className="eyebrow">STUDIO FOLIO · DISPATCH STREAM</p>
            <h1>Latest Frames</h1>
          </div>

          <div className="feed-masthead-actions">
            <div className="mode-toggle" role="group" aria-label="Discover display mode">
              <button
                className={homeMode === "stream" ? "active" : ""}
                onClick={() => setHomeMode("stream")}
              >
                LATEST STREAM ({allPhotos.length})
              </button>
              <span>/</span>
              <button
                className={homeMode === "directory" ? "active" : ""}
                onClick={() => setHomeMode("directory")}
              >
                RESIDENT ARTISTS ({activeArtists.length})
              </button>
            </div>

            <button onClick={onOpenStudioOrLogin} className="studio-button">
              {currentUserId ? "MY GALLERY →" : "+ OPEN GALLERY"}
            </button>
          </div>
        </div>

        {/* Minimalist Avatar-Free Resident Strip (Only artists with published works) */}
        <div className="resident-strip" aria-label="Filter stream by photographer">
          <button
            className={`resident-pill ${selectedArtistFilter === "all" ? "active" : ""}`}
            onClick={() => {
              setSelectedArtistFilter("all");
              setHomeMode("stream");
            }}
          >
            <span className="pill-dot" />
            ALL PHOTOGRAPHERS ({allPhotos.length})
          </button>

          {activeArtists.map((artist) => {
            const count = allPhotos.filter((p) => p.user_id === artist.id).length;
            const isSelected = selectedArtistFilter === artist.id && homeMode === "stream";
            return (
              <div key={artist.id} className="resident-pill-group">
                <button
                  className={`resident-pill ${isSelected ? "active" : ""}`}
                  onClick={() => {
                    setSelectedArtistFilter(artist.id);
                    setHomeMode("stream");
                  }}
                >
                  {artist.display_name.toUpperCase()} ({count})
                </button>
                <button
                  className="resident-enter-link"
                  onClick={() => onSelectArtist(artist.id)}
                  title={`Enter ${artist.display_name}'s full gallery`}
                  aria-label={`Enter ${artist.display_name}'s gallery`}
                >
                  ↗
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {homeMode === "stream" ? (
        <section className="curated-feed" aria-label="Latest photography stream">
          {streamPhotos.length === 0 ? (
            <div className="feed-empty">
              <p className="eyebrow">NO PHOTOGRAPHS PUBLISHED IN THIS STREAM YET.</p>
            </div>
          ) : (
            streamPhotos.map((photo, index) => {
              const author =
                artists.find((a) => a.id === photo.user_id) || MARA_VENN_PROFILE;
              const exhibition = allExhibitions.find((e) => e.id === photo.exhibition_id);
              const locationLabel =
                exhibition?.location || author.location.split("·")[0].trim();

              return (
                <article className="feed-card" key={photo.id || `${photo.src}-${index}`}>
                  {/* Card Header: Photographer & Exhibition Context */}
                  <div className="feed-card-header">
                    <div className="feed-author-block">
                      <button
                        className="feed-author-name"
                        onClick={() => onSelectArtist(author.id)}
                      >
                        {author.display_name}
                      </button>
                      <span className="feed-meta-line">
                        {locationLabel}
                        {exhibition ? (
                          <>
                            {" · "}
                            <button
                              className="feed-ex-link"
                              onClick={() => onOpenExhibitionDirect(author.id, exhibition.id)}
                            >
                              {exhibition.title.toUpperCase()} ↗
                            </button>
                          </>
                        ) : null}
                      </span>
                    </div>

                    <div className="feed-card-right">
                      <span className="feed-timestamp">
                        {formatRelativeDate(photo.createdAt, photo.year)}
                      </span>
                      <button
                        className="feed-visit-btn"
                        onClick={() => onSelectArtist(author.id)}
                      >
                        GALLERY →
                      </button>
                    </div>
                  </div>

                  {/* Full-Bleed Frame */}
                  <button
                    className="feed-photo-frame"
                    onClick={() => onOpenFeedLightbox(streamPhotos, index)}
                    aria-label={`Inspect ${photo.title} by ${author.display_name}`}
                  >
                    <img
                      src={getSafeImageSrc(photo.src)}
                      alt={photo.alt}
                      loading={index < 2 ? "eager" : "lazy"}
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
                          e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
                        }
                      }}
                    />
                    <span className="view-cue">INSPECT FRAME</span>
                  </button>

                  {/* Card Footer: Title, Story Note & EXIF */}
                  <div className="feed-card-footer">
                    <div className="feed-caption-row">
                      <p className="feed-title">
                        <em>{photo.title}</em>, {photo.year}
                      </p>
                      <p className="feed-specs">{photo.specs}</p>
                    </div>

                    {photo.storyNote && (
                      <p className="feed-story-note">&ldquo;{photo.storyNote}&rdquo;</p>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : (
        <section className="exhibitions-index" id="artists-directory">
          <div className="section-heading index-heading">
            <div>
              <p className="eyebrow">ARTIST DIRECTORY</p>
              <h2>Resident galleries.</h2>
            </div>
            <div style={{ display: "flex", gap: "14px", fontSize: "9px", letterSpacing: "0.14em" }}>
              <button
                onClick={() => setDirectoryFilter("all")}
                style={{
                  opacity: directoryFilter === "all" ? 1 : 0.45,
                  textDecoration: directoryFilter === "all" ? "underline" : "none",
                  cursor: "pointer",
                }}
              >
                ALL ARTISTS ({activeArtists.length})
              </button>
              <span>/</span>
              <button
                onClick={() => setDirectoryFilter("commissions")}
                style={{
                  opacity: directoryFilter === "commissions" ? 1 : 0.45,
                  textDecoration: directoryFilter === "commissions" ? "underline" : "none",
                  cursor: "pointer",
                }}
              >
                AVAILABLE FOR COMMISSIONS
              </button>
            </div>
          </div>

          <div className="exhibition-list">
            {filteredArtists.map((artist, index) => {
              const artistWorks = allPhotos.filter((p) => p.user_id === artist.id);
              const coverPhoto = artistWorks.find((p) => p.isCover) || artistWorks[0];

              return (
                <article className="exhibition-row" key={artist.id}>
                  <button
                    onClick={() => onSelectArtist(artist.id)}
                    aria-label={`Enter ${artist.display_name}'s gallery`}
                  >
                    <div className="exhibition-cover">
                      <img
                        src={getSafeImageSrc(coverPhoto?.thumbSrc || coverPhoto?.src)}
                        alt={artist.display_name}
                        onError={(e) => {
                          if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
                            e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
                          }
                        }}
                      />
                      <span>
                        ENTER GALLERY ({artistWorks.length}{" "}
                        {artistWorks.length === 1 ? "WORK" : "WORKS"}) ↗
                      </span>
                    </div>
                    <div className="exhibition-title-line">
                      <span>{String(index + 1).padStart(2, "0")} /</span>
                      <h3>{artist.display_name}</h3>
                      <p>
                        {artist.location.split("·")[0]}
                        <br />
                        {artist.specialty}
                      </p>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <footer>
        <p>STUDIO FOLIO / DIGITAL GALLERY</p>
        <p>© 2026 CURATED ARCHIVE</p>
        <a href="#top">RETURN TO TOP ↑</a>
      </footer>
    </motion.div>
  );
}

/* ==================== Individual Artist Gallery ==================== */
function ArtistGalleryProfileView({
  artist,
  artistPhotos,
  artistExhibitions,
  dark,
  isOwnProfile,
  onOpenExhibition,
  onOpenStudio,
  onSaveProfile,
  onBackToDiscover,
}: {
  artist: ArtistProfile;
  artistPhotos: Photograph[];
  artistExhibitions: Exhibition[];
  dark: boolean;
  isOwnProfile: boolean;
  onOpenExhibition: (exhibition: Exhibition) => void;
  onOpenStudio: () => void;
  onSaveProfile: (updated: Partial<ArtistProfile>) => Promise<void>;
  onBackToDiscover: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<ActivityDay | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [editName, setEditName] = useState(artist.display_name);
  const [editLocation, setEditLocation] = useState(artist.location);
  const [editBio, setEditBio] = useState(artist.bio);
  const [editSpecialty, setEditSpecialty] = useState(artist.specialty);
  const [editInstagram, setEditInstagram] = useState(artist.instagram_handle || "");
  const [editEmail, setEditEmail] = useState(artist.contact_email || "");
  const [editAvailable, setEditAvailable] = useState(artist.available_for_commissions);

  useEffect(() => {
    setEditName(artist.display_name);
    setEditLocation(artist.location);
    setEditBio(artist.bio);
    setEditSpecialty(artist.specialty);
    setEditInstagram(artist.instagram_handle || "");
    setEditEmail(artist.contact_email || "");
    setEditAvailable(artist.available_for_commissions);
    setIsEditing(false);
  }, [artist]);

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}/?artist=${encodeURIComponent(artist.id)}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const selectDay = (day: ActivityDay) => {
    setSelectedDay(day);
    requestAnimationFrame(() =>
      document
        .getElementById("exhibitions")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const cleanedIg = editInstagram.trim().replace(/^@/, "");
    await onSaveProfile({
      display_name: editName.trim() || artist.display_name,
      location: editLocation.trim() || artist.location,
      bio: editBio.trim() || artist.bio,
      specialty: editSpecialty.trim() || artist.specialty,
      instagram_handle: cleanedIg,
      contact_email: editEmail.trim(),
      available_for_commissions: editAvailable,
    });
    setSaving(false);
    setIsEditing(false);
  };

  const displayExhibitions: Exhibition[] = useMemo(() => {
    if (artistExhibitions.length > 0) {
      return artistExhibitions;
    }
    if (artistPhotos.length > 0) {
      return [
        {
          id: `default-${artist.id}`,
          user_id: artist.id,
          title: `${artist.display_name} — Selected Works`,
          location: artist.location.split("·")[0].trim(),
          period: "2026",
          description: artist.bio,
          isVirtualDefault: true,
        },
      ];
    }
    return [];
  }, [artistExhibitions, artistPhotos.length, artist]);

  return (
    <motion.div
      key={`artist-${artist.id}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <section className="profile-hero" id="top">
        <div className="profile-kicker">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={onBackToDiscover} className="eyebrow" style={{ cursor: "pointer" }}>
              ← DISCOVER STREAM
            </button>
            <span className="eyebrow">/</span>
            <p className="eyebrow">PHOTOGRAPHER / ARTIST</p>
          </div>
          <p>{artist.location}</p>
        </div>

        <div className="profile-name">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease }}
          >
            {artist.display_name}
          </motion.h1>

          <div className="profile-name-right">
            <div className="availability" style={{ opacity: artist.available_for_commissions ? 1 : 0.45 }}>
              <span style={{ background: artist.available_for_commissions ? undefined : "#888" }} />
              {artist.available_for_commissions
                ? "AVAILABLE FOR COMMISSIONS"
                : "ARCHIVE / NOT TAKING COMMISSIONS"}
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={handleCopyShareLink}
                className="text-button"
                style={{
                  fontSize: "9px",
                  padding: "6px 10px",
                  border: "1px solid var(--line)",
                }}
              >
                {copiedLink ? "✓ LINK COPIED" : "SHARE GALLERY LINK"}
              </button>

              {isOwnProfile && (
                <button
                  onClick={() => setIsEditing((v) => !v)}
                  className="text-button"
                  style={{
                    fontSize: "9px",
                    padding: "6px 10px",
                    border: "1px solid var(--line)",
                  }}
                >
                  {isEditing ? "CANCEL" : "EDIT PROFILE"}
                </button>
              )}
            </div>
          </div>
        </div>

        {isEditing ? (
          <form
            onSubmit={handleSave}
            style={{
              marginTop: "32px",
              padding: "24px",
              border: "1px solid var(--line)",
              display: "grid",
              gap: "14px",
              maxWidth: "620px",
            }}
          >
            <p className="eyebrow">CUSTOMIZE YOUR ARTIST GALLERY</p>
            <label style={{ display: "grid", gap: "4px", fontSize: "10px", letterSpacing: "0.1em" }}>
              ARTIST / STUDIO NAME
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "14px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "10px", letterSpacing: "0.1em" }}>
              LOCATION & BASE
              <input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "13px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "10px", letterSpacing: "0.1em" }}>
              ARTIST STATEMENT / BIO
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "10px", letterSpacing: "0.1em" }}>
              SPECIALTIES
              <input
                value={editSpecialty}
                onChange={(e) => setEditSpecialty(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "13px",
                }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "grid", gap: "4px", fontSize: "10px", letterSpacing: "0.1em" }}>
                INSTAGRAM HANDLE (OPTIONAL)
                <input
                  value={editInstagram}
                  onChange={(e) => setEditInstagram(e.target.value)}
                  placeholder="username"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--line)",
                    background: "transparent",
                    color: "inherit",
                    fontSize: "13px",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "4px", fontSize: "10px", letterSpacing: "0.1em" }}>
                INQUIRY EMAIL (OPTIONAL)
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="studio@example.com"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--line)",
                    background: "transparent",
                    color: "inherit",
                    fontSize: "13px",
                  }}
                />
              </label>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={editAvailable}
                onChange={(e) => setEditAvailable(e.target.checked)}
              />
              SHOW &ldquo;AVAILABLE FOR COMMISSIONS&rdquo; STATUS
            </label>
            <div>
              <button type="submit" disabled={saving} className="studio-button">
                {saving ? "SAVING..." : "SAVE GALLERY PROFILE"}
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-statement">
            <p>{artist.bio}</p>
            <div className="profile-meta-group">
              <p className="profile-meta">{artist.specialty}</p>
              {(artist.instagram_handle || artist.contact_email) && (
                <div className="artist-contact-links">
                  {artist.instagram_handle && (
                    <a
                      href={`https://instagram.com/${artist.instagram_handle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      INSTAGRAM @{artist.instagram_handle.replace(/^@/, "").toUpperCase()} ↗
                    </a>
                  )}
                  {artist.contact_email && (
                    <a href={`mailto:${artist.contact_email}`}>
                      INQUIRIES / EMAIL ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <ActivityHeatmap
        dark={dark}
        selectedDate={selectedDay?.dateLabel ?? null}
        onSelect={selectDay}
        artistPhotos={artistPhotos}
        artistExhibitions={displayExhibitions}
        isDemo={Boolean(artist.isFeaturedDemo)}
      />

      <section className="exhibitions-index" id="exhibitions" aria-labelledby="exhibitions-title">
        <div className="section-heading index-heading">
          <div>
            <p className="eyebrow">CURATED EXHIBITIONS ({displayExhibitions.length})</p>
            <h2 id="exhibitions-title">Selected bodies of work.</h2>
          </div>
          {selectedDay && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              SHOWING ACTIVITY FROM {selectedDay.dateLabel.toUpperCase()}
            </motion.p>
          )}
        </div>

        <div className="exhibition-list">
          {displayExhibitions.length > 0 ? (
            displayExhibitions.map((ex, idx) => {
              const exPhotos = ex.isVirtualDefault
                ? artistPhotos
                : artistPhotos.filter((p) => p.exhibition_id === ex.id);

              const mergedPhotos =
                !ex.isVirtualDefault && idx === 0
                  ? [...exPhotos, ...artistPhotos.filter((p) => !p.exhibition_id)]
                  : exPhotos;

              const cover = mergedPhotos.find((p) => p.isCover) || mergedPhotos[0];
              const highlighted = selectedDay?.exhibitionIndex === idx;

              return (
                <article
                  key={ex.id}
                  className={`exhibition-row ${highlighted ? "activity-highlight" : ""}`}
                >
                  <button
                    onClick={() => onOpenExhibition(ex)}
                    aria-label={`Open ${ex.title} exhibition`}
                  >
                    <div className="exhibition-cover">
                      <img
                        src={getSafeImageSrc(cover?.thumbSrc || cover?.src)}
                        alt={ex.title}
                        onError={(e) => {
                          if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
                            e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
                          }
                        }}
                      />
                      <span>
                        VIEW EXHIBITION ({mergedPhotos.length}{" "}
                        {mergedPhotos.length === 1 ? "FRAME" : "FRAMES"}) ↗
                      </span>
                    </div>
                    <div className="exhibition-title-line">
                      <span>{String(idx + 1).padStart(2, "0")} /</span>
                      <h3>{ex.title}</h3>
                      <p>
                        {ex.location}
                        <br />
                        {ex.period}
                      </p>
                    </div>
                  </button>
                </article>
              );
            })
          ) : (
            <div
              style={{
                padding: "56px 24px",
                border: "1px dashed var(--line)",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "13px", marginBottom: "18px", color: "var(--muted)" }}>
                {isOwnProfile
                  ? "Your gallery wall is currently empty. Open Studio to upload your first photographs."
                  : `${artist.display_name} has not published exhibitions yet.`}
              </p>
              {isOwnProfile && (
                <button onClick={onOpenStudio} className="studio-button">
                  + OPEN STUDIO TO CURATE
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <footer>
        <p>{artist.display_name.toUpperCase()} / PHOTOGRAPHER</p>
        <p>© 2026 {artist.display_name.toUpperCase()}</p>
        <a href="#top">RETURN TO TOP ↑</a>
      </footer>
    </motion.div>
  );
}

/* ==================== Exhibition Layouts ==================== */
function EditorialGallery({ photos }: { photos: Photograph[] }) {
  if (photos.length === 0) {
    return (
      <div style={{ padding: "80px 6vw", textAlign: "center", color: "var(--muted)" }}>
        <p className="eyebrow">THIS EXHIBITION ROOM CURRENTLY HAS NO PHOTOGRAPHS ASSIGNED.</p>
      </div>
    );
  }

  if (photos.length >= 6) {
    const extraPhotos = photos.slice(6);
    return (
      <section className="gallery" aria-label="Editorial photo exhibition">
        <PhotoButton photo={photos[0]} index={0} number="01" className="hero-work" />
        <div className="diptych">
          <PhotoButton photo={photos[1]} index={1} number="02" className="portrait-work first" />
          <PhotoButton photo={photos[2]} index={2} number="03" className="portrait-work second" />
        </div>
        <PhotoButton photo={photos[3]} index={3} number="04" className="wide-work" />
        <div className="staggered">
          <div className="chapter-note">
            <p className="eyebrow">CHAPTER II</p>
            <h2>The rooms we leave behind.</h2>
          </div>
          <PhotoButton photo={photos[4]} index={4} number="05" className="dark-work" />
        </div>
        <PhotoButton photo={photos[5]} index={5} number="06" className="closing-work" />

        {extraPhotos.map((photo, idx) => (
          <PhotoButton
            key={photo.id || photo.src}
            photo={photo}
            index={6 + idx}
            number={String(7 + idx).padStart(2, "0")}
            className="wide-work"
          />
        ))}
      </section>
    );
  }

  return (
    <section className="gallery" aria-label="Editorial photo exhibition">
      <PhotoButton photo={photos[0]} index={0} number="01" className="hero-work" />
      {photos.slice(1).map((photo, idx) => (
        <PhotoButton
          key={photo.id || photo.src}
          photo={photo}
          index={idx + 1}
          number={String(idx + 2).padStart(2, "0")}
          className={idx % 2 === 0 ? "wide-work" : "closing-work"}
        />
      ))}
    </section>
  );
}

function ContactSheet({ photos, artistName }: { photos: Photograph[]; artistName: string }) {
  return (
    <section className="contact-sheet" aria-label="Contact sheet">
      <div className="contact-strip">
        <div className="film-note">
          {artistName.slice(0, 6).toUpperCase()} / ROLL 01 / ARCHIVE
        </div>
        <div className="contact-grid">
          {photos.map((photo, index) => {
            const selected = photo.isCover || index === 0;
            return (
              <button
                className={selected ? "contact-frame selected-pick" : "contact-frame"}
                key={photo.id || photo.src}
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-photo", { detail: index }))
                }
                aria-label={`Open frame ${index + 1}, ${photo.title}`}
              >
                <img
                  src={getSafeImageSrc(photo.thumbSrc || photo.src)}
                  alt={photo.alt}
                  loading="lazy"
                  onError={(e) => {
                    if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
                      e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
                    }
                  }}
                />
                <span>{String(index + 1).padStart(2, "0")}A</span>
                {selected && <i aria-label="Curated selection">SELECT</i>}
              </button>
            );
          })}
        </div>
        <p>PROOF ONLY · DO NOT CROP · {artistName.toUpperCase()} STUDIO</p>
      </div>
    </section>
  );
}

function ExhibitionView({
  artist,
  exhibition,
  exhibitionIndex,
  photos,
  dark,
  onBackToArtist,
}: {
  artist: ArtistProfile;
  exhibition: Exhibition;
  exhibitionIndex: number;
  photos: Photograph[];
  dark: boolean;
  onBackToArtist: () => void;
}) {
  const [layout, setLayout] = useState<"editorial" | "contact">("editorial");
  const [copiedExLink, setCopiedExLink] = useState(false);
  const coverPhoto = photos.find((p) => p.isCover) || photos[0];
  const exNumberStr = `EXHIBITION ${String(exhibitionIndex + 1).padStart(2, "0")} / ${exhibition.period}`;

  const handleCopyExhibitionLink = async () => {
    const shareUrl = `${window.location.origin}/?artist=${encodeURIComponent(
      artist.id,
    )}&exhibition=${encodeURIComponent(exhibition.id)}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedExLink(true);
    setTimeout(() => setCopiedExLink(false), 2200);
  };

  return (
    <motion.div
      key={`exhibition-${exhibition.id}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <section className="exhibition-intro" id="top">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={onBackToArtist} className="eyebrow" style={{ cursor: "pointer" }}>
              ← {artist.display_name.toUpperCase()}
            </button>
            <span className="eyebrow">/</span>
            <p className="eyebrow">{exNumberStr}</p>
          </div>

          <button
            onClick={handleCopyExhibitionLink}
            className="text-button"
            style={{
              fontSize: "9px",
              padding: "5px 10px",
              border: "1px solid var(--line)",
            }}
          >
            {copiedExLink ? "✓ EXHIBITION LINK COPIED" : "SHARE EXHIBITION LINK"}
          </button>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease }}
        >
          {exhibition.title}
        </motion.h1>
        <div className="intro-copy">
          <p>{exhibition.location}</p>
          <p>{exhibition.description}</p>
        </div>
      </section>

      <div className="view-switcher" role="group" aria-label="Exhibition layout">
        <p>VIEW AS</p>
        <button
          className={layout === "editorial" ? "active" : ""}
          onClick={() => setLayout("editorial")}
        >
          EDITORIAL VIEW
        </button>
        <span>/</span>
        <button
          className={layout === "contact" ? "active" : ""}
          onClick={() => setLayout("contact")}
        >
          CONTACT SHEET VIEW
        </button>

        {coverPhoto && (
          <StoryPosterExport
            dark={dark}
            photographerName={artist.display_name.toUpperCase()}
            exhibitionNumber={exNumberStr}
            exhibitionTitle={exhibition.title}
            exhibitionSubtitle={`— ${artist.display_name}`}
            dateRange={`${exhibition.location} · ${exhibition.period}`}
            coverImageSrc={getSafeImageSrc(coverPhoto.src)}
            coverPhotoTitle={coverPhoto.title}
            coverPhotoSpecs={coverPhoto.specs}
          />
        )}
      </div>

      <AnimatePresence mode="wait">
        {layout === "editorial" ? (
          <motion.div
            key="editorial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <EditorialGallery photos={photos} />
          </motion.div>
        ) : (
          <motion.div
            key="contact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ContactSheet photos={photos} artistName={artist.display_name} />
          </motion.div>
        )}
      </AnimatePresence>

      <footer>
        <p>{exhibition.title.toUpperCase()}</p>
        <p>© 2026 {artist.display_name.toUpperCase()}</p>
        <a href="#top">RETURN TO TOP ↑</a>
      </footer>
    </motion.div>
  );
}

export default function App() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialArtistParam = initialParams.get("artist");
  const initialExParam = initialParams.get("exhibition");

  const [dark, setDark] = useState(false);
  const [view, setView] = useState<"discover" | "artist" | "exhibition">(
    initialExParam && initialArtistParam
      ? "exhibition"
      : initialArtistParam
      ? "artist"
      : "discover",
  );
  const [selectedArtistId, setSelectedArtistId] = useState<string>(
    initialArtistParam || MARA_VENN_PROFILE.id,
  );
  const [activeExhibitionId, setActiveExhibitionId] = useState<string | null>(initialExParam);

  const [cloudProfiles, setCloudProfiles] = useState<ArtistProfile[]>([]);
  const [cloudExhibitions, setCloudExhibitions] = useState<Exhibition[]>([]);
  const [cloudPhotos, setCloudPhotos] = useState<Photograph[]>([]);
  const [user, setUser] = useState<any>(null);

  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const [lightboxList, setLightboxList] = useState<Photograph[] | null>(null);
  const [showInfo, setShowInfo] = useState(true);
  const touchStartXRef = useRef<number | null>(null);

  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<"photos" | "exhibitions">("photos");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  const [targetExhibitionId, setTargetExhibitionId] = useState<string>("");
  const [newExTitle, setNewExTitle] = useState("");
  const [newExLocation, setNewExLocation] = useState("TAIPEI, TW");
  const [newExPeriod, setNewExPeriod] = useState("2026");
  const [newExDesc, setNewExDesc] = useState("");
  const [creatingEx, setCreatingEx] = useState(false);

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editPhotoTitle, setEditPhotoTitle] = useState("");
  const [editPhotoSpecs, setEditPhotoSpecs] = useState("");
  const [editPhotoStoryNote, setEditPhotoStoryNote] = useState("");
  const [editPhotoExId, setEditPhotoExId] = useState<string>("");

  const showNotice = (msg: string) => {
    setStudioNotice(msg);
    setTimeout(() => {
      setStudioNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const syncUrl = (
    nextView: "discover" | "artist" | "exhibition",
    artistId?: string,
    exhibitionId?: string | null,
  ) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("artist");
    url.searchParams.delete("exhibition");

    if (nextView === "artist" && artistId) {
      url.searchParams.set("artist", artistId);
    } else if (nextView === "exhibition" && artistId) {
      url.searchParams.set("artist", artistId);
      if (exhibitionId) {
        url.searchParams.set("exhibition", exhibitionId);
      }
    }
    window.history.pushState({}, "", url.toString());
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const aId = params.get("artist");
      const eId = params.get("exhibition");
      if (aId && eId) {
        setSelectedArtistId(aId);
        setActiveExhibitionId(eId);
        setView("exhibition");
      } else if (aId) {
        setSelectedArtistId(aId);
        setActiveExhibitionId(null);
        setView("artist");
      } else {
        setView("discover");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const allArtists = useMemo(() => [...cloudProfiles, MARA_VENN_PROFILE], [cloudProfiles]);
  const allExhibitions = useMemo(
    () => [...cloudExhibitions, ...maraVennExhibitions],
    [cloudExhibitions],
  );
  const allPhotos = useMemo(() => [...cloudPhotos, ...maraVennPhotographs], [cloudPhotos]);

  const currentArtist = useMemo(
    () => allArtists.find((a) => a.id === selectedArtistId) || allArtists[0],
    [allArtists, selectedArtistId],
  );

  const currentArtistExhibitions = useMemo(
    () => allExhibitions.filter((e) => e.user_id === currentArtist.id),
    [allExhibitions, currentArtist.id],
  );

  const currentArtistPhotos = useMemo(
    () => allPhotos.filter((p) => p.user_id === currentArtist.id),
    [allPhotos, currentArtist.id],
  );

  const currentExhibition = useMemo(() => {
    const found = currentArtistExhibitions.find((e) => e.id === activeExhibitionId);
    if (found) return found;
    return {
      id: `default-${currentArtist.id}`,
      user_id: currentArtist.id,
      title: `${currentArtist.display_name} — Selected Works`,
      location: currentArtist.location.split("·")[0].trim(),
      period: "2026",
      description: currentArtist.bio,
      isVirtualDefault: true,
    };
  }, [currentArtistExhibitions, activeExhibitionId, currentArtist]);

  const currentExhibitionIndex = useMemo(() => {
    const idx = currentArtistExhibitions.findIndex((e) => e.id === currentExhibition.id);
    return idx >= 0 ? idx : 0;
  }, [currentArtistExhibitions, currentExhibition]);

  const exhibitionPhotos = useMemo(() => {
    if (currentExhibition.isVirtualDefault) {
      return currentArtistPhotos;
    }
    const assigned = currentArtistPhotos.filter((p) => p.exhibition_id === currentExhibition.id);
    if (currentExhibitionIndex === 0) {
      const unassigned = currentArtistPhotos.filter((p) => !p.exhibition_id);
      return [...assigned, ...unassigned];
    }
    return assigned;
  }, [currentArtistPhotos, currentExhibition, currentExhibitionIndex]);

  const activeLightboxPhotos = lightboxList ?? exhibitionPhotos;

  const myOwnExhibitions = useMemo(
    () => (user ? cloudExhibitions.filter((e) => e.user_id === user.id) : []),
    [cloudExhibitions, user],
  );

  const myOwnPhotos = useMemo(
    () => (user ? cloudPhotos.filter((p) => p.user_id === user.id) : []),
    [cloudPhotos, user],
  );

  const fetchAllCloudData = async () => {
    const [{ data: profilesData }, { data: exData }, { data: photosData }] = await Promise.all([
      supabase.from("profiles").select("*").order("updated_at", { ascending: false }),
      supabase.from("exhibitions").select("*").order("created_at", { ascending: true }),
      supabase.from("photographs").select("*").order("created_at", { ascending: false }),
    ]);

    if (profilesData) {
      setCloudProfiles(
        profilesData.map((p: any) => ({
          id: p.id,
          display_name: p.display_name || "Untitled Artist",
          location: p.location || "TAIPEI, TW · WORKING INTERNATIONALLY",
          bio: p.bio || "Independent visual archive and photographic studies.",
          specialty: p.specialty || "EDITORIAL · DOCUMENTARY",
          instagram_handle: p.instagram_handle || "",
          contact_email: p.contact_email || "",
          avatar_url: p.avatar_url,
          available_for_commissions: p.available_for_commissions ?? true,
        })),
      );
    }

    if (exData) {
      setCloudExhibitions(
        exData.map((e: any) => ({
          id: e.id,
          user_id: e.user_id,
          title: e.title,
          location: e.location || "TAIPEI, TW",
          period: e.period || "2026",
          description: e.description || "",
        })),
      );
    }

    if (photosData) {
      setCloudPhotos(
        photosData.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          exhibition_id: item.exhibition_id,
          src: item.src || "",
          thumbSrc: item.thumb_src || item.src || "",
          alt: item.alt || item.title || "Untitled Study",
          title: item.title || "Untitled Study",
          year: item.year || "2026",
          specs: item.specs || "DIGITAL ARCHIVE",
          credit: item.credit || "ARTIST ARCHIVE",
          storyNote: item.story_note || "",
          shootDateKey: item.shoot_date_key,
          isCover: item.is_cover ?? false,
          createdAt: item.created_at,
        })),
      );
    }
  };

  const ensureUserProfileAndDefaultExhibition = async (authUser: any) => {
    const defaultName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "Resident Photographer";

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        id: authUser.id,
        display_name: defaultName,
        location: "TAIPEI, TW · WORKING INTERNATIONALLY",
        bio: `${defaultName}'s curated digital photography archive and visual studies.`,
        specialty: "EDITORIAL · STREET · FINE ART",
        avatar_url: authUser.user_metadata?.avatar_url || null,
        available_for_commissions: true,
      });
    }

    const { data: existingEx } = await supabase
      .from("exhibitions")
      .select("id")
      .eq("user_id", authUser.id)
      .limit(1);

    if (!existingEx || existingEx.length === 0) {
      await supabase.from("exhibitions").insert({
        user_id: authUser.id,
        title: "Selected Works",
        location: "TAIPEI, TW",
        period: "2026",
        description: "Primary body of photographic studies and recent visual monographs.",
      });
    }

    await fetchAllCloudData();
  };

  useEffect(() => {
    fetchAllCloudData();

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        ensureUserProfileAndDefaultExhibition(u);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        ensureUserProfileAndDefaultExhibition(u);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setStudioOpen(false);
  };

  const handleSaveArtistProfile = async (updated: Partial<ArtistProfile>) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        ...updated,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    await fetchAllCloudData();
  };

  const handleCreateExhibition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newExTitle.trim()) return;
    setCreatingEx(true);

    const { data, error } = await supabase
      .from("exhibitions")
      .insert({
        user_id: user.id,
        title: newExTitle.trim(),
        location: newExLocation.trim() || "TAIPEI, TW",
        period: newExPeriod.trim() || "2026",
        description:
          newExDesc.trim() || "Curated photographic monograph and visual study.",
      })
      .select()
      .single();

    if (!error && data) {
      setTargetExhibitionId(data.id);
      setNewExTitle("");
      setNewExDesc("");
      await fetchAllCloudData();
      showNotice(`EXHIBITION "${data.title.toUpperCase()}" CREATED.`);
    } else if (error) {
      showNotice(`UNABLE TO CREATE EXHIBITION: ${error.message}`);
    }
    setCreatingEx(false);
  };

  const requestDeleteExhibition = (ex: Exhibition) => {
    if (!user) return;
    setConfirmDialog({
      eyebrow: "EXHIBITION ARCHIVE",
      title: `Remove "${ex.title}"?`,
      message:
        "This exhibition room will be removed. All photographs inside will remain safely in your archive.",
      confirmLabel: "REMOVE EXHIBITION",
      onConfirm: async () => {
        await supabase.from("photographs").update({ exhibition_id: null }).eq("exhibition_id", ex.id);
        const { error } = await supabase
          .from("exhibitions")
          .delete()
          .eq("id", ex.id)
          .eq("user_id", user.id);

        if (error) {
          showNotice(`DELETE FAILED: ${error.message}`);
          return;
        }
        if (targetExhibitionId === ex.id) {
          setTargetExhibitionId("");
        }
        await fetchAllCloudData();
        showNotice(`EXHIBITION "${ex.title.toUpperCase()}" REMOVED.`);
      },
    });
  };

  const startEditPhoto = (photo: Photograph) => {
    if (!photo.id) return;
    setEditingPhotoId(photo.id);
    setEditPhotoTitle(photo.title);
    setEditPhotoSpecs(photo.specs);
    setEditPhotoStoryNote(photo.storyNote || "");
    setEditPhotoExId(photo.exhibition_id || "");
  };

  const handleSavePhotoEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingPhotoId) return;

    const { error } = await supabase
      .from("photographs")
      .update({
        title: editPhotoTitle.trim() || "Untitled Study",
        specs: editPhotoSpecs.trim() || "DIGITAL ARCHIVE",
        story_note: editPhotoStoryNote.trim() || null,
        exhibition_id: editPhotoExId || null,
      })
      .eq("id", editingPhotoId)
      .eq("user_id", user.id);

    if (error) {
      showNotice(`UPDATE FAILED: ${error.message}`);
      return;
    }

    setEditingPhotoId(null);
    await fetchAllCloudData();
    showNotice("PHOTOGRAPH DETAILS UPDATED.");
  };

  const handleSetPhotoCover = async (photoId?: string) => {
    if (!user || !photoId) return;
    await supabase.from("photographs").update({ is_cover: false }).eq("user_id", user.id);
    await supabase
      .from("photographs")
      .update({ is_cover: true })
      .eq("id", photoId)
      .eq("user_id", user.id);
    await fetchAllCloudData();
    showNotice("GALLERY COVER UPDATED.");
  };

  const requestDeletePhoto = (photo: Photograph) => {
    if (!user || !photo.id) return;
    setConfirmDialog({
      eyebrow: "PERMANENT REMOVAL",
      title: `Delete "${photo.title}"?`,
      message:
        "This photograph and its archival cloud files will be permanently removed from your gallery.",
      confirmLabel: "DELETE PHOTOGRAPH",
      onConfirm: async () => {
        const pathsToRemove = [
          extractStoragePathFromUrl(photo.src),
          extractStoragePathFromUrl(photo.thumbSrc),
        ].filter((p): p is string => Boolean(p));

        if (pathsToRemove.length > 0) {
          await supabase.storage.from("portfolio-photos").remove(pathsToRemove);
        }

        const { error } = await supabase
          .from("photographs")
          .delete()
          .eq("id", photo.id)
          .eq("user_id", user.id);

        if (error) {
          showNotice(`DELETE FAILED: ${error.message}`);
          return;
        }

        await fetchAllCloudData();
        showNotice(`"${photo.title.toUpperCase()}" REMOVED FROM ARCHIVE.`);
      },
    });
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!user) {
      showNotice("PLEASE SIGN IN TO PUBLISH PHOTOGRAPHS TO YOUR GALLERY.");
      return;
    }

    const filesArray = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (filesArray.length === 0) return;

    setIsUploading(true);
    setUploadStatusText("READING EXIF & GENERATING DUAL SIZES...");
    let uploadedCount = 0;

    try {
      const parsedList = await parsePhotographs(filesArray);
      const myProfile = cloudProfiles.find((p) => p.id === user.id);
      const artistCredit = (myProfile?.display_name || "ARTIST ARCHIVE").toUpperCase();
      const chosenExId = targetExhibitionId || null;

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const meta = parsedList[i];
        setUploadStatusText(`OPTIMIZING & UPLOADING ${i + 1} / ${filesArray.length}...`);

        const { fullBlob, thumbBlob } = await generateDualSizeBlobs(file);
        const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const fullExt =
          fullBlob.type === "image/jpeg" ? "jpg" : file.name.split(".").pop() || "jpg";
        const fullPath = `${user.id}/${uid}.${fullExt}`;
        const thumbPath = `${user.id}/${uid}_thumb.jpg`;

        const [{ error: fullUploadErr }, { error: thumbUploadErr }] = await Promise.all([
          supabase.storage.from("portfolio-photos").upload(fullPath, fullBlob, {
            contentType: fullBlob.type || "image/jpeg",
          }),
          supabase.storage.from("portfolio-photos").upload(thumbPath, thumbBlob, {
            contentType: "image/jpeg",
          }),
        ]);

        if (fullUploadErr) {
          showNotice(`STORAGE UPLOAD ERROR: ${fullUploadErr.message}`);
          continue;
        }

        const {
          data: { publicUrl: fullPublicUrl },
        } = supabase.storage.from("portfolio-photos").getPublicUrl(fullPath);

        const thumbPublicUrl = thumbUploadErr
          ? fullPublicUrl
          : supabase.storage.from("portfolio-photos").getPublicUrl(thumbPath).data.publicUrl;

        const { error: dbErr } = await supabase.from("photographs").insert({
          user_id: user.id,
          exhibition_id: chosenExId,
          src: fullPublicUrl,
          thumb_src: thumbPublicUrl,
          alt: meta.alt,
          title: meta.title,
          year: meta.year,
          specs: meta.specs,
          credit: artistCredit,
          shoot_date_key: meta.shootDateKey,
          is_cover: myOwnPhotos.length === 0 && i === 0,
        });

        if (dbErr) {
          showNotice(`DATABASE ERROR: ${dbErr.message}`);
          continue;
        }

        uploadedCount++;
      }

      await fetchAllCloudData();
      if (uploadedCount > 0) {
        setSelectedArtistId(user.id);
        setView("artist");
        syncUrl("artist", user.id);
        setStudioOpen(false);
        showNotice(`PUBLISHED ${uploadedCount} PHOTOGRAPH${uploadedCount > 1 ? "S" : ""}.`);
      }
    } finally {
      setIsUploading(false);
      setUploadStatusText("");
    }
  };

  useEffect(() => {
    const openPhoto = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      setLightboxList(null);
      setActivePhoto(detail);
      setShowInfo(true);
    };
    window.addEventListener("open-photo", openPhoto);
    return () => window.removeEventListener("open-photo", openPhoto);
  }, []);

  const closeLightbox = () => {
    setActivePhoto(null);
    setLightboxList(null);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
        return;
      }

      if (confirmDialog && event.key === "Escape" && !confirmBusy) {
        setConfirmDialog(null);
        return;
      }

      if (searchOpen && event.key === "Escape") {
        setSearchOpen(false);
        return;
      }

      if (studioOpen && event.key === "Escape" && !confirmDialog) {
        setStudioOpen(false);
        return;
      }

      if (activePhoto === null || activeLightboxPhotos.length === 0) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowRight")
        setActivePhoto((prev) =>
          prev === null ? null : (prev + 1) % activeLightboxPhotos.length,
        );
      if (event.key === "ArrowLeft")
        setActivePhoto((prev) =>
          prev === null
            ? null
            : (prev - 1 + activeLightboxPhotos.length) % activeLightboxPhotos.length,
        );
      if (event.key.toLowerCase() === "i") setShowInfo((prev) => !prev);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePhoto, activeLightboxPhotos.length, studioOpen, searchOpen, confirmDialog, confirmBusy]);

  const currentLightboxPhoto = activePhoto === null ? null : activeLightboxPhotos[activePhoto];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchedArtists: [], matchedPhotos: [] };
    const matchedArtists = allArtists.filter(
      (a) =>
        a.display_name.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        a.specialty.toLowerCase().includes(q),
    );
    const matchedPhotos = allPhotos.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.specs.toLowerCase().includes(q) ||
        p.credit.toLowerCase().includes(q),
    );
    return { matchedArtists, matchedPhotos };
  }, [searchQuery, allArtists, allPhotos]);

  return (
    <div
      className={dark ? "site darkroom" : "site"}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
          handleUploadFiles(e.dataTransfer.files);
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleUploadFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* Gallery Notification Toast */}
      <AnimatePresence>
        {studioNotice && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease }}
            className="studio-toast"
          >
            <span>{studioNotice}</span>
            <button
              onClick={() => setStudioNotice(null)}
              style={{ cursor: "pointer", opacity: 0.7 }}
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag & Drop Archival Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="dropzone-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragLeave={() => setIsDragging(false)}
          >
            <div className="dropzone-box">
              <p className="eyebrow">HD ARCHIVAL OPTIMIZATION & EXIF SYNC</p>
              <h2>Drop photographs to publish to your gallery</h2>
              <p>Optimized to 2400px archival quality with fast 800px previews.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation Bar */}
      <header className="topbar">
        <button
          className="wordmark"
          onClick={() => {
            setView("discover");
            syncUrl("discover");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          STUDIO FOLIO
        </button>

        <nav className="top-actions" aria-label="Primary navigation">
          <button
            className={`text-button ${view === "discover" ? "active-link" : ""}`}
            onClick={() => {
              setView("discover");
              syncUrl("discover");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            FEED
          </button>

          {user && (
            <button
              className={`text-button ${view !== "discover" && selectedArtistId === user.id ? "active-link" : ""}`}
              onClick={() => {
                setSelectedArtistId(user.id);
                setView("artist");
                syncUrl("artist", user.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              GALLERY
            </button>
          )}

          <button
            className="text-button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search artists and works"
          >
            SEARCH
          </button>

          <button
            className="text-button theme-button"
            onClick={() => setDark((prev) => !prev)}
            aria-label={`Switch to ${dark ? "daylight" : "darkroom"} theme`}
          >
            <i className="theme-mark" aria-hidden="true" />
            <span>{dark ? "DAYLIGHT" : "DARKROOM"}</span>
          </button>

          {user ? (
            <>
              <button className="studio-button" onClick={() => setStudioOpen(true)}>
                STUDIO ({myOwnPhotos.length})
              </button>
              <button className="text-button hide-mobile" onClick={handleLogout} title={user.email}>
                SIGN OUT
              </button>
            </>
          ) : (
            <button className="studio-button" onClick={handleGoogleLogin}>
              SIGN IN
            </button>
          )}
        </nav>
      </header>

      <main>
        <AnimatePresence mode="wait">
          {view === "discover" && (
            <DiscoverView
              artists={allArtists}
              allPhotos={allPhotos}
              allExhibitions={allExhibitions}
              currentUserId={user?.id}
              onSelectArtist={(artistId) => {
                setSelectedArtistId(artistId);
                setView("artist");
                syncUrl("artist", artistId);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onOpenExhibitionDirect={(artistId, exhibitionId) => {
                setSelectedArtistId(artistId);
                setActiveExhibitionId(exhibitionId);
                setView("exhibition");
                syncUrl("exhibition", artistId, exhibitionId);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onOpenFeedLightbox={(feedList, index) => {
                setLightboxList(feedList);
                setActivePhoto(index);
                setShowInfo(true);
              }}
              onOpenStudioOrLogin={() => {
                if (user) {
                  setSelectedArtistId(user.id);
                  setView("artist");
                  syncUrl("artist", user.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  handleGoogleLogin();
                }
              }}
            />
          )}

          {view === "artist" && (
            <ArtistGalleryProfileView
              artist={currentArtist}
              artistPhotos={currentArtistPhotos}
              artistExhibitions={currentArtistExhibitions}
              dark={dark}
              isOwnProfile={Boolean(user && user.id === currentArtist.id)}
              onOpenExhibition={(ex) => {
                setActiveExhibitionId(ex.id);
                setView("exhibition");
                syncUrl("exhibition", currentArtist.id, ex.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onOpenStudio={() => setStudioOpen(true)}
              onSaveProfile={handleSaveArtistProfile}
              onBackToDiscover={() => {
                setView("discover");
                syncUrl("discover");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

          {view === "exhibition" && (
            <ExhibitionView
              artist={currentArtist}
              exhibition={currentExhibition}
              exhibitionIndex={currentExhibitionIndex}
              photos={exhibitionPhotos}
              dark={dark}
              onBackToArtist={() => {
                setView("artist");
                syncUrl("artist", currentArtist.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}
        </AnimatePresence>
      </main>

      {/* ==================== Global Archive Search (CMD+K) ==================== */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="studio-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSearchOpen(false)}
          >
            <motion.aside
              className="studio-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.45, ease }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="studio-header">
                <div>
                  <p className="eyebrow">ARCHIVE INDEX · CMD+K</p>
                  <h2>Search Artists & Works</h2>
                </div>
                <button className="studio-close" onClick={() => setSearchOpen(false)}>
                  CLOSE [ESC]
                </button>
              </div>

              <div className="studio-body">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type artist name, camera, film, or title..."
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "1px solid var(--line)",
                    background: "transparent",
                    color: "inherit",
                    fontSize: "14px",
                    marginBottom: "24px",
                  }}
                />

                {searchQuery.trim() && (
                  <div style={{ display: "grid", gap: "24px" }}>
                    <div>
                      <p className="eyebrow" style={{ marginBottom: "10px" }}>
                        ARTISTS ({searchResults.matchedArtists.length})
                      </p>
                      {searchResults.matchedArtists.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setSelectedArtistId(a.id);
                            setView("artist");
                            syncUrl("artist", a.id);
                            setSearchOpen(false);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 0",
                            borderBottom: "1px solid var(--line)",
                            cursor: "pointer",
                          }}
                        >
                          <strong>{a.display_name}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                            {a.location} · {a.specialty}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div>
                      <p className="eyebrow" style={{ marginBottom: "10px" }}>
                        PHOTOGRAPHS ({searchResults.matchedPhotos.length})
                      </p>
                      {searchResults.matchedPhotos.map((p, i) => (
                        <button
                          key={p.id || i}
                          onClick={() => {
                            if (p.user_id) {
                              setSelectedArtistId(p.user_id);
                              setView("artist");
                              syncUrl("artist", p.user_id);
                            }
                            setSearchOpen(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 0",
                            borderBottom: "1px solid var(--line)",
                            cursor: "pointer",
                          }}
                        >
                          <img
                            src={getSafeImageSrc(p.thumbSrc || p.src)}
                            alt={p.title}
                            style={{ width: "48px", height: "48px", objectFit: "cover" }}
                            onError={(e) => {
                              if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
                                e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
                              }
                            }}
                          />
                          <div>
                            <strong>{p.title}</strong>
                            <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                              {p.credit} · {p.specs}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== Curator Darkroom Workbench (STUDIO) ==================== */}
      <AnimatePresence>
        {studioOpen && user && (
          <motion.div
            className="studio-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStudioOpen(false)}
          >
            <motion.aside
              className="studio-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.45, ease }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="studio-header">
                <div>
                  <p className="eyebrow">CURATOR WORKBENCH</p>
                  <h2>Your Darkroom Studio</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    className="studio-close show-mobile-only"
                    onClick={handleLogout}
                    style={{ opacity: 0.65 }}
                  >
                    SIGN OUT
                  </button>
                  <button className="studio-close" onClick={() => setStudioOpen(false)}>
                    CLOSE [ESC]
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "18px",
                  padding: "12px 24px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                }}
              >
                <button
                  onClick={() => setStudioTab("photos")}
                  style={{
                    opacity: studioTab === "photos" ? 1 : 0.45,
                    textDecoration: studioTab === "photos" ? "underline" : "none",
                    cursor: "pointer",
                  }}
                >
                  01 / PHOTOGRAPHS ({myOwnPhotos.length})
                </button>
                <button
                  onClick={() => setStudioTab("exhibitions")}
                  style={{
                    opacity: studioTab === "exhibitions" ? 1 : 0.45,
                    textDecoration: studioTab === "exhibitions" ? "underline" : "none",
                    cursor: "pointer",
                  }}
                >
                  02 / EXHIBITIONS ({myOwnExhibitions.length})
                </button>
              </div>

              <div className="studio-body">
                {studioTab === "photos" ? (
                  <>
                    <label
                      style={{
                        display: "grid",
                        gap: "6px",
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        marginBottom: "14px",
                      }}
                    >
                      TARGET EXHIBITION ROOM (OPTIONAL):
                      <select
                        value={targetExhibitionId}
                        onChange={(e) => setTargetExhibitionId(e.target.value)}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid var(--line)",
                          background: "var(--paper)",
                          color: "var(--ink)",
                          fontSize: "12px",
                        }}
                      >
                        <option value="">UNASSIGNED / GENERAL ARCHIVE</option>
                        {myOwnExhibitions.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.title} ({ex.period})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div
                      className="studio-drop-area"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <p className="eyebrow">HD 2400PX + 800PX THUMBNAIL · EXIF SYNC</p>
                      <p className="drop-title">
                        {isUploading
                          ? uploadStatusText || "UPLOADING..."
                          : "+ Select or Drop Photographs to Publish"}
                      </p>
                      <p className="drop-sub">
                        Auto-generates 2400px archival master & 800px fast preview.
                      </p>
                    </div>

                    <div className="studio-list">
                      <div className="studio-list-head">
                        <span>YOUR ARCHIVE ({myOwnPhotos.length} WORKS)</span>
                      </div>

                      {myOwnPhotos.length === 0 ? (
                        <p style={{ fontSize: "12px", color: "var(--muted)", padding: "18px 0" }}>
                          No photographs uploaded yet. Tap above to add your first works.
                        </p>
                      ) : (
                        myOwnPhotos.map((photo, idx) => {
                          const assignedEx = myOwnExhibitions.find(
                            (e) => e.id === photo.exhibition_id,
                          );
                          const isEditingThis = editingPhotoId === photo.id;

                          return (
                            <div
                              className="studio-item"
                              key={photo.id || idx}
                              style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <img
                                  src={getSafeImageSrc(photo.thumbSrc || photo.src)}
                                  alt={photo.alt}
                                  onError={(e) => {
                                    if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
                                      e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
                                    }
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <p className="studio-item-title">
                                    {photo.title}{" "}
                                    {photo.isCover && (
                                      <span
                                        style={{
                                          fontSize: "8px",
                                          padding: "2px 6px",
                                          border: "1px solid var(--line)",
                                          marginLeft: "6px",
                                        }}
                                      >
                                        COVER
                                      </span>
                                    )}
                                  </p>
                                  <p className="studio-item-specs">
                                    {assignedEx ? `[${assignedEx.title}] · ` : "[UNASSIGNED] · "}
                                    {photo.specs}
                                  </p>
                                </div>
                              </div>

                              {isEditingThis ? (
                                <form
                                  onSubmit={handleSavePhotoEdit}
                                  style={{
                                    display: "grid",
                                    gap: "8px",
                                    padding: "10px",
                                    border: "1px solid var(--line)",
                                  }}
                                >
                                  <input
                                    value={editPhotoTitle}
                                    onChange={(e) => setEditPhotoTitle(e.target.value)}
                                    placeholder="Artwork title"
                                    style={{
                                      padding: "6px 8px",
                                      border: "1px solid var(--line)",
                                      background: "transparent",
                                      color: "inherit",
                                      fontSize: "12px",
                                    }}
                                  />
                                  <input
                                    value={editPhotoSpecs}
                                    onChange={(e) => setEditPhotoSpecs(e.target.value)}
                                    placeholder="Camera & lens specs"
                                    style={{
                                      padding: "6px 8px",
                                      border: "1px solid var(--line)",
                                      background: "transparent",
                                      color: "inherit",
                                      fontSize: "11px",
                                    }}
                                  />
                                  <textarea
                                    rows={2}
                                    value={editPhotoStoryNote}
                                    onChange={(e) => setEditPhotoStoryNote(e.target.value)}
                                    placeholder="Curator's note / backstory (optional)..."
                                    style={{
                                      padding: "6px 8px",
                                      border: "1px solid var(--line)",
                                      background: "transparent",
                                      color: "inherit",
                                      fontSize: "11px",
                                      fontFamily: "inherit",
                                    }}
                                  />
                                  <select
                                    value={editPhotoExId}
                                    onChange={(e) => setEditPhotoExId(e.target.value)}
                                    style={{
                                      padding: "6px 8px",
                                      border: "1px solid var(--line)",
                                      background: "var(--paper)",
                                      color: "var(--ink)",
                                      fontSize: "11px",
                                    }}
                                  >
                                    <option value="">Exhibition: Unassigned / General Archive</option>
                                    {myOwnExhibitions.map((ex) => (
                                      <option key={ex.id} value={ex.id}>
                                        Exhibition: {ex.title}
                                      </option>
                                    ))}
                                  </select>
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <button type="submit" className="studio-button" style={{ padding: "5px 10px" }}>
                                      SAVE
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPhotoId(null)}
                                      className="text-button"
                                    >
                                      CANCEL
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <div style={{ display: "flex", gap: "10px", fontSize: "9px", letterSpacing: "0.12em" }}>
                                  <button onClick={() => startEditPhoto(photo)} style={{ cursor: "pointer" }}>
                                    EDIT
                                  </button>
                                  <span>·</span>
                                  {!photo.isCover && (
                                    <>
                                      <button
                                        onClick={() => handleSetPhotoCover(photo.id)}
                                        style={{ cursor: "pointer" }}
                                      >
                                        SET AS COVER
                                      </button>
                                      <span>·</span>
                                    </>
                                  )}
                                  <button
                                    onClick={() => requestDeletePhoto(photo)}
                                    style={{ cursor: "pointer", color: "#bd372d" }}
                                  >
                                    DELETE
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: "grid", gap: "24px" }}>
                    <form
                      onSubmit={handleCreateExhibition}
                      style={{
                        padding: "16px",
                        border: "1px solid var(--line)",
                        display: "grid",
                        gap: "10px",
                      }}
                    >
                      <p className="eyebrow">CREATE NEW EXHIBITION ROOM</p>
                      <input
                        required
                        value={newExTitle}
                        onChange={(e) => setNewExTitle(e.target.value)}
                        placeholder="Exhibition title (e.g. Night Trains)"
                        style={{
                          padding: "8px 10px",
                          border: "1px solid var(--line)",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "13px",
                        }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <input
                          value={newExLocation}
                          onChange={(e) => setNewExLocation(e.target.value)}
                          placeholder="Location (e.g. TOKYO, JP)"
                          style={{
                            padding: "8px 10px",
                            border: "1px solid var(--line)",
                            background: "transparent",
                            color: "inherit",
                            fontSize: "12px",
                          }}
                        />
                        <input
                          value={newExPeriod}
                          onChange={(e) => setNewExPeriod(e.target.value)}
                          placeholder="Period (e.g. 2025—2026)"
                          style={{
                            padding: "8px 10px",
                            border: "1px solid var(--line)",
                            background: "transparent",
                            color: "inherit",
                            fontSize: "12px",
                          }}
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={newExDesc}
                        onChange={(e) => setNewExDesc(e.target.value)}
                        placeholder="Curatorial statement for this series..."
                        style={{
                          padding: "8px 10px",
                          border: "1px solid var(--line)",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "12px",
                          fontFamily: "inherit",
                        }}
                      />
                      <button type="submit" disabled={creatingEx} className="studio-button">
                        {creatingEx ? "CREATING..." : "+ CREATE EXHIBITION"}
                      </button>
                    </form>

                    <div className="studio-list">
                      <div className="studio-list-head">
                        <span>YOUR EXHIBITIONS ({myOwnExhibitions.length})</span>
                      </div>
                      {myOwnExhibitions.map((ex, i) => {
                        const count = myOwnPhotos.filter((p) => p.exhibition_id === ex.id).length;
                        return (
                          <div
                            key={ex.id}
                            className="studio-item"
                            style={{ justifyContent: "space-between" }}
                          >
                            <div>
                              <p className="studio-item-title">
                                {String(i + 1).padStart(2, "0")}. {ex.title}
                              </p>
                              <p className="studio-item-specs">
                                {ex.location} · {ex.period} · {count} FRAMES
                              </p>
                            </div>
                            {myOwnExhibitions.length > 1 && (
                              <button
                                onClick={() => requestDeleteExhibition(ex)}
                                style={{
                                  fontSize: "9px",
                                  letterSpacing: "0.12em",
                                  color: "#bd372d",
                                  cursor: "pointer",
                                }}
                              >
                                DELETE
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== Minimalist Editorial Confirmation Dialog ==================== */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => !confirmBusy && setConfirmDialog(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 130,
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(3px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.3, ease }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(420px, 100%)",
                background: "var(--paper)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                padding: "32px 28px",
              }}
            >
              <p className="eyebrow" style={{ color: "#bd372d" }}>
                {confirmDialog.eyebrow}
              </p>
              <h3
                id="confirm-dialog-title"
                style={{
                  marginTop: "12px",
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: "30px",
                  fontWeight: 400,
                  lineHeight: 1.12,
                }}
              >
                {confirmDialog.title}
              </h3>
              <p
                style={{
                  marginTop: "14px",
                  color: "var(--muted)",
                  fontSize: "12px",
                  lineHeight: 1.65,
                }}
              >
                {confirmDialog.message}
              </p>
              <div
                style={{
                  marginTop: "28px",
                  paddingTop: "18px",
                  borderTop: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "14px",
                }}
              >
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={() => setConfirmDialog(null)}
                  className="text-button"
                  style={{ padding: "9px 14px", opacity: confirmBusy ? 0.5 : 1 }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={async () => {
                    setConfirmBusy(true);
                    try {
                      await confirmDialog.onConfirm();
                    } finally {
                      setConfirmBusy(false);
                      setConfirmDialog(null);
                    }
                  }}
                  style={{
                    padding: "9px 16px",
                    border: "1px solid #bd372d",
                    background: "#bd372d",
                    color: "#ffffff",
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "10px",
                    fontWeight: 500,
                    letterSpacing: "0.13em",
                    cursor: confirmBusy ? "wait" : "pointer",
                  }}
                >
                  {confirmBusy ? "REMOVING..." : confirmDialog.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== Fullscreen Lightbox (with Mobile Touch Swipe) ==================== */}
      <AnimatePresence>
        {currentLightboxPhoto && activePhoto !== null && (
          <motion.div
            className="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            onClick={closeLightbox}
            onTouchStart={(e) => {
              touchStartXRef.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartXRef.current === null) return;
              const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
              touchStartXRef.current = null;
              if (Math.abs(deltaX) > 48) {
                if (deltaX < 0) {
                  setActivePhoto((activePhoto + 1) % activeLightboxPhotos.length);
                } else {
                  setActivePhoto(
                    (activePhoto - 1 + activeLightboxPhotos.length) % activeLightboxPhotos.length,
                  );
                }
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={currentLightboxPhoto.title}
          >
            <div className="lightbox-bar" onClick={(event) => event.stopPropagation()}>
              <span>
                {String(activePhoto + 1).padStart(2, "0")} /{" "}
                {String(activeLightboxPhotos.length).padStart(2, "0")}
              </span>
              <div className="lightbox-controls">
                <button onClick={() => setShowInfo((prev) => !prev)}>
                  {showInfo ? "HIDE INFO [I]" : "SHOW INFO [I]"}
                </button>
                <button onClick={closeLightbox}>CLOSE [ESC]</button>
              </div>
            </div>

            <div className="lightbox-stage" onClick={(event) => event.stopPropagation()}>
              <button
                className="lightbox-nav prev"
                onClick={() =>
                  setActivePhoto(
                    (activePhoto - 1 + activeLightboxPhotos.length) % activeLightboxPhotos.length,
                  )
                }
                aria-label="Previous photograph"
              >
                ←
              </button>

              <motion.img
                key={currentLightboxPhoto.src}
                src={getSafeImageSrc(currentLightboxPhoto.src)}
                alt={currentLightboxPhoto.alt}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, ease }}
                onError={(e) => {
                  if (e.currentTarget.src !== FALLBACK_GALLERY_IMAGE) {
                    e.currentTarget.src = FALLBACK_GALLERY_IMAGE;
                  }
                }}
              />

              <button
                className="lightbox-nav next"
                onClick={() => setActivePhoto((activePhoto + 1) % activeLightboxPhotos.length)}
                aria-label="Next photograph"
              >
                →
              </button>
            </div>

            {showInfo && (
              <div className="lightbox-caption" onClick={(event) => event.stopPropagation()}>
                <div>
                  <strong>{currentLightboxPhoto.title}</strong>
                  <span>{currentLightboxPhoto.year}</span>
                  {currentLightboxPhoto.storyNote && (
                    <p className="lightbox-story-note">{currentLightboxPhoto.storyNote}</p>
                  )}
                </div>
                <p>
                  {currentLightboxPhoto.credit} · {currentLightboxPhoto.specs}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}