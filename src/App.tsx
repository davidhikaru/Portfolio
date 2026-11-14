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
  alt: string;
  title: string;
  year: string;
  specs: string;
  credit: string;
  shootDateKey?: string;
  isCover?: boolean;
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

// 瀏覽器端高畫質圖片壓縮工具（長邊上限 2400px，保留展覽級畫質並大幅節省空間）
async function compressImageForGallery(file: File, maxDimension = 2400, quality = 0.88): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width <= maxDimension && height <= maxDimension && file.size <= 1.2 * 1024 * 1024) {
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
}

const MARA_VENN_PROFILE: ArtistProfile = {
  id: "featured-mara-venn",
  display_name: "Mara Venn",
  location: "REYKJAVÍK, IS · WORKING INTERNATIONALLY",
  bio: "Mara Venn photographs the quiet architecture of distance—where weather, memory, and built form briefly meet.",
  specialty: "EDITORIAL · LANDSCAPE · ARCHITECTURE",
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
    alt: "A solitary person standing at the edge of a pale, misty sea",
    title: "The Measure of Distance",
    year: "2024",
    specs: "LEICA M6 · 35MM F/1.4 · PORTRA 400",
    credit: "MARA VENN",
    isCover: true,
  },
  {
    id: "mv-2",
    user_id: "featured-mara-venn",
    exhibition_id: "mv-ex-1",
    src: "https://images.unsplash.com/photo-1767854507654-5852c55b8d2f?auto=format&fit=crop&w=1400&q=88",
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
        thumb: p.src,
        exIdx: foundExIdx >= 0 ? foundExIdx : 0,
      });
    }
  });

  const fallbackThumb =
    artistPhotos[0]?.src ||
    "https://images.unsplash.com/photo-1533057917386-1c1477353a3c?auto=format&fit=crop&w=800&q=80";

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
        <img src={photo.src} alt={photo.alt} loading="lazy" />
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
                    <img src={day.thumbnail} alt="" />
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

