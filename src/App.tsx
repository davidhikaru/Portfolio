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

// 保留 Mara Venn 作為平台預設精選駐館藝術家
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
        <img src={photo.src} alt={photo.alt} />
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

/* ==================== 藝術家個人畫廊（支援多展覽清單） ==================== */
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

  // 若藝術家尚未建立具名展覽，但有上傳照片，自動包裝成一個預設展覽「Selected Works」
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

          <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
            <div className="availability" style={{ opacity: artist.available_for_commissions ? 1 : 0.45 }}>
              <span style={{ background: artist.available_for_commissions ? undefined : "#888" }} />
              {artist.available_for_commissions
                ? "AVAILABLE FOR COMMISSIONS"
                : "ARCHIVE / NOT TAKING COMMISSIONS"}
            </div>

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

              // 若為第一個具名展覽，也一併納入尚未指定展覽的未分類照片
              const mergedPhotos =
                !ex.isVirtualDefault && idx === 0
                  ? [
                      ...exPhotos,
                      ...artistPhotos.filter((p) => !p.exhibition_id),
                    ]
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
                <img src={photo.src} alt={photo.alt} />
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
  const coverPhoto = photos.find((p) => p.isCover) || photos[0];
  const exNumberStr = `EXHIBITION ${String(exhibitionIndex + 1).padStart(2, "0")} / ${exhibition.period}`;

  return (
    <motion.div
      key={`exhibition-${exhibition.id}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <section className="exhibition-intro" id="top">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
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
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<"discover" | "artist" | "exhibition">("discover");
  const [selectedArtistId, setSelectedArtistId] = useState<string>(MARA_VENN_PROFILE.id);
  const [activeExhibitionId, setActiveExhibitionId] = useState<string | null>(null);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // STUDIO：上傳目標展覽與建立新展覽表單狀態
  const [targetExhibitionId, setTargetExhibitionId] = useState<string>("");
  const [newExTitle, setNewExTitle] = useState("");
  const [newExLocation, setNewExLocation] = useState("TAIPEI, TW");
  const [newExPeriod, setNewExPeriod] = useState("2026");
  const [newExDesc, setNewExDesc] = useState("");
  const [creatingEx, setCreatingEx] = useState(false);

  // STUDIO：單張照片編輯狀態（順序 1）
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editPhotoTitle, setEditPhotoTitle] = useState("");
  const [editPhotoSpecs, setEditPhotoSpecs] = useState("");
  const [editPhotoExId, setEditPhotoExId] = useState<string>("");

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

  // 當前正在看的單一展覽與其所屬照片
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
  }, [currentArtistExhibitions, currentExhibition.id]);

  const currentExhibitionPhotos = useMemo(() => {
    if (currentExhibition.isVirtualDefault) {
      return currentArtistPhotos;
    }
    const direct = currentArtistPhotos.filter((p) => p.exhibition_id === currentExhibition.id);
    if (currentExhibitionIndex === 0) {
      return [...direct, ...currentArtistPhotos.filter((p) => !p.exhibition_id)];
    }
    return direct;
  }, [currentExhibition, currentArtistPhotos, currentExhibitionIndex]);

  // 登入者自己的展覽與作品（STUDIO 用）
  const myExhibitions = useMemo(
    () => (user ? cloudExhibitions.filter((e) => e.user_id === user.id) : []),
    [cloudExhibitions, user],
  );
  const myPhotos = useMemo(
    () => (user ? cloudPhotos.filter((p) => p.user_id === user.id) : []),
    [cloudPhotos, user],
  );

  const fetchGalleryData = async () => {
    const [profilesRes, exhibitionsRes, photosRes] = await Promise.all([
      supabase.from("profiles").select("*").order("updated_at", { ascending: false }),
      supabase.from("exhibitions").select("*").order("created_at", { ascending: true }),
      supabase.from("photographs").select("*").order("created_at", { ascending: true }),
    ]);

    const profileMap = new Map<string, string>();
    if (!profilesRes.error && profilesRes.data) {
      setCloudProfiles(profilesRes.data);
      profilesRes.data.forEach((p) => profileMap.set(p.id, p.display_name));
    }

    if (!exhibitionsRes.error && exhibitionsRes.data) {
      setCloudExhibitions(exhibitionsRes.data);
    }

    if (!photosRes.error && photosRes.data) {
      const mapped: Photograph[] = photosRes.data.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        exhibition_id: row.exhibition_id,
        src: row.image_url,
        alt: row.title,
        title: row.title,
        year: row.shoot_date ? row.shoot_date.slice(0, 4) : "2026",
        specs: row.specs || "DIGITAL ARCHIVE",
        credit: (profileMap.get(row.user_id) || "RESIDENT ARTIST").toUpperCase(),
        shootDateKey: row.shoot_date,
        isCover: row.is_cover,
      }));
      setCloudPhotos(mapped);
    }
  };

  useEffect(() => {
    fetchGalleryData();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchGalleryData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [searchOpen]);

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) alert("Google 登入失敗：" + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setStudioOpen(false);
  };

  const openArtistGallery = (artistId: string) => {
    setSelectedArtistId(artistId);
    setView("artist");
    setSearchOpen(false);
    setStudioOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveArtistProfile = async (updated: Partial<ArtistProfile>) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ ...updated, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      alert("儲存個人檔案失敗：" + error.message);
      return;
    }
    await fetchGalleryData();
  };

  // 建立新展覽（順序 2）
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
          newExDesc.trim() || "A curated visual study of light, space, and quiet observation.",
      })
      .select()
      .single();

    setCreatingEx(false);
    if (error) {
      alert("建立展覽失敗：" + error.message);
      return;
    }

    setNewExTitle("");
    setNewExDesc("");
    if (data?.id) setTargetExhibitionId(data.id);
    await fetchGalleryData();
    setStudioTab("photos");
  };

  const handleDeleteExhibition = async (exId: string) => {
    if (!user || !confirm("確定要刪除此展覽？（展覽內的照片會保留並移回未分類）")) return;
    await supabase.from("exhibitions").delete().eq("id", exId).eq("user_id", user.id);
    await fetchGalleryData();
  };

  // 上傳照片至指定展覽
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setIsUploading(true);

    try {
      const parsedList = await parsePhotographs(files);
      const fileArray = Array.from(files);
      const chosenExId = targetExhibitionId || myExhibitions[0]?.id || null;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const meta = parsedList[i];
        const ext = file.name.split(".").pop() || "jpg";
        const filePath = `${user.id}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("portfolio-photos")
          .upload(filePath, file);

        if (uploadError) throw new Error(`圖片上傳失敗：${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from("portfolio-photos")
          .getPublicUrl(filePath);

        const shouldBeCover = myPhotos.length === 0 && i === 0;
        const { error: dbError } = await supabase.from("photographs").insert({
          user_id: user.id,
          exhibition_id: chosenExId,
          title: meta.title,
          specs: meta.specs,
          image_url: publicUrlData.publicUrl,
          shoot_date: meta.shootDateKey || toDateKey(new Date()),
          is_cover: shouldBeCover,
        });

        if (dbError) throw new Error(`資料庫儲存失敗：${dbError.message}`);
      }

      await fetchGalleryData();
      openArtistGallery(user.id);
    } catch (err: any) {
      alert(err.message || "上傳過程發生錯誤");
    } finally {
      setIsUploading(false);
    }
  };

  // 編輯單張作品資訊（順序 1）
  const startEditPhoto = (photo: Photograph) => {
    if (!photo.id) return;
    setEditingPhotoId(photo.id);
    setEditPhotoTitle(photo.title);
    setEditPhotoSpecs(photo.specs);
    setEditPhotoExId(photo.exhibition_id || "");
  };

  const handleSavePhotoEdit = async (photoId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("photographs")
      .update({
        title: editPhotoTitle.trim() || "Untitled",
        specs: editPhotoSpecs.trim() || "DIGITAL ARCHIVE",
        exhibition_id: editPhotoExId || null,
      })
      .eq("id", photoId)
      .eq("user_id", user.id);

    if (error) {
      alert("更新作品失敗：" + error.message);
      return;
    }
    setEditingPhotoId(null);
    await fetchGalleryData();
  };

  // 刪除單張作品並釋放雲端儲存空間（順序 1）
  const handleDeletePhoto = async (photo: Photograph) => {
    if (!user || !photo.id) return;
    if (!confirm(`確定要永久刪除「${photo.title}」嗎？`)) return;

    // 1. 嘗試從 publicUrl 解析出 Storage 檔案路徑並刪除實體圖檔
    const marker = "/portfolio-photos/";
    const idx = photo.src.indexOf(marker);
    if (idx !== -1) {
      const storagePath = photo.src.slice(idx + marker.length);
      await supabase.storage.from("portfolio-photos").remove([storagePath]);
    }

    // 2. 刪除資料庫紀錄
    await supabase.from("photographs").delete().eq("id", photo.id).eq("user_id", user.id);
    await fetchGalleryData();
  };

  const handleSetAsCover = async (photoId?: string) => {
    if (!photoId || !user) return;
    await supabase.from("photographs").update({ is_cover: false }).eq("user_id", user.id);
    await supabase.from("photographs").update({ is_cover: true }).eq("id", photoId);
    await fetchGalleryData();
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        artists: allArtists,
        photos: allPhotos.slice(0, 6),
      };
    }
    return {
      artists: allArtists.filter(
        (a) =>
          a.display_name.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q) ||
          a.specialty.toLowerCase().includes(q),
      ),
      photos: allPhotos.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.specs.toLowerCase().includes(q) ||
          p.credit.toLowerCase().includes(q),
      ),
    };
  }, [searchQuery, allArtists, allPhotos]);

  const lightboxList = view === "exhibition" ? currentExhibitionPhotos : currentArtistPhotos;
  const closeLightbox = () => setActivePhoto(null);
  const movePhoto = (direction: number) => {
    setActivePhoto((current) => {
      if (current === null || lightboxList.length === 0) return null;
      return (current + direction + lightboxList.length) % lightboxList.length;
    });
  };

  useEffect(() => {
    const openPhoto = (event: Event) => {
      setActivePhoto((event as CustomEvent<number>).detail);
      setShowInfo(true);
    };
    window.addEventListener("open-photo", openPhoto);
    return () => window.removeEventListener("open-photo", openPhoto);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (activePhoto === null) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") movePhoto(-1);
      if (event.key === "ArrowRight") movePhoto(1);
      if (event.key.toLowerCase() === "i") setShowInfo((value) => !value);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhoto, lightboxList.length]);

  useEffect(() => {
    document.body.style.overflow = activePhoto !== null || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activePhoto, searchOpen]);

  const currentPhoto = activePhoto !== null ? lightboxList[activePhoto] : null;

  return (
    <main className={dark ? "site darkroom" : "site"}>
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button
            className="wordmark"
            onClick={() => {
              setView("discover");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-label="Studio Folio Discover"
          >
            STUDIO FOLIO
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            style={{
              fontSize: "11px",
              letterSpacing: "0.14em",
              opacity: 0.65,
              cursor: "pointer",
              padding: "4px 10px",
              border: "1px solid currentColor",
            }}
          >
            SEARCH ARTISTS / WORKS (⌘K)
          </button>
        </div>

        <div className="top-actions">
          <button className="text-button theme-button" onClick={() => setDark((value) => !value)}>
            <span className="theme-mark" aria-hidden="true" />
            {dark ? "LIGHT" : "DARKROOM"}
          </button>

          {user ? (
            <>
              <button
                className="text-button"
                onClick={() => openArtistGallery(user.id)}
                style={{
                  textDecoration:
                    view !== "discover" && selectedArtistId === user.id ? "underline" : "none",
                }}
              >
                MY GALLERY
              </button>
              <button className="studio-button" onClick={() => setStudioOpen((value) => !value)}>
                STUDIO
              </button>
            </>
          ) : (
            <button className="studio-button" onClick={handleGoogleLogin}>
              SIGN IN / OPEN GALLERY
            </button>
          )}
        </div>
      </header>

      {/* 全螢幕極簡搜尋抽屜 */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            onClick={() => setSearchOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
              background: dark ? "rgba(18, 17, 16, 0.94)" : "rgba(246, 244, 240, 0.95)",
              backdropFilter: "blur(8px)",
              padding: "80px 6vw",
              overflowY: "auto",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "780px", margin: "0 auto" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <p className="eyebrow">SEARCH ARCHIVE — ARTISTS, CITIES, CAMERAS, WORKS</p>
                <button
                  onClick={() => setSearchOpen(false)}
                  style={{ fontSize: "11px", letterSpacing: "0.15em", cursor: "pointer" }}
                >
                  CLOSE (ESC)
                </button>
              </div>

              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type artist name, Leica, Tokyo, title..."
                style={{
                  width: "100%",
                  fontSize: "24px",
                  padding: "14px 0",
                  border: "none",
                  borderBottom: "1px solid currentColor",
                  background: "transparent",
                  color: "inherit",
                  outline: "none",
                  marginBottom: "32px",
                }}
              />

              <div style={{ marginBottom: "32px" }}>
                <p className="eyebrow" style={{ marginBottom: "12px" }}>
                  ARTISTS ({searchResults.artists.length})
                </p>
                <div style={{ display: "grid", gap: "10px" }}>
                  {searchResults.artists.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => openArtistGallery(artist.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        border: "1px solid currentColor",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "15px", display: "block" }}>
                          {artist.display_name}
                        </strong>
                        <span style={{ fontSize: "11px", opacity: 0.7 }}>{artist.location}</span>
                      </div>
                      <span style={{ fontSize: "11px", letterSpacing: "0.14em" }}>
                        ENTER GALLERY →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow" style={{ marginBottom: "12px" }}>
                  PHOTOGRAPHS ({searchResults.photos.length})
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {searchResults.photos.map((photo) => (
                    <button
                      key={photo.id || photo.src}
                      onClick={() => {
                        if (photo.user_id) {
                          openArtistGallery(photo.user_id);
                        }
                      }}
                      style={{
                        textAlign: "left",
                        cursor: "pointer",
                        border: "1px solid rgba(128,128,128,0.25)",
                        padding: "8px",
                      }}
                    >
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        style={{
                          width: "100%",
                          height: "130px",
                          objectFit: "cover",
                          marginBottom: "8px",
                        }}
                      />
                      <div style={{ fontSize: "12px", fontWeight: 500 }}>{photo.title}</div>
                      <div style={{ fontSize: "10px", opacity: 0.65 }}>{photo.credit}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 個人策展 STUDIO 面板（多展覽管理 ＋ 單張作品編輯/刪除） */}
      <AnimatePresence>
        {studioOpen && user && (
          <motion.aside
            className="studio-note"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease }}
            style={{ maxWidth: "430px", width: "92vw" }}
          >
            <p className="eyebrow">CURATOR STUDIO</p>
            <button onClick={() => setStudioOpen(false)} aria-label="Close studio notes">
              CLOSE
            </button>

            {/* 分頁切換：PHOTOS / EXHIBITIONS */}
            <div
              style={{
                display: "flex",
                gap: "14px",
                marginTop: "10px",
                marginBottom: "14px",
                paddingBottom: "8px",
                borderBottom: "1px solid rgba(128,128,128,0.3)",
                fontSize: "11px",
                letterSpacing: "0.14em",
              }}
            >
              <button
                onClick={() => setStudioTab("photos")}
                style={{
                  position: "static",
                  fontWeight: studioTab === "photos" ? 600 : 400,
                  textDecoration: studioTab === "photos" ? "underline" : "none",
                  opacity: studioTab === "photos" ? 1 : 0.6,
                }}
              >
                PHOTOS ({myPhotos.length})
              </button>
              <button
                onClick={() => setStudioTab("exhibitions")}
                style={{
                  position: "static",
                  fontWeight: studioTab === "exhibitions" ? 600 : 400,
                  textDecoration: studioTab === "exhibitions" ? "underline" : "none",
                  opacity: studioTab === "exhibitions" ? 1 : 0.6,
                }}
              >
                EXHIBITIONS ({myExhibitions.length})
              </button>
            </div>

            {studioTab === "photos" ? (
              <>
                {/* 選擇上傳目標展覽 */}
                {myExhibitions.length > 0 && (
                  <div style={{ marginBottom: "10px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        opacity: 0.75,
                        marginBottom: "4px",
                      }}
                    >
                      ASSIGN UPLOADS TO EXHIBITION
                    </label>
                    <select
                      value={targetExhibitionId || myExhibitions[0]?.id || ""}
                      onChange={(e) => setTargetExhibitionId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 8px",
                        border: "1px solid currentColor",
                        background: dark ? "#181715" : "#f6f4f0",
                        color: "inherit",
                        fontSize: "11px",
                      }}
                    >
                      {myExhibitions.map((ex, i) => (
                        <option key={ex.id} value={ex.id}>
                          {String(i + 1).padStart(2, "0")} / {ex.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleUploadFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: "18px 14px",
                    border: `1px dashed ${isDragging ? "#b87524" : "currentColor"}`,
                    opacity: isDragging ? 1 : 0.8,
                    cursor: "pointer",
                    textAlign: "center",
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => handleUploadFiles(e.target.files)}
                  />
                  {isUploading ? "UPLOADING TO YOUR GALLERY..." : "+ DROP PHOTOS OR CLICK TO UPLOAD"}
                </div>

                {/* 已上傳作品管理（編輯標題/參數、設封面、刪除） */}
                {myPhotos.length > 0 && (
                  <div style={{ marginTop: "14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <span style={{ fontSize: "10px", opacity: 0.75, letterSpacing: "0.1em" }}>
                        MANAGE ARCHIVE ({myPhotos.length})
                      </span>
                      <button
                        onClick={() => openArtistGallery(user.id)}
                        style={{ position: "static", textDecoration: "underline", fontSize: "10px" }}
                      >
                        VIEW GALLERY →
                      </button>
                    </div>

                    <div
                      style={{
                        maxHeight: "210px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        paddingRight: "2px",
                      }}
                    >
                      {myPhotos.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            borderBottom: "1px solid rgba(128,128,128,0.2)",
                            paddingBottom: "8px",
                            fontSize: "11px",
                          }}
                        >
                          {editingPhotoId === item.id ? (
                            <div style={{ display: "grid", gap: "6px" }}>
                              <input
                                value={editPhotoTitle}
                                onChange={(e) => setEditPhotoTitle(e.target.value)}
                                placeholder="Artwork title"
                                style={{
                                  padding: "5px 7px",
                                  border: "1px solid currentColor",
                                  background: "transparent",
                                  color: "inherit",
                                  fontSize: "11px",
                                }}
                              />
                              <input
                                value={editPhotoSpecs}
                                onChange={(e) => setEditPhotoSpecs(e.target.value)}
                                placeholder="Camera · Lens · Film"
                                style={{
                                  padding: "5px 7px",
                                  border: "1px solid currentColor",
                                  background: "transparent",
                                  color: "inherit",
                                  fontSize: "10px",
                                }}
                              />
                              {myExhibitions.length > 0 && (
                                <select
                                  value={editPhotoExId}
                                  onChange={(e) => setEditPhotoExId(e.target.value)}
                                  style={{
                                    padding: "5px 7px",
                                    border: "1px solid currentColor",
                                    background: dark ? "#181715" : "#f6f4f0",
                                    color: "inherit",
                                    fontSize: "10px",
                                  }}
                                >
                                  <option value="">Default Exhibition</option>
                                  {myExhibitions.map((ex) => (
                                    <option key={ex.id} value={ex.id}>
                                      {ex.title}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  onClick={() => item.id && handleSavePhotoEdit(item.id)}
                                  style={{
                                    position: "static",
                                    padding: "3px 8px",
                                    border: "1px solid currentColor",
                                    fontSize: "10px",
                                  }}
                                >
                                  SAVE
                                </button>
                                <button
                                  onClick={() => setEditingPhotoId(null)}
                                  style={{ position: "static", fontSize: "10px", opacity: 0.7 }}
                                >
                                  CANCEL
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  overflow: "hidden",
                                }}
                              >
                                <img
                                  src={item.src}
                                  alt=""
                                  style={{
                                    width: "30px",
                                    height: "30px",
                                    objectFit: "cover",
                                    flexShrink: 0,
                                  }}
                                />
                                <div style={{ overflow: "hidden" }}>
                                  <div
                                    style={{
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {item.title}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "9px",
                                      opacity: 0.65,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {item.specs}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                                <button
                                  onClick={() => startEditPhoto(item)}
                                  style={{
                                    position: "static",
                                    fontSize: "9px",
                                    padding: "3px 6px",
                                    border: "1px solid currentColor",
                                    opacity: 0.75,
                                  }}
                                >
                                  EDIT
                                </button>
                                <button
                                  onClick={() => handleSetAsCover(item.id)}
                                  disabled={item.isCover}
                                  style={{
                                    position: "static",
                                    fontSize: "9px",
                                    padding: "3px 6px",
                                    border: "1px solid currentColor",
                                    opacity: item.isCover ? 1 : 0.65,
                                  }}
                                >
                                  {item.isCover ? "★" : "COVER"}
                                </button>
                                <button
                                  onClick={() => handleDeletePhoto(item)}
                                  style={{
                                    position: "static",
                                    fontSize: "9px",
                                    padding: "3px 6px",
                                    border: "1px solid currentColor",
                                    opacity: 0.65,
                                  }}
                                >
                                  DEL
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* 分頁 2：建立與管理多個展覽 */
              <div>
                <form onSubmit={handleCreateExhibition} style={{ display: "grid", gap: "8px" }}>
                  <p style={{ fontSize: "10px", letterSpacing: "0.12em", opacity: 0.75 }}>
                    CREATE NEW EXHIBITION ROOM
                  </p>
                  <input
                    required
                    value={newExTitle}
                    onChange={(e) => setNewExTitle(e.target.value)}
                    placeholder="Exhibition Title (e.g. Tokyo Nocturnes)"
                    style={{
                      padding: "7px 9px",
                      border: "1px solid currentColor",
                      background: "transparent",
                      color: "inherit",
                      fontSize: "12px",
                    }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <input
                      value={newExLocation}
                      onChange={(e) => setNewExLocation(e.target.value)}
                      placeholder="Location (e.g. TOKYO)"
                      style={{
                        padding: "7px 9px",
                        border: "1px solid currentColor",
                        background: "transparent",
                        color: "inherit",
                        fontSize: "11px",
                      }}
                    />
                    <input
                      value={newExPeriod}
                      onChange={(e) => setNewExPeriod(e.target.value)}
                      placeholder="Period (e.g. 2025—2026)"
                      style={{
                        padding: "7px 9px",
                        border: "1px solid currentColor",
                        background: "transparent",
                        color: "inherit",
                        fontSize: "11px",
                      }}
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={newExDesc}
                    onChange={(e) => setNewExDesc(e.target.value)}
                    placeholder="Curatorial statement / exhibition notes..."
                    style={{
                      padding: "7px 9px",
                      border: "1px solid currentColor",
                      background: "transparent",
                      color: "inherit",
                      fontSize: "11px",
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={creatingEx}
                    style={{
                      position: "static",
                      padding: "9px 12px",
                      border: "1px solid currentColor",
                      fontSize: "10px",
                      letterSpacing: "0.14em",
                    }}
                  >
                    {creatingEx ? "CREATING..." : "+ CREATE EXHIBITION"}
                  </button>
                </form>

                {myExhibitions.length > 0 && (
                  <div style={{ marginTop: "14px", display: "grid", gap: "6px" }}>
                    <span style={{ fontSize: "10px", opacity: 0.7, letterSpacing: "0.1em" }}>
                      YOUR EXHIBITIONS
                    </span>
                    {myExhibitions.map((ex, idx) => (
                      <div
                        key={ex.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          border: "1px solid rgba(128,128,128,0.3)",
                          fontSize: "11px",
                        }}
                      >
                        <span>
                          {String(idx + 1).padStart(2, "0")} / {ex.title}
                        </span>
                        <button
                          onClick={() => handleDeleteExhibition(ex.id)}
                          style={{ position: "static", fontSize: "9px", opacity: 0.65 }}
                        >
                          DEL
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: "16px",
                paddingTop: "10px",
                borderTop: "1px solid currentColor",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: 0.65,
                fontSize: "10px",
              }}
            >
              <span>{user.email}</span>
              <button
                onClick={handleLogout}
                style={{ position: "static", textDecoration: "underline", fontSize: "10px" }}
              >
                SIGN OUT
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 主畫面切換 */}
      <AnimatePresence mode="wait">
        {view === "discover" ? (
          <DiscoverView
            artists={allArtists}
            allPhotos={allPhotos}
            onSelectArtist={openArtistGallery}
            currentUserId={user?.id}
            onOpenStudioOrLogin={() => {
              if (user) {
                openArtistGallery(user.id);
              } else {
                handleGoogleLogin();
              }
            }}
          />
        ) : view === "artist" ? (
          <ArtistGalleryProfileView
            artist={currentArtist}
            artistPhotos={currentArtistPhotos}
            artistExhibitions={currentArtistExhibitions}
            dark={dark}
            isOwnProfile={Boolean(user && user.id === currentArtist.id)}
            onOpenExhibition={(ex) => {
              setActiveExhibitionId(ex.id);
              setView("exhibition");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onOpenStudio={() => setStudioOpen(true)}
            onSaveProfile={handleSaveArtistProfile}
            onBackToDiscover={() => setView("discover")}
          />
        ) : (
          <ExhibitionView
            artist={currentArtist}
            exhibition={currentExhibition}
            exhibitionIndex={currentExhibitionIndex}
            photos={currentExhibitionPhotos}
            dark={dark}
            onBackToArtist={() => setView("artist")}
          />
        )}
      </AnimatePresence>

      {/* 燈箱檢視 */}
      <AnimatePresence>
        {currentPhoto && activePhoto !== null && (
          <motion.div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`${currentPhoto.title} lightbox`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease }}
          >
            <div className="lightbox-bar">
              <p>
                {String(activePhoto + 1).padStart(2, "0")} /{" "}
                {String(lightboxList.length).padStart(2, "0")}
              </p>
              <button onClick={closeLightbox}>CLOSE</button>
            </div>
            <motion.img
              key={currentPhoto.src}
              src={currentPhoto.src}
              alt={currentPhoto.alt}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.75, ease }}
            />
            <button
              className="nav-arrow previous"
              onClick={() => movePhoto(-1)}
              aria-label="Previous photograph"
            >
              ←
            </button>
            <button
              className="nav-arrow next"
              onClick={() => movePhoto(1)}
              aria-label="Next photograph"
            >
              →
            </button>
            <div className="keyboard-hint">← / → NAVIGATE</div>
            <button className="info-toggle" onClick={() => setShowInfo((value) => !value)}>
              {showInfo ? "HIDE INFO" : "INFO"}
            </button>
            <AnimatePresence>
              {showInfo && (
                <motion.div
                  className="info-drawer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.45, ease }}
                >
                  <div>
                    <p className="lightbox-title">
                      <em>{currentPhoto.title}</em>, {currentPhoto.year}
                    </p>
                    <p className="specs">{currentPhoto.specs}</p>
                  </div>
                  <p className="credit">IMAGE: {currentPhoto.credit}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}