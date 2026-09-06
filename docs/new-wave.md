# Lowkal New Wave

This design is on `codex/lowkal-new-wave`.

## Design

The site uses a warm paper background, blue controls, green panels, and large type. A CSS record illustration introduces the home page. Session cards retain their playback controls. The home page connects the soundroom, journal, city guide, and artist directory.

Shared styles cover navigation, the archive, editorial pages, artist pages, and the persistent player. The standalone soundroom has a separate style sheet with the same colours. Its player, tracklists, shader controls, and catalogue messages retain their existing code.

The CMS, audio sources, content records, and publishing setup are unchanged. The audio provider now accepts a partially loaded YouTube player. It checks that each method exists before it calls the method.

## Checks

- `npm run check`: lint, TypeScript, build, and 22 tests.
- Browser checks at desktop and 390 px mobile widths.
- Home, archive, Read, Go out, artists, and soundroom routes.
- Archive next-record selection and playback controls.

Push this branch for review. A merge to `main` is a separate production release.