/* ==================== 藝廊探索大廳（首頁） ==================== */
function DiscoverView({
  artists,
  allPhotos,
  onSelectArtist,
  currentUserId,
  onOpenStudioOrLogin,
}: {
  artists: ArtistProfile[];
  allPhotos: Photograph[];
  onSelectArtist: (artistId: string) => void;
  currentUserId?: string;
  onOpenStudioOrLogin: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "commissions">("all");

  const filteredArtists = useMemo(() => {
    if (filter === "commissions") {
      return artists.filter((a) => a.available_for_commissions);
    }
    return artists;
  }, [artists, filter]);

  return (
    <motion.div
      key="discover"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <section className="profile-hero" id="top">
        <div className="profile-kicker">
          <p className="eyebrow">CURATED PHOTOGRAPHY ARCHIVE</p>
          <p>{artists.length} RESIDENT ARTISTS · EXHIBITION DIRECTORY</p>
        </div>
        <div className="profile-name">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease }}
          >
            Studio Folio
          </motion.h1>
          <button
            onClick={onOpenStudioOrLogin}
            className="availability"
            style={{ cursor: "pointer", background: "none", border: "none", color: "inherit" }}
          >
            <span />
            {currentUserId ? "ENTER MY GALLERY →" : "OPEN YOUR ARTIST GALLERY →"}
          </button>
        </div>
        <div className="profile-statement">
          <p>
            An independent digital exhibition space where photographers curate bodies of work,
            document shutter activity, and present visual studies.
          </p>
          <p className="profile-meta">SELECT AN ARTIST BELOW TO ENTER THEIR PRIVATE GALLERY</p>
        </div>
      </section>

      <section className="exhibitions-index" id="artists-directory">
        <div className="section-heading index-heading">
          <div>
            <p className="eyebrow">ARTIST DIRECTORY</p>
            <h2>Resident galleries.</h2>
          </div>
          <div style={{ display: "flex", gap: "14px", fontSize: "11px", letterSpacing: "0.14em" }}>
            <button
              onClick={() => setFilter("all")}
              style={{
                opacity: filter === "all" ? 1 : 0.45,
                textDecoration: filter === "all" ? "underline" : "none",
                cursor: "pointer",
              }}
            >
              ALL ARTISTS ({artists.length})
            </button>
            <span>/</span>
            <button
              onClick={() => setFilter("commissions")}
              style={{
                opacity: filter === "commissions" ? 1 : 0.45,
                textDecoration: filter === "commissions" ? "underline" : "none",
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
            const cover =
              artistWorks.find((p) => p.isCover) ||
              artistWorks[0] || {
                src: "https://images.unsplash.com/photo-1693814610769-66238d08422a?auto=format&fit=crop&w=1800&q=88",
                alt: artist.display_name,
              };

            return (
              <article className="exhibition-row" key={artist.id}>
                <button
                  onClick={() => onSelectArtist(artist.id)}
                  aria-label={`Enter ${artist.display_name}'s gallery`}
                >
                  <div className="exhibition-cover">
                    <img src={cover.src} alt={artist.display_name} />
                    <span>
                      ENTER GALLERY ({artistWorks.length} {artistWorks.length === 1 ? "WORK" : "WORKS"}) ↗
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

      <footer>
        <p>STUDIO FOLIO / DIGITAL GALLERY</p>
        <p>© 2026 CURATED ARCHIVE</p>
        <a href="#top">RETURN TO TOP ↑</a>
      </footer>
    </motion.div>
  );
}

/* ==================== 藝術家個人畫廊 ==================== */
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
  const [editAvailable, setEditAvailable] = useState(artist.available_for_commissions);

  useEffect(() => {
    setEditName(artist.display_name);
    setEditLocation(artist.location);
    setEditBio(artist.bio);
    setEditSpecialty(artist.specialty);
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
    await onSaveProfile({
      display_name: editName.trim() || artist.display_name,
      location: editLocation.trim() || artist.location,
      bio: editBio.trim() || artist.bio,
      specialty: editSpecialty.trim() || artist.specialty,
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
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              onClick={onBackToDiscover}
              style={{
                fontSize: "11px",
                letterSpacing: "0.14em",
                opacity: 0.65,
                cursor: "pointer",
              }}
            >
              ← ALL ARTISTS
            </button>
            <span>/</span>
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

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <div className="availability" style={{ opacity: artist.available_for_commissions ? 1 : 0.45 }}>
              <span style={{ background: artist.available_for_commissions ? undefined : "#888" }} />
              {artist.available_for_commissions
                ? "AVAILABLE FOR COMMISSIONS"
                : "ARCHIVE / NOT TAKING COMMISSIONS"}
            </div>

            <button
              onClick={handleCopyShareLink}
              style={{
                fontSize: "10px",
                letterSpacing: "0.16em",
                padding: "5px 10px",
                border: "1px solid currentColor",
                cursor: "pointer",
                opacity: 0.85,
              }}
            >
              {copiedLink ? "✓ LINK COPIED" : "SHARE GALLERY LINK"}
            </button>

            {isOwnProfile && (
              <button
                onClick={() => setIsEditing((v) => !v)}
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.16em",
                  padding: "5px 10px",
                  border: "1px solid currentColor",
                  cursor: "pointer",
                }}
              >
                {isEditing ? "CANCEL EDIT" : "EDIT GALLERY PROFILE"}
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <form
            onSubmit={handleSave}
            style={{
              marginTop: "24px",
              padding: "20px",
              border: "1px solid currentColor",
              display: "grid",
              gap: "12px",
              maxWidth: "620px",
            }}
          >
            <p className="eyebrow">CUSTOMIZE YOUR ARTIST GALLERY</p>
            <label style={{ display: "grid", gap: "4px", fontSize: "11px", letterSpacing: "0.1em" }}>
              ARTIST / STUDIO NAME
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid currentColor",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "14px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "11px", letterSpacing: "0.1em" }}>
              LOCATION & BASE
              <input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid currentColor",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "13px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "11px", letterSpacing: "0.1em" }}>
              ARTIST STATEMENT / BIO
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid currentColor",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", fontSize: "11px", letterSpacing: "0.1em" }}>
              SPECIALTIES (E.G. EDITORIAL · STREET · ANALOG)
              <input
                value={editSpecialty}
                onChange={(e) => setEditSpecialty(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid currentColor",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "13px",
                }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={editAvailable}
                onChange={(e) => setEditAvailable(e.target.checked)}
              />
              SHOW &ldquo;AVAILABLE FOR COMMISSIONS&rdquo; STATUS
            </label>
            <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "9px 18px",
                  border: "1px solid currentColor",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  cursor: "pointer",
                }}
              >
                {saving ? "SAVING..." : "SAVE GALLERY PROFILE"}
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-statement">
            <p>{artist.bio}</p>
            <p className="profile-meta">{artist.specialty}</p>
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

              const cover =
                mergedPhotos.find((p) => p.isCover) ||
                mergedPhotos[0] || {
                  src: "https://images.unsplash.com/photo-1693814610769-66238d08422a?auto=format&fit=crop&w=1800&q=88",
                  alt: ex.title,
                };

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
                      <img src={cover.src} alt={ex.title} />
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
                padding: "48px 24px",
                border: "1px dashed currentColor",
                opacity: 0.75,
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "13px", marginBottom: "14px" }}>
                {isOwnProfile
                  ? "Your gallery wall is currently empty. Create an exhibition or upload your first photographs."
                  : `${artist.display_name} has not published exhibitions yet.`}
              </p>
              {isOwnProfile && (
                <button
                  onClick={onOpenStudio}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid currentColor",
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    cursor: "pointer",
                  }}
                >
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

