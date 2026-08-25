# Lowkal Soundroom, Editorial Studio, and Media System Implementation Plan

> **For Hermes:** Implement in small test-first slices. Preserve the existing listening catalogue and do not introduce unauthenticated content writes.

**Goal:** Make playback strictly user-initiated, give the isolated Soundroom a complete return path, replace raw media treatment with a reusable Lowkal image frame, establish a premium native Read experience backed by a secure editorial/site-copy studio, and remove generic/generated-sounding public copy.

**Architecture:** Keep the public site fast and server-rendered. Move editable editorial posts and page copy to Cloudflare D1 behind password-gated editor APIs using a signed HttpOnly session cookie; keep a safe static seed fallback so deploys remain readable before the first publication. A single reusable `MediaFrame` component owns image composition, overlay, focal treatment, and accessible media semantics across React routes. The legacy iframe Soundroom gets its own lightweight navigation strip and receives no ambient/autoplay trigger.

**Tech stack:** Vinext/React 19, Cloudflare Worker/D1, Web Crypto, TypeScript, Node test runner, Next-compatible image renderer.

---

## Confirmed current state

- The live site source is `/Users/saswat.biswas/Documents/TakshLabs/Lowkal`; the chat working directory is an empty git repository and must not be edited.
- `/listen` is an isolated `public/soundroom/index.html` iframe, so its internal UI does not inherit `SiteHeader` navigation.
- `AudioProvider` already declares YouTube `autoplay: 0`, but it restores a previously selected record and `playRecord()` intentionally starts a selection. The floating player itself also carries the unwanted `Live signal` label and its captions use 0.44–0.59rem at phone width.
- Read and Go Out are hard-coded in `lib/content.ts`; no database/storage binding is configured (`.openai/hosting.json` has `d1: null`, `r2: null`).
- Current Read stories are excerpt-only. Image use is raw `Image` use at the home listening feature, Soundroom catalogue, and floating player.

## Product decisions embodied by this plan

1. **No automatic audio.** Opening a page or restoring a remembered record may select it and restore its time, but must never call `playVideo()` until a person presses Play. Selecting an archive record changes the record only; the explicit play control starts it.
2. **Soundroom navigation:** add an on-brand, always-visible internal strip: `Lowkal.fm` (home), `Read`, `Go out`, and a labeled `Back to home`. Links target the parent site (`../`, `../read`, `../go-out`) so they work inside the iframe and on static hosting.
3. **Media grammar:** every meaningful image is raised in a restrained, asymmetrical editorial frame: dark recessed edge, paper/keyline, tinted guard/gradient, caption space where context matters, and no text over critical image content. Decorative thumbnails may use the compact variant; large media uses a poster variant. Images must never appear as raw unframed rectangles.
4. **Publishing:** `/studio` is not public content. It requires a secret configured in Cloudflare as `LOWKAL_EDITOR_SECRET`; the login produces a short-lived signed HttpOnly cookie. Posts have draft/published state. UI copy is editable as named content blocks, with a clear fallback to seed copy.
5. **No fake editorial claims.** Existing placeholder stories/events are converted into clearly marked example/seed content until a real editor publishes. New editorial UI never invents dates, reporting, quotes, or scene participation.

---

### Task 1: Establish a testable content-domain boundary

**Objective:** Define the pure data model, validation, slug generation, reading-time calculation, content-block keys, and static fallback data before adding storage/UI.

**Files:**
- Create: `lib/editorial.ts`
- Create: `lib/site-copy.ts`
- Create: `tests/editorial.test.mjs`
- Modify: `lib/content.ts`

**Steps:**
1. Add a failing test for normalized editorial input: required title/deck/body/byline/type, stable slug, safe `draft|published` status, optional image URL, and a non-negative reading time.
2. Run `node --test tests/editorial.test.mjs`; confirm RED because the module does not exist.
3. Implement pure validation/normalization without database imports; use generated plain-text excerpts and a conservative reading-time estimate.
4. Re-run the focused test (GREEN).
5. Add failing tests for known site-copy keys and fallback behavior when a database record is absent; implement the pure `getCopy`/merge helper; re-run GREEN.
6. Replace placeholder claims in `lib/content.ts` with labeled seed data only; do not present seed stories as reported journalism.

