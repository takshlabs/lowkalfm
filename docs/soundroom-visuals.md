# Soundroom visuals

The Soundroom keeps the artwork on the left and the player on the right. On a phone, these areas form one scrollable column. The visual controls stay at the bottom.

## Controls

- **Aurora:** folded light fields.
- **Contour:** moving contour lines.
- **Orbital:** interference rings.
- **Intensity:** light-field strength.
- **Pause visuals:** holds a still frame without pausing the mix.
- **Focus view:** removes the artwork and details but keeps playback controls. Use Escape to leave this view.

All scenes are available for every playback source. The system starts with a still frame when the device requests reduced motion. A static light field replaces WebGL if it is unavailable or loses its context.

## Audio data

`AudioProvider` remains the only playback authority. `lib/audio-analysis.ts` measures bass (20–250 Hz), mids (250–2,000 Hz), highs (2,000–16,000 Hz), and waveform RMS. It sends bounded values to the visible, same-origin Soundroom at up to 30 updates per second. It stops sampling when the tab is hidden. The visual renderer is also limited to about 30 frames per second and caps its pixel dimensions.

The analyser uses the existing audio element. It does not start another player, use a microphone, record audio, or upload audio data. Audio keeps a direct output connection independent of the analyser branch.

Known CORS-enabled sources are the site origin, the Sanity file CDN, and Lowkal's audio Worker. Other URLs retain normal media playback without being routed into Web Audio. CORS is set before the audio URL is assigned.

## Embedded-player boundary

A YouTube iframe does not expose its decoded audio to the Web Audio API. All scenes still work, but they use ambient motion when measured frequency data is unavailable. The status reads **Ambient motion**, not **Audio reactive**. Meters do not simulate an audio signal.

Source-independent, beat-matched playback for those mixes needs an analysis timeline made from the matching master audio. This release does not generate such timelines or claim that ambient movement is beat-matched. A master for another recording must not be substituted.

## Checks

Run `npm run check`. This runs lint, type checks, the production build, and Node tests.

Browser checks must include real direct-audio playback, pause and seek, mix changes, all scenes, focus view, reduced motion, a phone viewport, keyboard tracklist controls, and WebGL context loss. Verify the production origin: the Sanity project can reject localhost requests even when production CORS works.
