const phrases = [
  "Multi-genre",
  "Low-end focused",
  "From Bengaluru",
  "Who played",
  "Where it happened",
  "What comes next"
];

/**
 * A running strip of Lowkal statements between the stage and the shelf.
 *
 * The track is rendered twice. The animation moves it by exactly one copy, so
 * the loop closes without a seam. The duplicate is hidden from assistive
 * technology so the phrases are announced once.
 */
export function HomeStrip() {
  const line = (
    <span>
      {phrases.map((phrase) => (
        <span key={phrase}>
          {phrase}
          <i aria-hidden="true">/</i>
        </span>
      ))}
    </span>
  );

  return (
    <div className="home-strip marquee">
      <div className="marquee__track">{line}</div>
      <div className="marquee__track" aria-hidden="true">{line}</div>
    </div>
  );
}
