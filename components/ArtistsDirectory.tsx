"use client";

import Image from "next/image";
import { ArrowUpRight, MapPin, Pause, Play } from "lucide-react";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { formatTime, type SoundRecord } from "@/lib/content";
import { sitePath } from "@/lib/site-path";
import { useAudio } from "./AudioProvider";
import { useListenContent } from "./ListenContentProvider";

type PortableTextChild = { text?: string };
type PortableTextBlock = { _key?: string; _type?: string; children?: PortableTextChild[] };

function profilePathSlug(pathname: string) {
  const cleanPath = pathname.replace(/\/$/, "");
  const marker = "/artists/";
  const index = cleanPath.indexOf(marker);
  return index >= 0 ? decodeURIComponent(cleanPath.slice(index + marker.length).split("/")[0]) : "";
}

function spotifyEmbedUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname !== "open.spotify.com") return "";
    const path = url.pathname.replace(/^\/embed\//, "/");
    return `https://open.spotify.com/embed${path}?utm_source=generator&theme=0`;
  } catch {
    return "";
  }
}

function ArtistBio({ blocks, fallback }: { blocks: unknown[]; fallback: string }) {
  const paragraphs = (blocks as PortableTextBlock[])
    .filter((block) => block._type === "block")
    .map((block) => ({ key: block._key, text: block.children?.map((child) => child.text ?? "").join("") ?? "" }))
    .filter((block) => block.text);
  if (paragraphs.length === 0) return <p>{fallback || "Profile information will be added soon."}</p>;
  return <>{paragraphs.map((paragraph, index) => <p key={paragraph.key ?? index}>{paragraph.text}</p>)}</>;
}

function ArtistFocusPlayer({ record }: { record: SoundRecord }) {
  const { activeRecord, currentTime, duration, isPlaying, playRecord, togglePlayback } = useAudio();
  const isActive = activeRecord.slug === record.slug;
  const playing = isActive && isPlaying;
  const total = isActive ? duration || record.duration : record.duration;
  const elapsed = isActive ? currentTime : 0;
  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
  const progressStyle = { "--artist-player-progress": `${progress}%` } as CSSProperties;

  return (
    <div className={`artist-focus-player${playing ? " is-playing" : ""}`}>
      <span className="artist-focus-player-art"><Image src={record.artwork} alt="" fill sizes="88px" /></span>
      <button type="button" onClick={() => isActive ? togglePlayback() : playRecord(record.slug)} aria-label={`${playing ? "Pause" : "Play"} ${record.title}`}>
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <div className="artist-focus-player-copy">
        <span><i aria-hidden="true" /> {playing ? "Playing now" : "Artist focus"}</span>
        <strong>{record.title}</strong>
        <small>{record.series}</small>
      </div>
      <div className="artist-focus-player-time" style={progressStyle}>
        <span>{formatTime(elapsed)}</span>
        <i aria-hidden="true" />
        <span>{formatTime(total)}</span>
      </div>
    </div>
  );
}

