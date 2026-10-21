# Lowkal production deployment

## Production service

- Production site and CMS: `https://lowkalfm.in`
- Vercel project: `lowkalfm`
- Vercel team: `takshlabs-projects`
- CMS: `https://lowkalfm.in/studio`
- Redirects: `https://www.lowkalfm.in` and `https://lowkalfm.vercel.app` redirect to `https://lowkalfm.in`
- Audio delivery: Cloudflare R2 with a Cloudflare custom domain

Do not use OpenAI Sites or a `chatgpt.site` URL for Lowkal. They are not Lowkal production services.

## Vercel release procedure

1. Check the active account with `npx vercel whoami`.
2. Check the project link in `.vercel/project.json`. It must name `lowkalfm`.
3. Run `npm run check`.
4. Commit the completed change on `main`.
5. Push with `git push origin main`.
6. Deploy the same commit with `npx vercel --prod --yes` when a manual production deployment is required.
7. Confirm the `lowkalfm.in` alias points to the new ready deployment with `npx vercel inspect <deployment-url>`.
8. Confirm that `www.lowkalfm.in` and `lowkalfm.vercel.app` redirect to `https://lowkalfm.in`.

Never run a production deployment command that targets OpenAI Sites.

### Static navigation and continuous audio

Vercel uses the Build Output API files made by `scripts/build-vercel-output.mjs` after the Vinext build. Keep this step in `vercel.json`.

- Requests with the `RSC: 1` header must receive the exported `.rsc` file, not the HTML page.
- The response must use `Content-Type: text/x-component` and the build's `X-Vinext-RSC-Compatibility-Id` header. The Vite plugin writes that ID for the output script.
- Normal page requests must still receive HTML. Artist detail routes use the exported artist shell.
- After deployment, start audio in Soundroom and open the archive with its link. Confirm that the same audio element remains mounted and its time advances. Then return to Soundroom. A saved position after a full-page reload is not continuous playback.

Check the deployed response with `curl -I -H 'RSC: 1' 'https://lowkalfm.in/listen/archive?_rsc=release-check'`.

## Vercel environment variables

Set these values in Vercel for Production, Preview, and Development:

- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `SANITY_API_PROJECT_ID`
- `SANITY_API_DATASET`
- `SANITY_API_READ_TOKEN`
- `SANITY_API_WRITE_TOKEN`
- `SANITY_STUDIO_PROJECT_ID`
- `SANITY_STUDIO_DATASET`

Use `npx vercel env ls production` to check variable names. Do not put secret values in Git or documentation.

## Cloudflare R2 audio setup

The audio Worker also serves `/listen-counts`. The total is verified historic website plays plus saved unique daily website plays plus YouTube views. Do not include YouTube views or saved website records in the `listenCount` history field. Its default is zero. Counts are stored in separate `mixPlayCount` documents. A CMS publish cannot reset these documents. Revision checks protect concurrent updates. Each component retains its largest saved value, so a service error or a lower source count cannot reduce the total.

The Worker reads the exact view count from the linked YouTube video's public page metadata. It checks the video ID before it uses the count. It refreshes this count at most once per hour per video across Worker instances. A shared revision-checked claim prevents duplicate refreshes. If the page is unavailable or its format changes, the Worker retains the saved count. An optional `YOUTUBE_API_KEY` secret selects YouTube Data API v3 `videos.list` instead. Keep this key in Cloudflare and out of the site bundle. A mix without a YouTube link has no YouTube views to add.

Native audio starts with a signed ticket. The ticket is valid after 30 seconds and expires after 30 minutes. The Worker stores one `mixWebListen` document per signed browser identity, mix, and UTC day. POST requests have a rate limit. An embedded YouTube play does not create a website play, because YouTube supplies its own views. Browser storage supplies the signed identity; clearing storage or using a different browser can create a new identity. The service cannot recover website plays that were never saved. It rejects browser count samples and does not use generated display counts.

Use `npm run counts:refresh` to refresh all visible published mixes and save their totals before a site release. This command uses the local Sanity write token and optional YouTube API key. It does not change historic baselines.

This setup is separate from the Vercel deployment.

### Active services

- R2 bucket: `lowkal-audio` (APAC location hint, Standard storage)
- Worker: `lowkal-audio-sync`
- Audio copy workflow: `lowkal-audio-copy`, bound as `AUDIO_SYNC`
- Current audio endpoint: `https://lowkal-audio-sync.lowkal-audio-737a.workers.dev`
- Sanity webhook: `Copy published mixes to Cloudflare R2` (production dataset, create and update events)

The R2 bucket is private. The Worker reads the audio objects and sends them to listeners with byte-range support. This is a Cloudflare CDN endpoint and does not change the Vercel site URL.

The account has no Cloudflare DNS zone for `lowkalfm.in`. Keep the current Worker endpoint until a separate audio subdomain is configured, then use a custom Worker route such as `audio.lowkalfm.in`.

1. Sign in to the Lowkal Cloudflare account.
2. Keep the Worker configuration in `wrangler.audio-sync.toml` aligned with the bucket name.
3. Use the Worker endpoint above for `AUDIO_PUBLIC_BASE_URL`.
4. Do not enable an `r2.dev` URL. It is not needed for this setup.
6. Add these Cloudflare Worker secrets. Do not store them in Vercel or Git:

   - `SANITY_WEBHOOK_SECRET`
   - `SANITY_API_PROJECT_ID`
   - `SANITY_API_DATASET`
   - `SANITY_API_WRITE_TOKEN`
   - `AUDIO_PUBLIC_BASE_URL` (for example, `https://audio.lowkalfm.in`)

