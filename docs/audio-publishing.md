# Audio publishing

The Lowkal site and CMS run at `https://lowkalfm.vercel.app`. Cloudflare R2 stores and delivers published audio. It does not host the site.

## Current status

The CMS has the WAV master upload field. The automatic R2 copy starts only after the Cloudflare Worker and Sanity webhook in `docs/deployment.md` are configured. Until then, the player uses the Sanity file URL as a safe fallback.

## Editor workflow

1. Open the mix in Lowkal CMS at `https://lowkalfm.vercel.app/studio`.
2. Open **Playback**, then **Audio**.
3. Upload the lossless master to **WAV master**.
4. Publish the mix.
5. After R2 configuration, wait for **CDN delivery URL** to appear.

Use a new upload when you replace a master. The R2 key contains the Sanity asset ID. This prevents an old cached file from being used.