export function ArtistsDirectory() {
  const pathname = usePathname();
  const { artists, records } = useListenContent();
  const slug = profilePathSlug(pathname);
  const artist = slug ? artists.find((item) => item.slug === slug) : undefined;

  if (slug && artist) {
    const artistMixes = records.filter((record) => record.artistSlugs.includes(artist.slug));
    const focusMix = artistMixes.find((record) => record.slug === artist.featuredMixSlug) ?? artistMixes[0];
    const hasListening = artistMixes.length > 0 || artist.externalMixes.length > 0;

    return (
      <main className="artist-profile">
        <header className="artist-profile-hero">
          <div className="artist-profile-identity">
            <div className="artist-profile-eyebrow"><span>Lowkal artist file</span><span>{artist.relationship} / {artist.location || "Location open"}</span></div>
            <h1>{artist.name}</h1>
            <p>{artist.shortBio || "A Lowkal artist profile in progress."}</p>
            <div className="artist-profile-meta">{artist.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
          </div>

          <div className="artist-profile-portrait">
            {artist.coverImage || artist.portrait ? (
              <MediaFrame variant="hero" frameClassName="artist-profile-image" src={artist.coverImage || artist.portrait || ""} alt={`${artist.name} portrait`} fill sizes="(max-width: 760px) 100vw, 54vw" priority />
            ) : <div className="artist-profile-monogram" aria-hidden="true">{artist.name.slice(0, 2)}</div>}
            <span className="artist-profile-stamp">BLR / LOW END / {artist.relationship}</span>
          </div>
          {focusMix ? <ArtistFocusPlayer record={focusMix} /> : null}
        </header>

        <section className="artist-profile-body" aria-label={`${artist.name} biography`}>
          <header><span className="section-kicker">01 · Profile</span><p>Maximum 200 words.<br />The person behind the selections.</p></header>
          <div className="artist-profile-bio"><ArtistBio blocks={artist.bio} fallback={artist.shortBio} /></div>
          <aside className="artist-profile-links">
            <SiteLink href={sitePath("/artists")}>All artists ←</SiteLink>
            {artist.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} <ArrowUpRight aria-hidden="true" /></a>)}
          </aside>
        </section>

        {hasListening ? (
          <section className="artist-listening" aria-labelledby="artist-mixes-title">
            <header className="artist-section-heading"><span className="section-kicker">02 · Mix index</span><h2 id="artist-mixes-title">Selections,<br />in and out.</h2><p>Lowkal sessions sit beside transmissions made elsewhere.</p></header>
            <div className="artist-lowkal-mixes">
              {artistMixes.map((record, index) => (
                <article className="artist-mix-card" key={record.slug}>
                  <span className="artist-mix-index">LKL—{String(index + 1).padStart(2, "0")}</span>
                  <span className="artist-mix-art"><Image src={record.artwork} alt="" fill sizes="140px" /></span>
                  <div><small>{record.series}</small><strong>{record.title}</strong><em>{record.date} / {record.genres.slice(0, 2).join(" · ")}</em></div>
                  <SiteLink href={sitePath("/listen/archive")} aria-label={`Open ${record.title} in the Archive`}><ArrowUpRight aria-hidden="true" /></SiteLink>
                </article>
              ))}
              {artist.externalMixes.map((mix, index) => (
                <a className="artist-mix-card artist-mix-card--external" href={mix.url} target="_blank" rel="noreferrer" key={`${mix.url}-${index}`}>
                  <span className="artist-mix-index">EXT—{String(index + 1).padStart(2, "0")}</span>
                  {mix.artwork ? <span className="artist-mix-art"><Image src={mix.artwork} alt="" fill sizes="140px" /></span> : <span className="artist-mix-art artist-mix-art--type">{mix.platform.slice(0, 2)}</span>}
                  <div><small>{mix.platform}</small><strong>{mix.title}</strong><em>{mix.note || "External transmission"}</em></div>
                  <ArrowUpRight aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {artist.productions.length > 0 ? (
          <section className="artist-productions" aria-labelledby="artist-productions-title">
            <header className="artist-section-heading artist-section-heading--night"><span className="section-kicker">03 · Productions</span><h2 id="artist-productions-title">Made by<br />{artist.name}.</h2><p>Original tracks, remixes, EPs, and albums.</p></header>
            <div className="artist-production-grid">
              {artist.productions.map((production, index) => {
                const embedUrl = spotifyEmbedUrl(production.spotifyUrl);
                return (
                  <article className="artist-production-card" key={`${production.title}-${index}`}>
                    <div className="artist-production-label"><span>{production.releaseType}</span><span>{production.year || "—"}</span></div>
                    <h3>{production.title}</h3>
                    {production.artwork ? <span className="artist-production-art"><Image src={production.artwork} alt="" fill sizes="(max-width: 760px) 100vw, 42vw" /></span> : null}
                    {embedUrl ? <iframe src={embedUrl} title={`Spotify player for ${production.title}`} width="100%" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /> : null}
                    {production.externalUrl ? <a href={production.externalUrl} target="_blank" rel="noreferrer">Open release <ArrowUpRight aria-hidden="true" /></a> : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {artist.fieldNotes.length > 0 ? (
          <section className="artist-field-notes" aria-labelledby="artist-field-notes-title">
            <header className="artist-section-heading"><span className="section-kicker">04 · Field notes</span><h2 id="artist-field-notes-title">Where they<br />return.</h2><p>A personal layer of the Lowkal city guide.</p></header>
            <div className="artist-field-note-grid">
              {artist.fieldNotes.map((note, index) => (
                <article key={`${note.placeName}-${index}`}>
                  <div><span>FN—{String(index + 1).padStart(2, "0")}</span><MapPin aria-hidden="true" /></div>
                  <h3>{note.placeName}</h3><small>{note.area}</small><blockquote>“{note.note}”</blockquote>
                  <div className="artist-field-note-tags">{note.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <footer>{note.goOutSlug ? <SiteLink href={sitePath(`/go-out#${note.goOutSlug}`)}>Open in Go Out ↗</SiteLink> : null}{note.mapUrl ? <a href={note.mapUrl} target="_blank" rel="noreferrer">Map ↗</a> : null}</footer>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="artist-profile-footer"><span>Lowkal artist file / {artist.name}</span><SiteLink href={sitePath("/artists")}>All artist files →</SiteLink></footer>
      </main>
    );
  }

  return (
    <main className="artist-directory">
      <header><p className="section-kicker">Lowkal artists</p><h1>People in<br />the frequency.</h1><p>Residents, guests, and collaborators heard across Lowkal.</p></header>
      <div className="artist-directory-grid">
        {artists.map((item, index) => (
          <SiteLink href={sitePath(`/artists/${item.slug}`)} className="artist-directory-card" key={item.slug}>
            <span className="artist-directory-index">[{String(index + 1).padStart(2, "0")}] {item.relationship}</span>
            {item.portrait ? <span className="artist-directory-image"><Image src={item.portrait} alt="" fill sizes="(max-width: 760px) 90vw, 24vw" /></span> : <span className="artist-directory-monogram" aria-hidden="true">{item.name.slice(0, 2)}</span>}
            <strong>{item.name}</strong><p>{item.shortBio || "Profile information will be added soon."}</p>
          </SiteLink>
        ))}
      </div>
    </main>
  );
}
