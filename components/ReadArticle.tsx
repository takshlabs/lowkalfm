"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";

type Post = {
  slug: string;
  title: string;
  deck: string;
  body_markdown: string;
  byline: string;
  type: string;
  image_url: string | null;
  image_alt: string | null;
  published_at: string | null;
};

function paragraphs(markdown: string) {
  return markdown.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
}

export function ReadArticle() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<"loading" | "missing">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/content/read", { signal: controller.signal })
        .then(async (response) => response.ok ? response.json() : null)
        .then((data: { posts?: Post[] } | null) => {
          const found = data?.posts?.find((item) => item.slug === slug) ?? null;
          setPost(found);
          setState(found ? "loading" : "missing");
        })
        .catch(() => setState("missing"));
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [slug]);

  if (!post) return <main className="reader-page"><p className="reader-status">{state === "loading" ? "Opening the piece…" : "This page is not here yet."}</p></main>;

  return (
    <main className="reader-page">
      <article className="reader-article">
        <SiteLink className="reader-back" href="/read">← Back to Read</SiteLink>
        <span className="section-kicker">{post.type}</span>
        <h1>{post.title}</h1>
        <p className="reader-deck">{post.deck}</p>
        <p className="reader-byline">By {post.byline}{post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}</p>
        {post.image_url ? <MediaFrame variant="editorial" frameClassName="reader-media" src={post.image_url} alt={post.image_alt || `${post.title} artwork`} width={1600} height={1067} sizes="(max-width: 800px) 100vw, 900px" /> : null}
        <div className="reader-body">{paragraphs(post.body_markdown).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </article>
    </main>
  );
}
