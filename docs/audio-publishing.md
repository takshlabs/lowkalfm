# Audio publishing

1. Open the mix in Lowkal CMS.
2. Open **Playback** and then **Audio**.
3. Upload the WAV master to **WAV master**.
4. Publish the mix.
5. Wait for the CDN delivery URL to appear. The player then uses the Cloudflare audio URL.

Use a new upload when you replace a master. The CDN key includes the Sanity asset ID, so listeners do not receive an old cached file.

The audio-sync webhook must send published `mix` documents to:

`https://lowkal-fm.tkzbass.chatgpt.site/api/sanity/audio-sync`

Use this GROQ projection:

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

Set the webhook secret to the same value as `SANITY_WEBHOOK_SECRET` in the site environment. Do not include drafts. The endpoint checks the signed webhook request before it copies a file.
