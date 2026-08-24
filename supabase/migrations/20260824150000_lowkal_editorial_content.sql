CREATE TABLE public.editorial_posts (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  deck text NOT NULL,
  body_markdown text NOT NULL,
  byline text NOT NULL,
  type text NOT NULL,
  image_url text,
  image_alt text,
  tone text NOT NULL DEFAULT 'paper' CHECK (tone IN ('paper', 'red', 'signal', 'ink')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX editorial_posts_publication_idx
  ON public.editorial_posts (status, published_at DESC, updated_at DESC);

CREATE TABLE public.site_copy (
  content_key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE public.lowkal_editor_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret_hash text NOT NULL
);

INSERT INTO public.lowkal_editor_config (singleton, secret_hash)
VALUES (true, 'c7e5365bbdba7058b927d6e2b80833074cc5476d48c1e7183c74591c86e1953d');

ALTER TABLE public.editorial_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_copy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lowkal_editor_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.editorial_posts FROM anon, authenticated;
REVOKE ALL ON TABLE public.site_copy FROM anon, authenticated;
REVOKE ALL ON TABLE public.lowkal_editor_config FROM anon, authenticated;
