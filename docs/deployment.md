# Lowkal production deployment

## Production service

- Production site and CMS: `https://lowkalfm.vercel.app`
- Vercel project: `lowkalfm`
- Vercel team: `takshlabs-projects`
- CMS: `https://lowkalfm.vercel.app/studio`
- Audio delivery: Cloudflare R2 with a Cloudflare custom domain

Do not use OpenAI Sites or a `chatgpt.site` URL for Lowkal. They are not Lowkal production services.

## Vercel release procedure

1. Check the active account with `npx vercel whoami`.
2. Check the project link in `.vercel/project.json`. It must name `lowkalfm`.
3. Run `npm run check`.
4. Commit the completed change on `main`.
5. Push with `git push origin main`.
6. Deploy the same commit with `npx vercel --prod --yes` when a manual production deployment is required.
7. Confirm the `lowkalfm.vercel.app` alias points to the new ready deployment with `npx vercel inspect <deployment-url>`.

Never run a production deployment command that targets OpenAI Sites.

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

This setup is separate from the Vercel deployment.

### Active services

- R2 bucket: `lowkal-audio` (APAC location hint, Standard storage)
- Worker: `lowkal-audio-sync`
- Current audio endpoint: `https://lowkal-audio-sync.lowkal-audio-737a.workers.dev`
- Sanity webhook: `Copy published mixes to Cloudflare R2` (production dataset, update events only)

The R2 bucket is private. The Worker reads the audio objects and sends them to listeners with byte-range support. This is a Cloudflare CDN endpoint and does not change the Vercel site URL.

The account has no Cloudflare DNS zone yet. Add the `lowkal.fm` zone to Cloudflare later, then change the audio endpoint to a custom Worker route such as `audio.lowkal.fm`.

1. Sign in to the Lowkal Cloudflare account.
2. Keep the Worker configuration in `wrangler.audio-sync.toml` aligned with the bucket name.
3. Use the Worker endpoint above for `AUDIO_PUBLIC_BASE_URL`.
4. Do not enable an `r2.dev` URL. It is not needed for this setup.
6. Add these Cloudflare Worker secrets. Do not store them in Vercel or Git:

   - `SANITY_WEBHOOK_SECRET`
   - `SANITY_API_PROJECT_ID`
   - `SANITY_API_DATASET`
   - `SANITY_API_WRITE_TOKEN`
   - `AUDIO_PUBLIC_BASE_URL` (for example, `https://audio.lowkal.fm`)

7. Deploy the Worker with `npx wrangler deploy --config wrangler.audio-sync.toml`.
8. In Sanity Manage, keep the `Copy published mixes to Cloudflare R2` webhook enabled. It sends published `mix` updates to the Worker URL plus `/sanity/audio-sync`. Do not include drafts. Its secret must match `SANITY_WEBHOOK_SECRET`.
9. Use this webhook projection:

```groq
{
  _id,
  _type,
  "audioMasterUrl": audio.master.asset->url,
  "audioMasterFilename": audio.master.asset->originalFilename,
  "audioMasterId": audio.master.asset->_ref,
  "audioSourceAssetId": audio.sourceAssetId
}
```

10. Publish a small test mix. Confirm that the mix document receives `audio.deliveryUrl`, then play the mix from `https://lowkalfm.vercel.app`.

The Worker streams the Sanity master to R2 and writes its Cloudflare CDN URL back to the mix. The browser plays that URL directly. Vercel does not proxy the large audio file.

## Troubleshooting

- If the CDN URL does not appear, check the Cloudflare Worker logs and the Sanity webhook delivery log.
- If the CMS works but the site does not show the latest content, check the Sanity document is published, not a draft.
- If a new audio file gives an old sound, upload a new master. The asset ID changes the R2 object key.
- If the Vercel release fails, do not deploy elsewhere. Check the Vercel build log, repair the source, run `npm run check`, then deploy again.
