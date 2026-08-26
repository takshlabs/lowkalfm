# Lowkal.fm design direction

## Purpose

Lowkal.fm is a living programme board for multi-genre, low-end-focused music from Bengaluru. The site must help a visitor play a session, understand a Lowkal programme, find the archive, and see what comes next.

The page can use the content rhythm of Rinse FM as a reference. It must not copy the Rinse identity. Lowkal must use its own programme names, artwork, people, language, and visual character.

## Brand principles

- Put real sessions, artists, programmes, and gatherings before brand statements.
- Use the Lowkal wordmark, vermilion red, black, warm paper, and original artwork.
- Treat each numbered Lowkal programme as a container for its sets, photographs, and event record.
- Make the site feel active with horizontal shelves and useful playback controls.
- Keep copy short, specific, and direct.
- Show a live state only when a programme is live.
- Use existing session photography and original event graphics. Do not use generic electronic-music imagery.

## Prohibited direction

- Do not use radio tuning controls, frequency numbers, scan lines, oscilloscope graphics, or fake meters.
- Do not use acid-lime as a brand colour.
- Do not use “signal,” “transmission,” “portal,” or fake 24-hour broadcast language in public copy.
- Do not use a large floating control console.
- Do not use generated underground-techno images.

## Visual system

- **Ink:** near-black for the primary surface and type.
- **Lowkal red:** vermilion for programme markers, actions, and strong section changes.
- **Paper:** warm off-white for archive and editorial surfaces.
- **Supporting colour:** colours from programme artwork can appear inside the artwork only.
- **Shape:** square or lightly softened image cards. Use pills only for small filters or tags.
- **Motion:** horizontal shelf movement, simple image transitions, and playback progress only.

## Typefaces

Four faces, each with one job. All four are self-hosted from `public/fonts`, so
the site never depends on a font CDN. Each role is reached through a token, not
by naming the family in a component.

| Role | Face | Token | Used for |
| --- | --- | --- | --- |
| Headline | Lancelot | `--font-display` | Page and section headlines |
| Editorial title | Marcellus | `--font-title` | Artist lines, decks, card titles |
| Mark | Notable | `--font-mark` | The wordmark, programme numbers, index numerals |
| Interface | Philosopher | `--font-ui` | Body copy, labels, controls, metadata |

Notable carries the heavy, direct voice the wordmark needs. Lancelot and
Marcellus are calligraphic, so they take neutral to open tracking. Never apply
the tight negative tracking that suits a grotesque.

The wordmark scripts use micro-subsets of Noto Serif Devanagari, Kannada, and
Bengali that contain only the glyphs for "lowkal".

## Stylesheet architecture

`app/globals.css` is an index. It declares four cascade layers and imports the
parts in order:

    tokens → base → components → utilities

Utilities sit last so a shared primitive such as `.section-kicker` or `.label`
always wins over a component rule on the same element. No rule should ever
raise its specificity to be heard.

Every colour, size, space, radius, shadow, duration, and easing curve lives in
`app/styles/tokens.css`. Component styles read tokens. They do not invent
values.

## Home page structure

1. A compact shared header with direct links to Soundroom, Archive Room, Read, and Go Out.
2. A “Latest session” stage with real artwork, artist, programme, date, genres, and play action.
3. A numbered programme rail for Lowkal editions.
4. A horizontal recent-session shelf.
5. A programme archive section that keeps related sets together.
6. A gathering and field-note area only when real content exists.
7. A direct footer with social, contact, and listening links.

## Playback

- Keep one audio authority for the main site, Archive Room, and embedded Soundroom.
- Use a compact persistent player on the main site.
- Use a bottom dock on small screens.
- Show “Playing” only during playback. Use “Ready” or “Latest session” when paused.

## Content voice

Use short factual phrases such as:

- “Multi-genre. Low-end focused. From Bengaluru.”
- “Latest session.”
- “Watch the full session.”
- “Open Archive Room.”
- “Who played. Where it happened. What comes next.”

Use Bengaluru in current public copy. Keep programme names exactly as published by Lowkal.