**Verification:** `node --test tests/editorial.test.mjs` passes; no production code accepts arbitrary status, slug, or image protocol.

### Task 2: Add secure D1 configuration and migrations

**Objective:** Create the durable publication store and explicitly document the one-time Cloudflare binding steps without embedding credentials.

**Files:**
- Create: `migrations/0001_editorial_content.sql`
- Create: `lib/editorial-store.ts`
- Create: `docs/editorial-studio-operations.md`
- Modify: `worker/index.ts`
- Modify: `vite.config.ts`
- Modify: `.openai/hosting.json` only after a real D1 binding is provisioned
- Modify: `tests/editorial.test.mjs`

**Schema:**
- `editorial_posts`: UUID/text id, unique slug, title, deck, body_markdown, body_html, byline, type, image_url, image_alt, tone, status, published_at, created_at, updated_at.
- `site_copy`: unique key, value JSON/text, updated_at.
- indexes for `status,published_at` and `slug`.

**Steps:**
1. Add a failing test against an injected store interface proving published posts are ordered newest-first and drafts are invisible in public reads.
2. Implement a store interface plus static/seed implementation so development and build work without a bound D1 database.
3. Add the D1 adapter with parameterized queries only; no client browser can receive a D1 binding.
4. Write migration SQL with constraints/defaults and source it in operations docs.
5. Add exact deployment instructions: create/bind the D1 database, set `LOWKAL_EDITOR_SECRET` as a Worker secret, apply migration, verify `/api/health/content` returns only non-sensitive binding status. Do not place real IDs/secrets in git.
6. Run focused tests RED→GREEN and build with no D1 configured, proving the safe fallback works.

**Verification:** Public store returns seed data when D1 is absent; test double proves drafts cannot leak.

### Task 3: Implement authenticated Studio session and APIs

**Objective:** Provide a secure, minimal API boundary for editor login, post CRUD/publish, and site-copy updates.

**Files:**
- Create: `lib/editor-session.ts`
- Create: `app/api/studio/session/route.ts`
- Create: `app/api/studio/posts/route.ts`
- Create: `app/api/studio/posts/[id]/route.ts`
- Create: `app/api/studio/site-copy/route.ts`
- Create: `app/api/health/content/route.ts`
- Modify: `worker/index.ts` / runtime Env typing as needed
- Modify: `tests/editorial.test.mjs`

**Steps:**
1. Write failing tests for: missing/invalid credentials receive 401; valid signed session is required for every write; public API never lists drafts; logout clears the cookie.
2. Implement secret-based login with `crypto.subtle` signing and verification, `HttpOnly`, `Secure`, `SameSite=Strict`, scoped-path, and short max-age cookies.
3. Implement POST/PATCH/DELETE with JSON size caps, strict origin checks for mutations, normalization from Task 1, parameterized store calls, and explicit error bodies.
4. Implement publish/unpublish as status transitions; never silently publish an incomplete post.
5. Add tested `GET /api/health/content` which exposes only `{ configured: boolean }`—not database IDs, secrets, or stack traces.
6. Re-run focused tests until green.

**Verification:** A direct unauthenticated POST cannot alter posts/copy; authenticated test session can create draft then publish it; cookie never appears in response JSON.

### Task 4: Build the native Read reader and premium editorial stream

**Objective:** Replace excerpt-only Read cards with a compact publication stream and a quiet, sensory individual reading lane.

