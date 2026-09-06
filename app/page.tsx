import { HomeTransmissionDeck } from "@/components/HomeTransmissionDeck";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

const channels = [
  {
    number: "01",
    title: "Listen",
    text: "Long sessions. Deep selections. Find your next favourite sound.",
    href: "/listen",
    label: "Enter soundroom",
  },
  {
    number: "02",
    title: "Read",
    text: "People, places, and ideas from our corner of the city.",
    href: "/read",
    label: "Open the journal",
  },
  {
    number: "03",
    title: "Go out",
    text: "Close the laptop. Find a room. Meet the people behind the music.",
    href: "/go-out",
    label: "Explore the city",
  },
];

export default function Home() {
  return (
    <main className="new-wave-home" id="main-content">
      <section className="wave-hero" aria-labelledby="wave-title">
        <div className="wave-dateline">
          <span>Independent radio & culture</span>
          <span>Bengaluru, India · 12.97° N</span>
        </div>
        <h1 id="wave-title">
          Keep it
          <br />
          <em>Lowkal.</em>
          <span className="wave-asterisk" aria-hidden="true">
            ✳
          </span>
        </h1>
        <div className="wave-hero-bottom">
          <p>
            A place for curious ears.
            <br />
            Multi-genre. Low-end focused.
            <br />
            Always from Bengaluru.
          </p>
          <SiteLink className="wave-button" href={sitePath("/listen")}>
            Enter soundroom <span aria-hidden="true">↗</span>
          </SiteLink>
          <span className="wave-edition">
            SOUND / PEOPLE / PLACE
            <br />
            EST. BENGALURU
          </span>
        </div>
        <div className="wave-art" aria-hidden="true">
          <div className="wave-disc">
            <div className="wave-disc-label">
              LOWKAL
              <br />
              <small>SIDE A · BLR</small>
            </div>
          </div>
          <span className="wave-art-caption">
            Different sounds. Common ground.
          </span>
        </div>
      </section>
      <div className="wave-strip" aria-label="Lowkal languages">
        <span>ಲೋಕಲ್</span>
        <span>LOCAL ROOTS. OPEN EARS.</span>
        <span>লোকাল</span>
        <span>INDEPENDENT BY NATURE.</span>
        <span>लोकल</span>
      </div>
      <HomeTransmissionDeck />
      <section className="wave-channels" aria-label="Explore Lowkal">
        {channels.map((channel) => (
          <SiteLink
            className="wave-channel"
            key={channel.number}
            href={sitePath(channel.href)}
          >
            <span className="wave-channel-number">
              {channel.number} / LOWKAL
            </span>
            <h2>
              {channel.title}
              <span aria-hidden="true">↗</span>
            </h2>
            <p>{channel.text}</p>
            <span className="wave-channel-link">{channel.label}</span>
          </SiteLink>
        ))}
      </section>
      <section className="wave-people" aria-labelledby="wave-people-title">
        <div className="wave-people-art">
          <MediaFrame
            variant="editorial"
            src={sitePath("/art/eye-in-hand.jpg")}
            alt="Green collage of hands and painted eyes"
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <span>THE PEOPLE MAKE THE SOUND.</span>
        </div>
        <div className="wave-people-copy">
          <span className="section-kicker">The Lowkal community</span>
          <h2 id="wave-people-title">
            Good music.
            <br />
            <em>Real people.</em>
          </h2>
          <p>
            Meet the residents, guests, and friends who bring their own world to
            every selection.
          </p>
          <SiteLink className="wave-button" href={sitePath("/artists")}>
            Meet the artists <span aria-hidden="true">↗</span>
          </SiteLink>
        </div>
      </section>
      <aside className="wave-open-call">
        <span>Our ears are open</span>
        <h2>
          Got something
          <br />
          we should hear?
        </h2>
        <a href="mailto:hello@lowkal.fm?subject=Open%20frequency">
          Send it our way <span aria-hidden="true">↗</span>
        </a>
      </aside>
    </main>
  );
}
