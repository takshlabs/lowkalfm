import type { Metadata } from "next";
import { SoundroomCatalog } from "@/components/SoundroomCatalog";
import { livePrograms, soundRecords } from "@/lib/content";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lowkal Soundroom",
  description: "Weekly Lowkal.fm volumes, live programs, featured sets and the Lowkal record library."
};

export default function ListenPage() {
  const latest = soundRecords[0];
  const program = livePrograms[0];

  return (
    <main className="soundroom-page">
      <section className="soundroom-hero">
        <div>
          <span className="section-kicker">Listen · The archive is alive</span>
          <h1>Lowkal<br /><em>Soundroom.</em></h1>
        </div>
        <div className="soundroom-intro">
          <p>The listening space for every Lowkal mix, live program and selected set. Audio stays with you while you move through the rest of the site.</p>
          <a href="#library">Browse the record library ↓</a>
        </div>
        <div className="soundroom-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
      </section>

      <section className="program-architecture" aria-labelledby="program-architecture-title">
        <div className="program-architecture-head">
          <span className="section-kicker">How Lowkal broadcasts</span>
          <h2 id="program-architecture-title">Two rhythms. One archive.</h2>
        </div>
        <article className="program-rule weekly-rule">
          <span className="program-rule-index">A</span>
          <div><h3>Lowkal.fm Vol. 01, 02, 03…</h3><p>A weekly mix. Some volumes come from residents. Others are guest selections. Each volume is one complete record.</p></div>
          <strong>Every week</strong>
          <small>Latest: {latest.series} · {latest.artist}</small>
        </article>
        <article className="program-rule live-rule">
          <span className="program-rule-index">B</span>
          <div><h3>Lowkal 001 | Program name</h3><p>A multi-artist live stream every two months. The archive keeps all sets inside the program and marks one featured set.</p></div>
          <strong>Every two months</strong>
          <small>Archive: {program.label}</small>
        </article>
      </section>

      <SoundroomCatalog />
    </main>
  );
}
