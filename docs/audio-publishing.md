# Audio publishing

The Lowkal site and CMS run at `https://lowkalfm.in`. Cloudflare R2 stores and delivers published audio. It does not host the site.

## Editor workflow

1. Open the mix in Lowkal CMS at `https://lowkalfm.in/studio`.
2. Open **Playback**, then **Audio**.
3. Upload the lossless master to **WAV or FLAC master**.
4. Set **Start playback at (seconds)** only when the file has leading silence. Use `0` for no skip.
5. Publish the mix.
   The publish request saves a background audio job. The copy continues after the request ends. Failed copies retry automatically. Publish the same mix again to restart a failed job; a new upload is not required.
6. For a WAV master, wait for both **CDN delivery URL** and **Waveform peak data URL** to appear. The Worker copies the WAV master, calculates interval peaks and measured bass, mid, and high energy, and saves both URLs in one publish operation.

For a FLAC master, wait for **CDN delivery URL** to appear. Then run `npm run audio:peaks -- <mix-slug>` from a local checkout with FFmpeg installed. This reads the complete FLAC master and saves waveform peaks and bass, mid, and high measurements. The browser reads the small measurement file. Playback uses the original FLAC file. When a new FLAC replaces a master, the copy job removes the old waveform URL; run the command again after the copy completes.

Do not announce a mix until its delivery URL and waveform URL appear.

Use a new upload when you replace a master. The R2 key contains the Sanity asset ID. This prevents an old cached file from being used.
