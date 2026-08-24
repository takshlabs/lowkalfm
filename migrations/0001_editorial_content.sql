CREATE TABLE IF NOT EXISTS editorial_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  deck TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  byline TEXT NOT NULL,
  type TEXT NOT NULL,
  image_url TEXT,
  image_alt TEXT,
  tone TEXT NOT NULL DEFAULT 'paper' CHECK (tone IN ('paper', 'red', 'signal', 'ink')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS editorial_posts_publication_idx
  ON editorial_posts (status, published_at DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS site_copy (
  content_key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
