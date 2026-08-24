"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "@portabletext/types";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sanityClient, storiesQuery } from "@/lib/sanity";

type Post = {
  slug: string;
  title: string;
  deck: string;
  body: PortableTextBlock[];
  byline: string;
  type: string;
  imageUrl: string | null;
  imageAlt: string | null;
  publishedAt: string | null;
};

const portableTextComponents: PortableTextComponents = {
  block: { blockquote: ({ children }) => <blockquote>{children}</blockquote> },
  types: {
    pullQuote: ({ value }) => <blockquote className="reader-pullquote">{value.quote}{value.attribution ? <cite>— {value.attribution}</cite> : null}</blockquote>,
    audioEmbed: ({ value }) => <figure className="reader-audio"><figcaption>{value.title}</figcaption><audio controls src={value.url}><track kind="captions" srcLang="en" label="English" src={value.captionsUrl ?? "data:text/vtt,WEBVTT"} />Your browser cannot play this audio.</audio>{value.caption ? <small>{value.caption}</small> : null}</figure>,
    callout: ({ value }) => <aside className="reader-callout">{value.heading ? <strong>{value.heading}</strong> : null}<p>{value.text}</p></aside>,
    image: ({ value }) => value.asset?.url ? <MediaFrame variant="editorial" frameClassName="reader-inline-media" src={value.asset.url} alt={value.alt || "Editorial image"} width={1600} height={1067} /> : null
  }
};

export function ReadArticle() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<"loading" | "missing">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void sanityClient.fetch<Post[]>(storiesQuery, {}, { signal: controller.signal })
        .then((posts) => {
          const found = posts.find((item) => item.slug === slug) ?? null;
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
        <p className="reader-byline">By {post.byline}{post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}</p>
        {post.imageUrl ? <MediaFrame variant="editorial" frameClassName="reader-media" src={post.imageUrl} alt={post.imageAlt || `${post.title} artwork`} width={1600} height={1067} sizes="(max-width: 800px) 100vw, 900px" /> : null}
        <div className="reader-body"><PortableText value={post.body} components={portableTextComponents} /></div>
      </article>
    </main>
  );
}
