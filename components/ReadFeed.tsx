"use client";

import { useEffect, useState } from "react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sanityClient, storiesQuery } from "@/lib/sanity";
import { sitePath } from "@/lib/site-path";

type Story = {
  slug: string;
  type: string;
  title: string;
  deck: string;
  byline: string;
  readTime: string;
  tone: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  publishedAt?: string | null;
};

type SanityStory = {
  slug: string;
  type: string;
  title: string;
  deck: string;
  byline: string;
  body?: Array<{ children?: Array<{ text?: string }> }>;
  accent?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  publishedAt?: string | null;
};

function toStory(post: SanityStory): Story {
  const words = (post.body ?? []).flatMap((block) => block.children ?? []).map((child) => child.text ?? "").join(" ").trim().split(/\s+/).filter(Boolean).length;
  return {
    slug: post.slug,
    type: post.type,
    title: post.title,
    deck: post.deck,
    byline: post.byline,
    readTime: `${Math.max(1, Math.ceil(words / 220))} min`,
    tone: ["paper", "red", "accent", "ink"].includes(post.accent ?? "") ? post.accent as Story["tone"] : "paper",
    imageUrl: post.imageUrl,
    imageAlt: post.imageAlt,
    publishedAt: post.publishedAt,
  };
}

export function ReadFeed({ fallback }: { fallback: Story[] }) {
  const [stories, setStories] = useState(fallback);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void sanityClient.fetch<SanityStory[]>(storiesQuery, {}, { signal: controller.signal })
        .then((posts) => setStories(posts.map(toStory)))
        .catch(() => undefined);
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);

  return (
    <section className="read-stream" aria-label="Latest stories">
      {stories.length === 0 ? (
        <div className="read-empty">
          <div className="empty-copy read-empty-copy">
            <span>Field notes</span>
            <h2>The first stories are being prepared.</h2>
            <p>For programme photographs and new session notices, follow Lowkal on Instagram.</p>
            <a href="https://www.instagram.com/lowkal.fm/" target="_blank" rel="noreferrer">Open Instagram ↗</a>
          </div>
          <MediaFrame variant="editorial" frameClassName="empty-art-panel read-empty-art" src={sitePath("/art/signal-flowers.jpg")} alt="Pixel-like red flowers on a deep red field" fill sizes="(max-width: 680px) 100vw, 38vw" />
        </div>
      ) : null}
      {stories.map((story, index) => (
        <article className={`read-story read-story--${story.tone}`} key={story.slug}>
          <div className="read-story-index">{String(index + 1).padStart(2, "0")}</div>
          {story.imageUrl ? <MediaFrame variant="editorial" frameClassName="read-story-media" src={story.imageUrl} alt={story.imageAlt || `${story.title} artwork`} width={1200} height={900} sizes="(max-width: 760px) 100vw, 36vw" /> : null}
          <div className="read-story-copy">
            <span>{story.type} · {story.readTime}</span>
            <h2><SiteLink href={`/read/${story.slug}`}>{story.title}</SiteLink></h2>
            <p>{story.deck}</p>
            <small>By {story.byline}{story.publishedAt ? ` · ${new Date(story.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