/* ==================== 展覽內部排版 ==================== */
function EditorialGallery({ photos }: { photos: Photograph[] }) {
  if (photos.length === 0) {
    return (
      <div style={{ padding: "60px 6vw", textAlign: "center", opacity: 0.65 }}>
        <p style={{ fontSize: "13px", letterSpacing: "0.1em" }}>
          THIS EXHIBITION ROOM CURRENTLY HAS NO PHOTOGRAPHS ASSIGNED.
        </p>
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
                <img src={photo.src} alt={photo.alt} loading="lazy" />
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
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={onBackToArtist}
              style={{ fontSize: "11px", letterSpacing: "0.14em", opacity: 0.65, cursor: "pointer" }}
            >
              ← {artist.display_name.toUpperCase()}
            </button>
            <span>/</span>
            <p className="eyebrow" style={{ margin: 0 }}>
              {exNumberStr}
            </p>
          </div>

          <button
            onClick={handleCopyExhibitionLink}
            style={{
              fontSize: "10px",
              letterSpacing: "0.14em",
              padding: "4px 9px",
              border: "1px solid currentColor",
              cursor: "pointer",
              opacity: 0.8,
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
            exhibitionNumber={exNumberStr}
            exhibitionTitle={exhibition.title}
            exhibitionSubtitle={`— ${artist.display_name}`}
            dateRange={`${exhibition.location} · ${exhibition.period}`}
            coverImageSrc={coverPhoto.src}
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
  const [showInfo, setShowInfo] = useState(true);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<"photos" | "exhibitions">("photos");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [targetExhibitionId, setTargetExhibitionId] = useState<string>("");
  const [newExTitle, setNewExTitle] = useState("");
  const [newExLocation, setNewExLocation] = useState("TAIPEI, TW");
  const [newExPeriod, setNewExPeriod] = useState("2026");
  const [newExDesc, setNewExDesc] = useState("");
  const [creatingEx, setCreatingEx] = useState(false);

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editPhotoTitle, setEditPhotoTitle] = useState("");
  const [editPhotoSpecs, setEditPhotoSpecs] = useState("");
  const [editPhotoExId, setEditPhotoExId] = useState<string>("");

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

  const myOwnExhibitions = useMemo(
    () => (user ? cloudExhibitions.filter((e) => e.user_id === user.id) : []),
    [cloudExhibitions, user],
  );

  const myOwnPhotos = useMemo(
    () => (user ? cloudPhotos.filter((p) => p.user_id === user.id) : []),
    [cloudPhotos, user],
  );

  useEffect(() => {
    if (myOwnExhibitions.length > 0 && !targetExhibitionId) {
      setTargetExhibitionId(myOwnExhibitions[0].id);
    }
  }, [myOwnExhibitions, targetExhibitionId]);

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
          src: item.src,
          alt: item.alt || item.title,
          title: item.title,
          year: item.year || "2026",
          specs: item.specs || "DIGITAL ARCHIVE",
          credit: item.credit || "ARTIST ARCHIVE",
          shootDateKey: item.shoot_date_key,
          isCover: item.is_cover ?? false,
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
    }
    setCreatingEx(false);
  };

  const handleDeleteExhibition = async (exId: string) => {
    if (!user) return;
    if (!window.confirm("確定要刪除此展覽嗎？（展覽內的照片會自動保留在你的作品庫中）")) return;

    await supabase.from("photographs").update({ exhibition_id: null }).eq("exhibition_id", exId);
    await supabase.from("exhibitions").delete().eq("id", exId).eq("user_id", user.id);
    if (targetExhibitionId === exId) {
      setTargetExhibitionId("");
    }
    await fetchAllCloudData();
  };

  const startEditPhoto = (photo: Photograph) => {
    if (!photo.id) return;
    setEditingPhotoId(photo.id);
    setEditPhotoTitle(photo.title);
    setEditPhotoSpecs(photo.specs);
    setEditPhotoExId(photo.exhibition_id || myOwnExhibitions[0]?.id || "");
  };

  const handleSavePhotoEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingPhotoId) return;

    await supabase
      .from("photographs")
      .update({
        title: editPhotoTitle.trim() || "Untitled Study",
        specs: editPhotoSpecs.trim() || "DIGITAL ARCHIVE",
        exhibition_id: editPhotoExId || null,
      })
      .eq("id", editingPhotoId)
      .eq("user_id", user.id);

    setEditingPhotoId(null);
    await fetchAllCloudData();
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
  };

  const handleDeletePhoto = async (photo: Photograph) => {
    if (!user || !photo.id) return;
    if (!window.confirm(`確定要永久刪除作品「${photo.title}」嗎？`)) return;

    const storageMarker = "/gallery-photos/";
    const idx = photo.src.indexOf(storageMarker);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(photo.src.slice(idx + storageMarker.length));
      await supabase.storage.from("gallery-photos").remove([storagePath]);
    }

    await supabase.from("photographs").delete().eq("id", photo.id).eq("user_id", user.id);
    await fetchAllCloudData();
  };

  // 上傳照片：先讀取原圖 EXIF，再壓縮至 2400px 展覽級畫質後上傳至 Supabase Storage
  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!user) {
      alert("請先點擊右上角 SIGN IN 登入你的藝術家帳號再上傳作品！");
      return;
    }

    const filesArray = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (filesArray.length === 0) return;

    setIsUploading(true);
    setUploadStatusText("READING EXIF & COMPRESSING...");
    try {
      // 1. 先從原始相機檔案讀取 EXIF 拍攝參數與日期
      const parsedList = await parsePhotographs(filesArray);
      const myProfile = cloudProfiles.find((p) => p.id === user.id);
      const artistCredit = (myProfile?.display_name || "ARTIST ARCHIVE").toUpperCase();
      const chosenExId = targetExhibitionId || myOwnExhibitions[0]?.id || null;

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const meta = parsedList[i];
        setUploadStatusText(`OPTIMIZING & UPLOADING ${i + 1} / ${filesArray.length}...`);

        // 2. 在瀏覽器端壓縮高畫質展示圖（長邊上限 2400px）
        const optimizedBlob = await compressImageForGallery(file, 2400, 0.88);
        const fileExt = optimizedBlob.type === "image/jpeg" ? "jpg" : file.name.split(".").pop() || "jpg";
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from("gallery-photos")
          .upload(fileName, optimizedBlob, {
            contentType: optimizedBlob.type || "image/jpeg",
          });

        if (uploadErr) {
          console.error("Storage upload error:", uploadErr);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("gallery-photos").getPublicUrl(fileName);

        await supabase.from("photographs").insert({
          user_id: user.id,
          exhibition_id: chosenExId,
          src: publicUrl,
          alt: meta.alt,
          title: meta.title,
          year: meta.year,
          specs: meta.specs,
          credit: artistCredit,
          shoot_date_key: meta.shootDateKey,
          is_cover: myOwnPhotos.length === 0 && i === 0,
        });
      }

      await fetchAllCloudData();
      setSelectedArtistId(user.id);
      setView("artist");
      syncUrl("artist", user.id);
      setStudioOpen(false);
    } finally {
      setIsUploading(false);
      setUploadStatusText("");
    }
  };

  useEffect(() => {
    document.body.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    const openPhoto = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      setActivePhoto(detail);
      setShowInfo(true);
    };
    window.addEventListener("open-photo", openPhoto);
    return () => window.removeEventListener("open-photo", openPhoto);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
        return;
      }

      if (searchOpen && event.key === "Escape") {
        setSearchOpen(false);
        return;
      }

      if (studioOpen && event.key === "Escape") {
        setStudioOpen(false);
        return;
      }

      if (activePhoto === null || exhibitionPhotos.length === 0) return;
      if (event.key === "Escape") setActivePhoto(null);
      if (event.key === "ArrowRight")
        setActivePhoto((prev) => (prev === null ? null : (prev + 1) % exhibitionPhotos.length));
      if (event.key === "ArrowLeft")
        setActivePhoto((prev) =>
          prev === null ? null : (prev - 1 + exhibitionPhotos.length) % exhibitionPhotos.length,
        );
      if (event.key.toLowerCase() === "i") setShowInfo((prev) => !prev);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePhoto, exhibitionPhotos.length, studioOpen, searchOpen]);

  const currentLightboxPhoto = activePhoto === null ? null : exhibitionPhotos[activePhoto];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
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
      className="site-shell"
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
              <p className="eyebrow">AUTO-OPTIMIZE & EXIF SYNC</p>
              <h2>Drop photographs to publish to your gallery</h2>
              <p>Images will be auto-compressed to 2400px archival quality before upload.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="site-header">
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

        <nav aria-label="Primary navigation">
          <button
            className={view === "discover" ? "active" : ""}
            onClick={() => {
              setView("discover");
              syncUrl("discover");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            DISCOVER
          </button>

          {user && (
            <button
              className={view !== "discover" && selectedArtistId === user.id ? "active" : ""}
              onClick={() => {
                setSelectedArtistId(user.id);
                setView("artist");
                syncUrl("artist", user.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              MY GALLERY
            </button>
          )}

          {user && (
            <button
              className={studioOpen ? "active" : ""}
              onClick={() => setStudioOpen(true)}
            >
              STUDIO ({myOwnPhotos.length})
            </button>
          )}

          <button onClick={() => setSearchOpen(true)} aria-label="Search artists and works">
            SEARCH
          </button>

          {user ? (
            <button onClick={handleLogout} title={user.email}>
              SIGN OUT
            </button>
          ) : (
            <button onClick={handleGoogleLogin}>SIGN IN</button>
          )}

          <button
            className="theme-toggle"
            onClick={() => setDark((prev) => !prev)}
            aria-label={`Switch to ${dark ? "daylight" : "darkroom"} theme`}
          >
            {dark ? "DAYLIGHT" : "DARKROOM"}
          </button>
        </nav>
      </header>

      <main>
        <AnimatePresence mode="wait">
          {view === "discover" && (
            <DiscoverView
              artists={allArtists}
              allPhotos={allPhotos}
              currentUserId={user?.id}
              onSelectArtist={(artistId) => {
                setSelectedArtistId(artistId);
                setView("artist");
                syncUrl("artist", artistId);
                window.scrollTo({ top: 0, behavior: "smooth" });
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

      {/* ==================== 全站搜尋（CMD+K） ==================== */}
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
                    border: "1px solid currentColor",
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
                        ARTISTS ({searchResults.matchedArtists?.length || 0})
                      </p>
                      {searchResults.matchedArtists?.map((a) => (
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
                            borderBottom: "1px solid rgba(128,128,128,0.25)",
                            cursor: "pointer",
                          }}
                        >
                          <strong>{a.display_name}</strong>
                          <span style={{ display: "block", fontSize: "11px", opacity: 0.65 }}>
                            {a.location} · {a.specialty}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div>
                      <p className="eyebrow" style={{ marginBottom: "10px" }}>
                        PHOTOGRAPHS ({searchResults.matchedPhotos?.length || 0})
                      </p>
                      {searchResults.matchedPhotos?.map((p, i) => (
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
                            borderBottom: "1px solid rgba(128,128,128,0.25)",
                            cursor: "pointer",
                          }}
                        >
                          <img
                            src={p.src}
                            alt={p.title}
                            style={{ width: "48px", height: "48px", objectFit: "cover" }}
                          />
                          <div>
                            <strong>{p.title}</strong>
                            <span style={{ display: "block", fontSize: "11px", opacity: 0.65 }}>
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

      {/* ==================== 藝術家個人暗房工作台（STUDIO） ==================== */}
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
                <button className="studio-close" onClick={() => setStudioOpen(false)}>
                  CLOSE [ESC]
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "18px",
                  padding: "12px 24px",
                  borderBottom: "1px solid rgba(128,128,128,0.25)",
                  fontSize: "11px",
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
                    {myOwnExhibitions.length > 0 && (
                      <label
                        style={{
                          display: "grid",
                          gap: "6px",
                          fontSize: "11px",
                          letterSpacing: "0.12em",
                          marginBottom: "14px",
                        }}
                      >
                        TARGET EXHIBITION ROOM FOR NEW UPLOADS:
                        <select
                          value={targetExhibitionId}
                          onChange={(e) => setTargetExhibitionId(e.target.value)}
                          style={{
                            padding: "8px 10px",
                            border: "1px solid currentColor",
                            background: dark ? "#141312" : "#f7f5f0",
                            color: "inherit",
                            fontSize: "12px",
                          }}
                        >
                          {myOwnExhibitions.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.title} ({ex.period})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div
                      className="studio-drop-area"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <p className="eyebrow">AUTO-COMPRESS 2400PX + EXIF SYNC</p>
                      <p className="drop-title">
                        {isUploading
                          ? uploadStatusText || "UPLOADING..."
                          : "+ Select or Drop Photographs to Publish"}
                      </p>
                      <p className="drop-sub">
                        High-res camera files are automatically optimized before uploading.
                      </p>
                    </div>

                    <div className="studio-list">
                      <div className="studio-list-head">
                        <span>YOUR ARCHIVE ({myOwnPhotos.length} WORKS)</span>
                      </div>

                      {myOwnPhotos.length === 0 ? (
                        <p style={{ fontSize: "12px", opacity: 0.65, padding: "18px 0" }}>
                          No photographs uploaded yet. Click above to add your first works.
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
                                <img src={photo.src} alt={photo.alt} />
                                <div className="studio-item-meta" style={{ flex: 1 }}>
                                  <p className="studio-item-title">
                                    {photo.title}{" "}
                                    {photo.isCover && (
                                      <span
                                        style={{
                                          fontSize: "9px",
                                          padding: "2px 6px",
                                          border: "1px solid currentColor",
                                          marginLeft: "6px",
                                        }}
                                      >
                                        COVER
                                      </span>
                                    )}
                                  </p>
                                  <p className="studio-item-specs">
                                    {assignedEx ? `[${assignedEx.title}] · ` : ""}
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
                                    border: "1px solid currentColor",
                                  }}
                                >
                                  <input
                                    value={editPhotoTitle}
                                    onChange={(e) => setEditPhotoTitle(e.target.value)}
                                    placeholder="Artwork title"
                                    style={{
                                      padding: "6px 8px",
                                      border: "1px solid currentColor",
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
                                      border: "1px solid currentColor",
                                      background: "transparent",
                                      color: "inherit",
                                      fontSize: "11px",
                                    }}
                                  />
                                  {myOwnExhibitions.length > 0 && (
                                    <select
                                      value={editPhotoExId}
                                      onChange={(e) => setEditPhotoExId(e.target.value)}
                                      style={{
                                        padding: "6px 8px",
                                        border: "1px solid currentColor",
                                        background: dark ? "#141312" : "#f7f5f0",
                                        color: "inherit",
                                        fontSize: "11px",
                                      }}
                                    >
                                      {myOwnExhibitions.map((ex) => (
                                        <option key={ex.id} value={ex.id}>
                                          Exhibition: {ex.title}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                      type="submit"
                                      style={{
                                        padding: "5px 10px",
                                        border: "1px solid currentColor",
                                        fontSize: "10px",
                                        letterSpacing: "0.12em",
                                        cursor: "pointer",
                                      }}
                                    >
                                      SAVE
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPhotoId(null)}
                                      style={{
                                        padding: "5px 10px",
                                        opacity: 0.65,
                                        fontSize: "10px",
                                        letterSpacing: "0.12em",
                                        cursor: "pointer",
                                      }}
                                    >
                                      CANCEL
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <div style={{ display: "flex", gap: "10px", fontSize: "10px", letterSpacing: "0.12em" }}>
                                  <button
                                    onClick={() => startEditPhoto(photo)}
                                    style={{ cursor: "pointer", opacity: 0.8 }}
                                  >
                                    EDIT
                                  </button>
                                  <span>·</span>
                                  {!photo.isCover && (
                                    <>
                                      <button
                                        onClick={() => handleSetPhotoCover(photo.id)}
                                        style={{ cursor: "pointer", opacity: 0.8 }}
                                      >
                                        SET AS COVER
                                      </button>
                                      <span>·</span>
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleDeletePhoto(photo)}
                                    style={{ cursor: "pointer", opacity: 0.8, color: "#c94a4a" }}
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
                        border: "1px solid currentColor",
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
                          border: "1px solid currentColor",
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
                            border: "1px solid currentColor",
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
                            border: "1px solid currentColor",
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
                          border: "1px solid currentColor",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "12px",
                          fontFamily: "inherit",
                        }}
                      />
                      <button
                        type="submit"
                        disabled={creatingEx}
                        style={{
                          padding: "9px 14px",
                          border: "1px solid currentColor",
                          fontSize: "11px",
                          letterSpacing: "0.14em",
                          cursor: "pointer",
                        }}
                      >
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
                                onClick={() => handleDeleteExhibition(ex.id)}
                                style={{
                                  fontSize: "10px",
                                  letterSpacing: "0.12em",
                                  color: "#c94a4a",
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

      {/* ==================== 全螢幕燈箱檢視 ==================== */}
      <AnimatePresence>
        {currentLightboxPhoto && activePhoto !== null && (
          <motion.div
            className="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            onClick={() => setActivePhoto(null)}
            role="dialog"
            aria-modal="true"
            aria-label={currentLightboxPhoto.title}
          >
            <div className="lightbox-bar" onClick={(event) => event.stopPropagation()}>
              <span>
                {String(activePhoto + 1).padStart(2, "0")} /{" "}
                {String(exhibitionPhotos.length).padStart(2, "0")}
              </span>
              <div className="lightbox-controls">
                <button onClick={() => setShowInfo((prev) => !prev)}>
                  {showInfo ? "HIDE INFO [I]" : "SHOW INFO [I]"}
                </button>
                <button onClick={() => setActivePhoto(null)}>CLOSE [ESC]</button>
              </div>
            </div>

            <div className="lightbox-stage" onClick={(event) => event.stopPropagation()}>
              <button
                className="lightbox-nav prev"
                onClick={() =>
                  setActivePhoto(
                    (activePhoto - 1 + exhibitionPhotos.length) % exhibitionPhotos.length,
                  )
                }
                aria-label="Previous photograph"
              >
                ←
              </button>

              <motion.img
                key={currentLightboxPhoto.src}
                src={currentLightboxPhoto.src}
                alt={currentLightboxPhoto.alt}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, ease }}
              />

              <button
                className="lightbox-nav next"
                onClick={() => setActivePhoto((activePhoto + 1) % exhibitionPhotos.length)}
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
                </div>
                <p>{currentLightboxPhoto.specs}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}