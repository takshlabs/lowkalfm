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

/** Average reading pace, in words per minute. */
const READING_PACE = 220;

function toStory(post: SanityStory): Story {
  const words = (post.body ?? [])
    .flatMap((block) => block.children ?? [])
    .map((child) => child.text ?? "")
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    slug: post.slug,
    type: post.type,
    title: post.title,
    deck: post.deck,
    byline: post.byline,
    readTime: `${Math.max(1, Math.ceil(words / READING_PACE))} min`,
    tone: ["paper", "red", "accent", "ink"].includes(post.accent ?? "") ? (post.accent as Story["tone"]) : "paper",
    imageUrl: post.imageUrl,
    imageAlt: post.imageAlt,
    publishedAt: post.publishedAt
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ReadFeed({ fallback = [] }: { fallback?: Story[] }) {
  const [stories, setStories] = useState(fallback);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void sanityClient.fetch<SanityStory[]>(storiesQuery, {}, { signal: controller.signal })
        .then((posts) => setStories(posts.map(toStory)))
        .catch(() => undefined);
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  if (stories.length === 0) {
    return (
      <section className="read-stream" aria-label="Latest stories">
        <div className="empty-state">
          <p className="section-kicker">Field notes</p>
          <h2>The first stories are being prepared.</h2>
          <p>
            For programme photographs and new session notices, follow Lowkal on Instagram.
          </p>
          <a
            className="link-quiet"
            href="https://www.instagram.com/lowkal.fm/"
            target="_blank"
            rel="noreferrer"
          >
            Open Instagram ↗
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="read-stream" aria-label="Latest stories" data-reveal-group>
      {stories.map((story, index) => (
        <article className={`read-story read-story--${story.tone}`} key={story.slug} data-reveal>
          <p className="read-story__index">{String(index + 1).padStart(2, "0")}</p>

          {story.imageUrl ? (
            <MediaFrame
              variant="editorial"
              frameClassName="read-story__media"
              src={story.imageUrl}
              alt={story.imageAlt || `${story.title} artwork`}
              width={1200}
              height={900}
              sizes="(max-width: 900px) 100vw, 36vw"
            />
          ) : null}

          <div className="read-story__copy">
            <p className="label label--sm label--muted">
              {story.type} · {story.readTime}
            </p>
            <h2>
              <SiteLink href={sitePath(`/read/${story.slug}`)}>{story.title}</SiteLink>
            </h2>
            <p className="read-story__deck">{story.deck}</p>
            <p className="read-story__byline label label--sm">
              By {story.byline}
              {story.publishedAt ? ` · ${formatDate(story.publishedAt)}` : ""}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