7. Deploy the Worker with `npx wrangler deploy --config wrangler.audio-sync.toml`.
8. In Sanity Manage, keep the `Copy published mixes to Cloudflare R2` webhook enabled. It sends published `mix` updates to the Worker URL plus `/sanity/audio-sync`. Do not include drafts. Its secret must match `SANITY_WEBHOOK_SECRET`.
9. Use this webhook projection:

```groq
{
  _id,
  _type,
  "audioMasterUrl": audio.master.asset->url,
  "audioMasterFilename": audio.master.asset->originalFilename,
  "audioMasterId": audio.master.asset._ref,
  "audioSourceAssetId": audio.sourceAssetId
}
```

10. Publish a small test mix. Confirm that the mix document receives `audio.deliveryUrl`, then play the mix from `https://lowkalfm.in`.

The Worker checks the webhook signature, saves an audio copy job, and returns HTTP 202. The `lowkal-audio-copy` workflow copies the master after the publish request ends. This prevents the 30-second webhook timeout from stopping large file transfers. Each copy can run for 30 minutes and has three retries. Repeat publishes use the same job for the same mix and master. A new publish restarts an errored or terminated job.

The workflow copies WAV and FLAC masters to R2 and reads duration from the header. For WAV masters, it also calculates interval peaks and three frequency bands. It writes the delivery URL, duration, and WAV waveform URL in one update. For FLAC masters, it removes any old waveform URL. The browser plays the CDN URL directly. Vercel does not proxy the large audio file.

### Waveform generation

The Worker calculates 2,048 interval peaks and RMS energy for bass, mids, and highs from the WAV stream during audio sync. It uses first-order crossovers at 250 Hz and 2,000 Hz, with a 20 Hz high-pass. The three bands use one display scale. Each channel is measured separately to retain stereo energy. The version 2 sidecar uses a `.spectrum-v2.json` key, so cached version 1 data is not replaced. It copies the compact sidecar to R2 before it writes the public delivery URLs. The browser reads only this JSON to draw the waveform. It does not download or decode the WAV for this display. Playback uses the original WAV or FLAC file.

Use `npm run audio:peaks -- <mix-slug>` to repair one published mix. Use `npm run audio:peaks -- --all` to add spectrum data to published direct-audio mixes that do not have version 2 data. The script supports WAV and FLAC masters. FLAC measurement needs FFmpeg in the local PATH. It decodes the full FLAC stream to temporary PCM samples in memory with bounded buffers and preserves the original channel count and sample rate. It does not save a converted audio file or change the delivery URL. Both formats use the same 2,048 intervals and measured frequency bands. The script changes only the derived waveform URL and checks the current master and revision before the update. Keep `SANITY_API_WRITE_TOKEN` local; do not put it in browser code or Vercel.

## Troubleshooting

- Keep the Studio tab open until the audio file is saved. The master field shows the upload percentage. If no progress is saved for two minutes, it shows a warning. Cancel the incomplete upload and select the file again. Studio blocks publication while a master upload is incomplete. The warning does not cancel an upload automatically.
- If the CDN URL does not appear, check the Cloudflare Worker logs and the Sanity webhook delivery log.
- HTTP 202 confirms that the audio job is saved. Use `npx wrangler workflows instances describe lowkal-audio-copy <job-id> --config wrangler.audio-sync.toml` to check the copy result. Publish the mix again to restart a failed job.
- If a WAV copy exceeds the Worker CPU limit, run `npm run audio:peaks -- <mix-slug>`. This command also works before the delivery URL is set. Then restart the saved copy with `npx wrangler workflows instances restart lowkal-audio-copy <job-id> --config wrangler.audio-sync.toml`. The copy checks and reuses the waveform saved beside that exact master. It does not repeat the full waveform calculation or change the audio format.
- If the CMS works but the site does not show the latest content, check the Sanity document is published, not a draft.
- If a CMS publish removes `audio.peaksUrl`, the catalogue uses the version 2 sidecar beside the current Cloudflare delivery file. Its asset ID prevents a replacement master from using an older waveform. A missing sidecar still shows the playback position display. Generate the sidecar with `npm run audio:peaks -- <mix-slug>` when needed.
- If a new audio file gives an old sound, upload a new master. The asset ID changes the R2 object key.
- If the Vercel release fails, do not deploy elsewhere. Check the Vercel build log, repair the source, run `npm run check`, then deploy again.

## Fresh content

Pages and RSC responses use `Cache-Control: no-store`. The service worker does not save page or catalogue snapshots. It removes old Lowkal caches after activation. The site waits for the published CMS catalogue. Empty CMS results stay empty. CMS errors show a retry control in the archive. A service worker update waits until playback stops before it activates.

The build exports published article and mix paths. Publish the CMS change and make a new Vercel release to add a new detail path. Studio tool paths use the Studio shell for direct navigation.

Audio sync checks the current master and uses the Sanity revision before it updates a mix. A stale upload cannot replace the current master. The waveform scan uses one DataView per stream chunk. Worker logs are enabled.

Vercel runs lint, type checks, the build, and all tests before it publishes a release. GitHub Actions runs `npm run check` and the dependency audit for pull requests and pushes to `main`.

Audio playback must use the original WAV or FLAC file. Do not convert delivery audio to MP3 or another lossy format.
