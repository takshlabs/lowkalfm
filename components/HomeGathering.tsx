import { MediaFrame } from "@/components/MediaFrame";
import { sitePath } from "@/lib/site-path";

const channels = [
  { href: "https://www.instagram.com/lowkal.fm/", label: "Instagram ↗" },
  { href: "https://www.youtube.com/@takezodj", label: "YouTube ↗" },
  { href: "mailto:hello@lowkal.fm", label: "Email ↗" }
];

export function HomeGathering() {
  return (
    <section className="gathering on-red" aria-labelledby="gathering-title">
      <div className="gathering__art">
        <MediaFrame
          variant="fill"
          src={sitePath("/lowkal-logo.jpg")}
          alt="Lowkal illustrated mark"
          fill
          sizes="(max-width: 900px) 100vw, 44vw"
        />
      </div>

      <div className="gathering__copy" data-reveal>
        <p className="section-kicker">Stay close</p>
        <h2 className="gathering__title" id="gathering-title">
          Who played. Where it happened. What comes next.
        </h2>
        <p>
          Lowkal programmes start with the people in the room. Follow new sessions,
          programme notes, and gathering announcements.
        </p>
        <div className="gathering__links">
          {channels.map((channel) => (
            <a
              className="link-quiet"
              href={channel.href}
              key={channel.href}
              {...(channel.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {channel.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
