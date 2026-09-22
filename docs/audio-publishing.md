# Audio publishing

The Lowkal site and CMS run at `https://lowkalfm.in`. Cloudflare R2 stores and delivers published audio. It does not host the site.

## Editor workflow

1. Open the mix in Lowkal CMS at `https://lowkalfm.in/studio`.
2. Open **Playback**, then **Audio**.
3. Upload the lossless master to **WAV master**.
4. Set **Start playback at (seconds)** only when the file has leading silence. Use `0` for no skip.
5. Publish the mix.
6. Wait for both **CDN delivery URL** and **Waveform peak data URL** to appear. The Worker copies the WAV master, calculates 128 waveform peaks, and saves both URLs in one publish operation.

Do not announce a mix until both URLs appear. A public mix has its full waveform from its first page request.

Use a new upload when you replace a master. The R2 key contains the Sanity asset ID. This prevents an old cached file from being used.
