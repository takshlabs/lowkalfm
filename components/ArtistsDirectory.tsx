"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { useListenContent } from "./ListenContentProvider";

type PortableTextChild = { text?: string };
type PortableTextBlock = { _key?: string; _type?: string; style?: string; children?: PortableTextChild[] };

function profilePathSlug(pathname: string) {
  const cleanPath = pathname.replace(/\/$/, "");
  const marker = "/artists/";
  const index = cleanPath.indexOf(marker);
  return index >= 0 ? decodeURIComponent(cleanPath.slice(index + marker.length).split("/")[0]) : "";
}

function ArtistBio({ blocks, fallback }: { blocks: unknown[]; fallback: string }) {
  const paragraphs = (blocks as PortableTextBlock[])
    .filter((block) => block._type === "block")
    .map((block) => ({ key: block._key, text: block.children?.map((child) => child.text ?? "").join("") ?? "" }))
    .filter((block) => block.text);
  if (paragraphs.length === 0) return fallback ? <p>{fallback}</p> : <p>Profile information will be added soon.</p>;
  return <>{paragraphs.map((paragraph, index) => <p key={paragraph.key ?? index}>{paragraph.text}</p>)}</>;
}

export function ArtistsDirectory() {
  const pathname = usePathname();
  const { artists, records } = useListenContent();
  const slug = profilePathSlug(pathname);
  const artist = slug ? artists.find((item) => item.slug === slug) : undefined;

  if (slug && artist) {
    const artistMixes = records.filter((record) => record.artistSlugs.includes(artist.slug));
    return (
      <main className="artist-profile">
        <header className="artist-profile-hero">
          <div className="artist-profile-heading">
            <p className="section-kicker">Lowkal artist / {artist.relationship}</p>
            <h1>{artist.name}</h1>
            <div className="artist-profile-meta">
              {artist.location && <span>{artist.location}</span>}
              {artist.genres.map((genre) => <span key={genre}>{genre}</span>)}
            </div>
          </div>
          {artist.coverImage || artist.portrait ? (
            <MediaFrame
              variant="hero"
              frameClassName="artist-profile-image"
              src={artist.coverImage || artist.portrait || ""}
              alt={`${artist.name} profile`}
              fill
              sizes="(max-width: 760px) 100vw, 48vw"
              priority
            />
          ) : <div className="artist-profile-monogram" aria-hidden="true">{artist.name.slice(0, 2)}</div>}
        </header>

        <section className="artist-profile-body" aria-label={`${artist.name} biography`}>
          <div className="artist-profile-bio"><ArtistBio blocks={artist.bio} fallback={artist.shortBio} /></div>
          <aside className="artist-profile-links">
            <SiteLink href={sitePath("/artists")}>All artists ←</SiteLink>
            {artist.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}
          </aside>
        </section>

        <section className="artist-profile-mixes" aria-labelledby="artist-mixes-title">
          <header><p className="section-kicker">Listen</p><h2 id="artist-mixes-title">On Lowkal</h2></header>
          <div>
            {artistMixes.map((record) => (
              <SiteLink href={sitePath("/listen/archive")} className="artist-mix-card" key={record.slug}>
                <span className="artist-mix-art"><Image src={record.artwork} alt="" fill sizes="120px" /></span>
                <span><small>{record.series}</small><strong>{record.title}</strong><em>{record.date}</em></span>
              </SiteLink>
            ))}
            {artistMixes.length === 0 && <p>No published mixes yet.</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="artist-directory">
      <header>
        <p className="section-kicker">Lowkal artists</p>
        <h1>People in<br />the frequency.</h1>
        <p>Residents, guests, and collaborators heard across Lowkal.</p>
      </header>
      <div className="artist-directory-grid">
        {artists.map((item, index) => (
          <SiteLink href={sitePath(`/artists/${item.slug}`)} className="artist-directory-card" key={item.slug}>
            <span className="artist-directory-index">[{String(index + 1).padStart(2, "0")}] {item.relationship}</span>
            {item.portrait ? <span className="artist-directory-image"><Image src={item.portrait} alt="" fill sizes="(max-width: 760px) 90vw, 24vw" /></span> : <span className="artist-directory-monogram" aria-hidden="true">{item.name.slice(0, 2)}</span>}
            <strong>{item.name}</strong>
            <p>{item.shortBio || "Profile information will be added soon."}</p>
          </SiteLink>
        ))}
      </div>
    </main>
  );
}