**Files:**
- Create: `app/read/[slug]/page.tsx`
- Create: `components/EditorialStream.tsx`
- Create: `components/EditorialReader.tsx` only if client-side reader controls are needed
- Modify: `app/read/page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Steps:**
1. Add failing rendered HTML tests for `/read`, a real seeded `/read/[slug]`, headline link semantics, provenance, and unavailable-slug 404 handling.
2. Implement server loaders using the store’s public API only.
3. Render Read as a dense editorial stream: headline-first links, byline/date/read time, restrained dividers, optional framed media, and no `details`-based excerpt-as-reader pattern.
4. Build `/read/[slug]` with clear source/byline/date, a narrow readable column, image/caption separation, markdown rendered through an allowlisted sanitizer, and a deliberate `Back to Read` link.
5. Ensure home Read items link to actual story routes.
6. Update CSS at desktop and phone sizes; no equal-height empty card rows, no raw image rectangles, no generic content controls.

**Verification:** targeted server-render tests pass; browser-check stream and a long post at desktop and 390px width.

### Task 5: Build the Studio interface

**Objective:** Give the Lowkal editor a working in-product publishing and UI-copy control room.

**Files:**
- Create: `app/studio/page.tsx`
- Create: `components/StudioLogin.tsx`
- Create: `components/EditorialComposer.tsx`
- Create: `components/SiteCopyEditor.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Steps:**
1. Add failing component/server tests for the locked Studio shell, editor inputs, save-draft feedback, publish confirmation, and editable known copy keys.
2. Implement the locked screen with no claim that a session exists.
3. Implement a comfortable composer: title, deck, byline, type, image URL/alt, markdown body, draft/save, preview, and publish/unpublish. Preview uses the exact reader typography but cannot mutate public data.
4. Add a site-content view that edits a bounded list of named keys (homepage hero/CTA, portal text, Read hero, Go Out hero, footer). Do not offer arbitrary page-source editing.
5. Add clear success/error states and preserve unsaved form text on temporary request errors.
6. Do not link Studio from public primary nav; access is by `/studio` for editors.

**Verification:** login, draft save, preview, publish, public refresh, and UI-copy update are exercised locally with a test store; build remains healthy without a production D1 binding.

### Task 6: Introduce the reusable Lowkal media frame

**Objective:** Eliminate raw image embeds across React UI and make each image feel intentionally housed, without obscuring its content.

**Files:**
- Create: `components/MediaFrame.tsx`
- Modify: `components/HomeListenModule.tsx`
- Modify: `components/SoundroomCatalog.tsx`
- Modify: `components/PersistentPlayer.tsx`
- Modify: `components/SiteHeader.tsx` only where the brand mark needs the compact treatment
- Modify: `components/EditorialStream.tsx`
- Modify: `app/read/[slug]/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Steps:**
1. Add a failing test proving semantic media uses `MediaFrame` and that decorative artwork stays `alt=""` while editorial images require meaningful alt text.
2. Implement `MediaFrame` variants: `hero`, `editorial`, `record`, and `mark`; use `object-fit: cover` only for intentional art/thumbnail crops and preserve editorial image context with a bounded `object-contain` variant where needed.
3. Add the Lowkal frame: a recessed ink mount, offset paper rule, controlled colour wash, and optional caption—not a rounded generic card.
4. Migrate every current React `Image` call into the shared primitive. Keep no raw `<img>` outside third-party/static Soundroom or framework output.
5. Re-run the source-pattern test and ensure zero non-exempt direct semantic image imports remain.

**Verification:** visual browser checks on home, Read, story page, Soundroom catalogue, and floating player at desktop/mobile; artwork stays legible and is not clipped unexpectedly.

### Task 7: Repair the floating player contract and visual readability

**Objective:** Make the global player calm, legible, and fully user-controlled.

**Files:**
- Modify: `components/AudioProvider.tsx`
- Modify: `components/PersistentPlayer.tsx`
- Modify: `app/globals.css`
- Modify: `tests/audio-provider.test.mjs`

**Steps:**
1. Add failing tests that mount/state-test the provider contract: persisted record/time may restore but initial state is paused; playback only follows explicit `playRecord`/toggle; player has no `Live signal` string.
2. Keep YouTube `autoplay: 0`; remove any path that invokes playback during hydration/restoration.
3. Clarify action labels: `Play`/`Pause`, record name, artist/title, duration. Replace the tiny “Now playing” and status treatment with readable 0.68–0.85rem supporting text and 1.25rem+ primary identity while preserving one-line truncation safely.
4. Remove `.player-signal` JSX and CSS completely; adjust desktop/mobile layout to use the released vertical space and keep all controls visible.
5. Ensure screen reader state remains concise (`aria-live` only for track/play state changes, not every second of timeline updates).
6. Run RED→GREEN focused tests.

**Verification:** local browser test records no `playVideo()` until a user Play click, `Live signal` has zero live-source matches, and the player remains readable at 390px width.

### Task 8: Give the legacy Soundroom an honest Lowkal return path and remove generic/generated treatment

**Objective:** Modernize the standalone Soundroom enough that it feels connected to Lowkal, while preserving its separate immersive player.

**Files:**
- Modify: `public/soundroom/index.html`
- Modify: `public/soundroom/mixes.json` only for verified real metadata supplied by the editor
- Modify: `tests/rendered-html.test.mjs`

**Steps:**
1. Add a failing source test for internal links to Home, Read, and Go Out plus a `Back to home` label; assert no `<audio autoplay>` or programmatic startup occurs on document load.
2. Replace “Connected Abstract Player,” “distraction-free digital canvas,” “manifesto,” fabricated status labels, and similar generic/AI-sounding language with concise Lowkal language grounded in actual available material.
3. Add an accessible top navigation strip compatible with the iframe: brand/home link, Read, Go out, and back home. Preserve keyboard focus and use a regular cursor on touch/keyboard-friendly controls; do not hide OS cursor globally for all contexts.
4. Give the cover and mini-artwork a framed record treatment consistent with `MediaFrame` (implemented as dedicated static HTML/CSS because the iframe is not React).
5. Ensure no play function runs from initialization/loading. Existing buttons remain the only path to start audio.
6. Test desktop and mobile iframe routes in a browser.

**Verification:** `/listen` contains and follows all return links; first load is visually paused; user presses play to start.

### Task 9: Human editorial copy pass and project-wide audit

**Objective:** Replace product-generic language without inventing facts, and centralize all new editable public copy.

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/read/page.tsx`
- Modify: `app/go-out/page.tsx`
- Modify: `components/SiteFooter.tsx`
- Modify: `components/HomeListenModule.tsx`
- Modify: `lib/content.ts`
- Modify: `lib/site-copy.ts`
- Modify: `public/soundroom/index.html`

