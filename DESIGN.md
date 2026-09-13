# Lowkal.fm design record

This file records the live site at `https://lowkalfm.in`. The current public look is the source of truth. Do not restyle Soundroom, the compact player, the home fold, or the archive to match an older brief.

## Purpose

Lowkal.fm is independent radio, records, and city culture from Bengaluru. The site lets a visitor play a session, enter Soundroom, browse the archive, read, and go out.

## Brand marks

- Wordmark: `LOWKAL.FM` in Arial Black.
- Scripts in the header: `लोकल / ಲೋಕಲ್ / লোকাল`.
- Logo: `/lowkal-logo.jpg` in a square media frame.
- Public voice: short, specific, Bengaluru-facing. Programme names stay as published.

## Colour

Taken from the live cascade in `app/reimagined.css` and `app/globals.css`.

| Token | Value | Use |
| --- | --- | --- |
| Black | `#0e0e0d` | Header, home, Soundroom, player, PWA theme |
| Paper | `#f1eadb` | Archive, Read, Go out, body on paper surfaces |
| Red | `#f04437` | Actions, kickers, current nav, waveform progress, pins |
| Red dark | `#9f201c` | Pressed or deep red |
| Charcoal | `#191918` | Recessed night surfaces |
| Dust | `#c7bead` | Quiet metadata on paper |
| Muted | `#696459` | Secondary copy on paper |
| Night ink | paper on black | Inverse type |

Selection colour is paper on red. Do not introduce acid-lime or a second brand red.

## Type

Load Kilimanjaro Sans, Kilimanjaro Sans Tall, and Kilimanjaro Sans Round2 from `/fonts`. Use Kilimanjaro for headings, body, UI copy, and Soundroom. Keep Arial Black only on the `LOWKAL.FM` lockup. Fallbacks: `"Arial Black", Arial, sans-serif`.

Display lines are heavy, tight, and often uppercase. Metadata is small, tracked, and uppercase only for kickers.

## Shape and media

- Cards are square or lightly softened. Pills are for tags and filters only.
- Every image sits in `MediaFrame`. Do not place a raw image on the page.
- Hero and editorial frames may crop. Record art in the player is a small square.
- Motion is shelf scrolling, simple image transitions, and playback progress.

## Chrome

- Sticky black header with logo, scripts, and text links: Soundroom, Archive, Read, Go out. The current page is red.
- Skip link to `#main-content`.
- Compact persistent player on every listed route. Soundroom, Studio, and Desk hide it.
- Footer: `LOWKAL.FM`, “From Bengaluru.”, the same destinations, Instagram, YouTube, Contact.
- Phone player is a bottom dock. Keep body padding so content clears it.
- Safe-area insets on phone chrome.

## Home

The live home is the rinse-style night fold. Keep it.

1. Full-bleed hero: “Lowkal.fm · Bengaluru”, “The city has a frequency.”, “Independent radio from Bengaluru.”, “Enter soundroom”, flower artwork.
2. Channel row: Listen · 93.5, Read, Go out, Archive, with spectrum bars and indexes `01` `02` `03` `AR`.
3. Latest shelf: artwork cards with a corner play control, `BLR · 00` stamp, artist, series, title, genre tags. Desktop arrows. Phone swipe.
4. From the city: three editorial cards to Read, Go out, and Archive.
5. Open call: “Submissions open” and the hello@lowkal.fm mail link.

Home is black. Latest cards keep a large tappable play control on phones.

## Listen

- `/listen` is Soundroom: a full-viewport iframe of `/soundroom/index.html`. No site header, footer, or mini player.
- One audio authority in `AudioProvider` for the site, archive, artist pages, and Soundroom commands.
- Cloudflare audio is the native source. YouTube is only for mixes that have no Cloudflare file.
- Waveform seek is the approved progress control on the compact player and artist focus player. It is playback progress, not radio theater.
- Status copy: Playing, Paused, Loading, Unavailable, Playback error.
- PWA: standalone, theme `#0e0e0d`, media bypass in the service worker, no update reload while audio is active.

## Archive

`/listen/archive` is a paper archive room: programme / resident / guest catalogues, vinyl record scroller, and a desk for the selected mix.

## Read

Paper journal. Honest empty state when no stories exist. A published story opens at `/read/{slug}` in the same Read shell. Do not show an under-construction banner.

## Go out

A Bengaluru map of artist hangouts. Pins come from published artist field notes that have coordinates or a parseable map URL. Selecting a pin shows the place, the artist, and the note. Link back to the artist file. Honest empty map when no pin is ready. Do not invent nights.

## Artists

`/artists` is the directory. `/artists/{slug}` is the artist file in the same shell. Construction notes may remain on artist pages until those profiles are finished.

## Desk and Studio

- `/desk` is unlisted. No header, footer, or player. `noindex`.
- `/studio` is the Sanity CMS. Keep it off public navigation.

## Content rules

- Public mixes, programmes, artists, and stories come from published Sanity documents.
- Parked mixes stay in the CMS and stay off every public listen surface.
- Do not paint a local demo catalogue, fake tracklists, or placeholder YouTube sessions on the public site.
- If Sanity is empty or unavailable, show an honest empty or unavailable state.

## Production

The only public site is `https://lowkalfm.in`. Do not restyle from a GitHub Pages preview, a `chatgpt.site` URL, or an older deployment alias.
