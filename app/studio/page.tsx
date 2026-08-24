"use client";

import { FormEvent, useState } from "react";
import { editorialApi } from "@/lib/editorial-api";

type Post = { id: string; title: string; slug: string; status: "draft" | "published"; updated_at: string };
type CopyItem = { content_key: string; value: string; updated_at: string };

const initialPost = {
  title: "",
  slug: "",
  deck: "",
  byline: "",
  type: "Editorial",
  tone: "paper",
  image_url: "",
  image_alt: "",
  body_markdown: "",
  status: "draft",
};

async function readResponse(response: Response) {
  const body = await response.text();
  try {
    return JSON.parse(body) as { error?: string; [key: string]: unknown };
  } catch {
    return {};
  }
}

function requestError(response: Response, data: { error?: string }) {
  if (response.status === 404) return "This Studio deployment has no publishing service. Deploy the Worker and database before you sign in.";
  return data.error ?? "The Studio request could not be completed.";
}

export default function StudioPage() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Sign in to start a draft.");
  const [post, setPost] = useState(initialPost);
  const [posts, setPosts] = useState<Post[]>([]);
  const [copy, setCopy] = useState<CopyItem[]>([]);
  const [copyKey, setCopyKey] = useState("home.hero.eyebrow");
  const [copyValue, setCopyValue] = useState("");
  const [session, setSession] = useState("");

  const editorRequest = (path: string, init: RequestInit = {}, token = session) => fetch(editorialApi(path), {
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { "x-lowkal-editor-session": token } : {}) },
  });

  const loadDesk = async (token = session) => {
    const [postsResponse, copyResponse] = await Promise.all([editorRequest("/api/editor/posts", {}, token), editorRequest("/api/editor/site-copy", {}, token)]);
    if (!postsResponse.ok || !copyResponse.ok) throw new Error("Your editor session has ended.");
    setPosts((await postsResponse.json()).posts ?? []);
    setCopy((await copyResponse.json()).items ?? []);
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("Checking…");
    try {
      const response = await fetch(editorialApi("/api/editor/session"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await readResponse(response);
      if (!response.ok) return setMessage(requestError(response, data));
      const token = typeof data.token === "string" ? data.token : "";
      if (!token) return setMessage("The publishing service did not return an editor session.");
      setPassword("");
      await loadDesk(token);
      setSession(token);
      setReady(true);
      setMessage("You’re in. Nothing goes public until you publish it.");
    } catch (error) {
      setMessage(error instanceof Error ? `Could not open the desk: ${error.message}` : "Could not open the desk.");
    }
  };

  const savePost = async (status: "draft" | "published") => {
    setMessage(status === "published" ? "Publishing…" : "Saving draft…");
    const response = await editorRequest("/api/editor/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...post, status }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Could not save that piece.");
    setPost(initialPost);
    await loadDesk();
    setMessage(status === "published" ? "Published. It is now in the Read room." : "Draft saved. It remains private.");
  };

  const saveCopy = async (event: FormEvent) => {
    event.preventDefault();
    const response = await editorRequest("/api/editor/site-copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: copyKey, value: copyValue }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Could not save that copy.");
    setCopyValue("");
    await loadDesk();
    setMessage(`Saved ${data.key}.`);
  };

  if (!ready) {
    return <main className="studio-page"><section className="studio-login"><span className="section-kicker">Lowkal / Editorial desk</span><h1>A quiet room for putting things out.</h1><p>Draft first. Read it back. Publish only when it is ready for the city.</p><form onSubmit={signIn}><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit">Open the desk</button></form><p className="studio-status" role="status">{message}</p></section></main>;
  }

  return (
    <main className="studio-page">
      <header className="studio-header"><span className="section-kicker">Lowkal / Editorial desk</span><h1>Make the next thing worth staying with.</h1><p className="studio-status" role="status">{message}</p></header>
      <section className="studio-grid">
        <form className="studio-composer" onSubmit={(event) => { event.preventDefault(); void savePost("draft"); }}>
          <div className="studio-section-head"><span>Editorials</span><small>Drafts stay private. Published pieces appear in Read.</small></div>
          <label>Title<input value={post.title} onChange={(event) => setPost({ ...post, title: event.target.value })} required /></label>
          <label>Slug<input value={post.slug} onChange={(event) => setPost({ ...post, slug: event.target.value })} placeholder="leave blank to make one from title" /></label>
          <label>Deck<textarea value={post.deck} onChange={(event) => setPost({ ...post, deck: event.target.value })} required rows={3} /></label>
          <div className="studio-pair"><label>Byline<input value={post.byline} onChange={(event) => setPost({ ...post, byline: event.target.value })} required /></label><label>Type<input value={post.type} onChange={(event) => setPost({ ...post, type: event.target.value })} /></label></div>
          <div className="studio-pair"><label>Image URL<input type="url" value={post.image_url} onChange={(event) => setPost({ ...post, image_url: event.target.value })} /></label><label>Image description<input value={post.image_alt} onChange={(event) => setPost({ ...post, image_alt: event.target.value })} /></label></div>
          <label>Story <small>Plain text and Markdown are welcome.</small><textarea value={post.body_markdown} onChange={(event) => setPost({ ...post, body_markdown: event.target.value })} required rows={15} /></label>
          <div className="studio-actions"><button type="submit">Save draft</button><button type="button" className="studio-publish" onClick={() => void savePost("published")}>Publish to Read</button></div>
        </form>
        <aside className="studio-side">
          <section><div className="studio-section-head"><span>Published & drafts</span><small>{posts.length} pieces</small></div><ol className="studio-list">{posts.map((item) => <li key={item.id}><span>{item.status}</span><strong>{item.title}</strong><small>/{item.slug}</small></li>)}</ol></section>
          <form className="studio-copy" onSubmit={saveCopy}><div className="studio-section-head"><span>Site copy</span><small>Short, named UI text only.</small></div><label>Content key<input value={copyKey} onChange={(event) => setCopyKey(event.target.value)} /></label><label>New wording<textarea value={copyValue} onChange={(event) => setCopyValue(event.target.value)} rows={3} required /></label><button type="submit">Save site copy</button><ol className="studio-list">{copy.map((item) => <li key={item.content_key}><strong>{item.content_key}</strong><small>{item.value}</small></li>)}</ol></form>
        </aside>
      </section>
    </main>
  );
}
