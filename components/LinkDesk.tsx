"use client";

import { useEffect, useState } from "react";
import { MediaFrame } from "@/components/MediaFrame";
import { deskLinkHost, toDeskBoard, type DeskBoard } from "@/lib/link-board";
import { isSanityConfigured, linkBoardQuery, sanityClient } from "@/lib/sanity";
import { sitePath } from "@/lib/site-path";

const emptyBoard = toDeskBoard(null);

export function LinkDesk({ fallback = emptyBoard }: { fallback?: DeskBoard }) {
  const [board, setBoard] = useState(fallback);

  useEffect(() => {
    if (!isSanityConfigured) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void sanityClient.fetch(linkBoardQuery, {}, { signal: controller.signal })
        .then((record) => setBoard(toDeskBoard(record)))
        .catch(() => undefined);
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <main className="link-desk">
      <header className="link-desk-brand">
        <span className="link-desk-lockup">
          <MediaFrame variant="mark" src={sitePath("/lowkal-logo.jpg")} alt="" width={52} height={52} priority />
          <span className="brand-name">LOWKAL.FM</span>
        </span>
        <span className="brand-scripts" aria-hidden="true">लोकल / ಲೋಕಲ್ / লোকাল</span>
      </header>

      <section className="link-desk-intro">
        <span className="section-kicker">{board.kicker}</span>
        <h1>{board.title}</h1>
        {board.intro ? <p>{board.intro}</p> : null}
      </section>

      {board.links.length === 0 ? (
        <div className="link-desk-empty">
          <span>Private desk</span>
          <h2>No published links yet.</h2>
          <p>Destinations will appear here when Lowkal publishes them.</p>
        </div>
      ) : (
        <section className="link-desk-list" aria-label="Selected destinations">
          {board.links.map((link, index) => (
            <a
              className={`link-desk-item${link.imageUrl ? "" : " link-desk-item--plain"}`}
              href={link.url}
              key={`${link.url}-${index}`}
              rel="noreferrer"
              target="_blank"
            >
              <span className="link-desk-index">{String(index + 1).padStart(2, "0")}</span>
              {link.imageUrl ? (
                <MediaFrame
                  variant="editorial"
                  frameClassName="link-desk-preview"
                  src={link.imageUrl}
                  alt={link.imageAlt || `${link.title} preview`}
                  width={1400}
                  height={900}
                  sizes="(max-width: 760px) 100vw, 46vw"
                />
              ) : null}
              <span className="link-desk-copy">
                {link.label ? <span>{link.label}</span> : null}
                <strong>{link.title}</strong>
                {link.description ? <em>{link.description}</em> : null}
                <small>{deskLinkHost(link.url)} ↗</small>
              </span>
            </a>
          ))}
        </section>
      )}
    </main>
  );
}