**Rules:**
- Prefer concrete invitations and present-tense community language over “signal,” “architecture,” “transmission,” “experience,” and unverified scene claims.
- Use “Lowkal” speaking as a local host only where accurate; do not fabricate programmes, events, artists, dates, quotes, or reportage.
- Maintain concise, human labels: e.g. `Latest mix`, `Play`, `From the journal`, `What’s on`, `Send us a tip`.
- Replace hard-coded public hero/footer/CTA strings with named copy keys so Studio controls them.

**Verification:** source scan for banned/obsolete phrases reports only intentional historical metadata; new source output uses the copy resolver; browser review confirms reading hierarchy has not regressed.

### Task 10: Full verification, deployment readiness, and handoff

**Objective:** Prove behavior, visual safety, and operations before release.

**Commands:**
```bash
npm run lint
npm test
git diff --check
git status --short
```

**Browser checks:**
1. Home and Read at 1440px and 390px: no document horizontal overflow; every image has a proper Lowkal frame.
2. `/read/[seed-slug]`: readable measure, image/frame/caption flow, back link, unknown slug behavior.
3. `/listen`: start paused, press Play starts; navigation links lead to Home/Read/Go out; iframe has no broken focus/cursor behavior.
4. Floating player: no `Live signal`; record/time restoration does not play; text and play control are readable at mobile width.
5. Studio with configured local test secret/store: invalid login denied; draft remains non-public; publish appears in Read; a copy update appears on its associated page.

**Release prerequisites:**
- Provision the D1 binding and set the editor secret in the real Cloudflare environment.
- Apply `migrations/0001_editorial_content.sql`.
- Create one real draft and publish it through Studio before claiming the editorial CMS is live.
- Deploy only after checks pass and verify the live `/read`, `/listen`, and authenticated Studio flow. Do not claim deployment or live D1 persistence before these real environment steps succeed.
