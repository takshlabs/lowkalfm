# Soundroom visuals

The Soundroom retains its original layout and liquid shader. A small settings button beside Tracklist opens the mixer and visual controls. There is no bottom visual bar or scene selector.

## Controls

- **Bass, mid, high:** three-band EQ with channel faders and measured level meters.
- **Master:** the existing player's volume control.
- **EQ bypass and reset:** compare with the unmodified signal or return the EQ to neutral.
- **Intensity:** how strongly measured audio changes the original liquid field.
- **Pause visuals:** holds a still frame without pausing the mix.


The original shader remains available for every playback source. Measured bass modulates the liquid flow, mids change its detail, and highs change highlights. Pointer influence switches off while measured audio controls the shader, and returns when audio is paused or unavailable. The system starts with a still frame when the device requests reduced motion. Mixer meters continue to work when visuals are paused or WebGL is unavailable.

## Audio data

`AudioProvider` remains the only playback authority. `lib/audio-analysis.ts` measures bass (20–250 Hz), mids (250–2,000 Hz), highs (2,000–16,000 Hz), and waveform RMS. It sends bounded values to the visible, same-origin Soundroom at up to 30 updates per second. It stops sampling when the tab is hidden. The visual renderer is also limited to about 30 frames per second and caps its pixel dimensions.

The analyser uses the existing audio element. It does not start another player, use a microphone, record audio, or upload audio data. Audio has one output path through the EQ, independent of visual rendering. EQ changes are smoothed, with headroom for frequency boosts.

Known CORS-enabled sources are the site origin, the Sanity file CDN, and Lowkal's audio Worker. Other URLs retain normal media playback without being routed into Web Audio. CORS is set before the audio URL is assigned.

## Embedded-player boundary

A YouTube iframe does not expose its decoded audio to the Web Audio API. The original shader still works with ambient motion and pointer response when measured frequency data is unavailable. The status reads **Ambient motion**, not **Audio reactive**. Meters do not simulate an audio signal. EQ is unavailable on these sources; master volume remains usable.

Source-independent, beat-matched playback for those mixes needs an analysis timeline made from the matching master audio. This release does not generate such timelines or claim that ambient movement is beat-matched. A master for another recording must not be substituted.

## Checks

Run `npm run check`. This runs lint, type checks, the production build, and Node tests.

Browser checks must include real direct-audio playback, pause and seek, mix changes, real EQ changes, bypass/reset, pointer suppression during measured audio, reduced motion, phone settings bounds, keyboard dialog controls, and WebGL context loss. Verify the production origin: the Sanity project can reject localhost requests even when production CORS works.
