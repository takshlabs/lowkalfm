"use client";

import { useEffect, useState } from "react";
import { MediaFrame } from "@/components/MediaFrame";

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

type RemotePost = {
  slug: string;
  type: string;
  title: string;
  deck: string;
  byline: string;
  body_markdown: string;
  tone: string;
  image_url: string | null;
  image_alt: string | null;
  published_at: string | null;
};

function toStory(post: RemotePost): Story {
  const words = post.body_markdown.trim().split(/\s+/).filter(Boolean).length;
  return {
    slug: post.slug,
    type: post.type,
    title: post.title,
    deck: post.deck,
    byline: post.byline,
    readTime: `${Math.max(1, Math.ceil(words / 220))} min`,
    tone: post.tone,
    imageUrl: post.image_url,
    imageAlt: post.image_alt,
    publishedAt: post.published_at,
  };
}

export function ReadFeed({ fallback }: { fallback: Story[] }) {
  const [stories, setStories] = useState(fallback);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/content/read", { signal: controller.signal })
        .then(async (response) => response.ok ? response.json() : null)
        .then((data: { posts?: RemotePost[] } | null) => {
          if (data?.posts?.length) setStories(data.posts.map(toStory));
        })
        .catch(() => undefined);
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);

  return (
    <section className="read-stream" aria-label="Latest stories">
      {stories.map((story, index) => (
        <article className={`read-story read-story--${story.tone}`} key={story.slug}>
          <div className="read-story-index">{String(index + 1).padStart(2, "0")}</div>
          {story.imageUrl ? <MediaFrame variant="editorial" frameClassName="read-story-media" src={story.imageUrl} alt={story.imageAlt || `${story.title} artwork`} width={1200} height={900} sizes="(max-width: 760px) 100vw, 36vw" /> : null}
          <div className="read-story-copy">
            <span>{story.type} · {story.readTime}</span>
            <h2><a href={`/read/${story.slug}`}>{story.title}</a></h2>
            <p>{story.deck}</p>
            <small>By {story.byline}{story.publishedAt ? ` · ${new Date(story.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
