"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { Pause, Play, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { formatTime, soundRecords, SoundRecord } from "@/lib/content";
import { useAudio } from "./AudioProvider";

const SoundroomScene = dynamic(
  () => import("./SoundroomScene").then((module) => module.SoundroomScene),
  {
    ssr: false,
    loading: () => <div className="soundroom-canvas soundroom-canvas-fallback">Preparing the spatial record library…</div>
  }
);

type Filter = "all" | "weekly" | "live" | "featured";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All records" },
  { value: "weekly", label: "Weekly volumes" },
  { value: "live", label: "Live programs" },
  { value: "featured", label: "Featured sets" }
];

function applyFilter(record: SoundRecord, filter: Filter) {
  if (filter === "weekly") return record.format === "weekly";
  if (filter === "live") return record.format === "live-set";
  if (filter === "featured") return record.featured;
  return true;
}

export function SoundroomCatalog() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedSlug, setSelectedSlug] = useState(soundRecords[0].slug);
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();
  const records = useMemo(() => soundRecords.filter((record) => applyFilter(record, filter)), [filter]);
  const selected = soundRecords.find((record) => record.slug === selectedSlug) ?? soundRecords[0];
  const selectedIsActive = activeRecord.slug === selected.slug;

  const selectFilter = (nextFilter: Filter) => {
    setFilter(nextFilter);
    const nextRecords = soundRecords.filter((record) => applyFilter(record, nextFilter));
    if (!nextRecords.some((record) => record.slug === selectedSlug)) setSelectedSlug(nextRecords[0]?.slug ?? soundRecords[0].slug);
  };

  const handlePlay = () => {
    if (selectedIsActive) togglePlayback();
    else playRecord(selected.slug);
  };

  return (
    <section className="soundroom-library" id="library" aria-labelledby="library-title">
      <div className="soundroom-library-head">
        <div>
          <span className="section-kicker">The record library</span>
          <h2 id="library-title">Browse by record, program or set.</h2>
        </div>
        <div className="catalog-filters" role="group" aria-label="Filter sound records">
          {filters.map((item) => (
            <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => selectFilter(item.value)}>{item.label}</button>
          ))}
        </div>
      </div>

      <SoundroomScene records={records} selectedSlug={selected.slug} onSelect={setSelectedSlug} />

      <div className="selected-record" aria-live="polite">
        <Image src={selected.artwork} alt={`${selected.series} artwork`} width={180} height={180} />
        <div className="selected-record-copy">
          <span>{selected.format === "weekly" ? "Weekly mix" : "Live-program set"}{selected.featured ? " · Featured" : ""}</span>
          <h3>{selected.series}</h3>
          <p className="selected-artist">{selected.artist} — {selected.title}</p>
          <p>{selected.description}</p>
          <div className="selected-tags">{selected.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
        </div>
        <button type="button" className="selected-play" onClick={handlePlay}>
          {selectedIsActive && isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{selectedIsActive && isPlaying ? "Pause" : "Play record"}</span>
          <small>{formatTime(selected.duration)}</small>
        </button>
      </div>

      <div className="record-catalog-list" aria-label="Accessible sound record catalog">
        {records.map((record, index) => (
          <button type="button" className={selected.slug === record.slug ? "is-selected" : ""} onClick={() => setSelectedSlug(record.slug)} key={record.slug}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <Image src={record.artwork} alt="" width={64} height={64} />
            <span><strong>{record.series}</strong><small>{record.artist} · {record.title}</small></span>
            {record.featured ? <Star aria-label="Featured set" /> : <small>{record.format === "weekly" ? "Weekly" : "Live set"}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}
