"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime, soundRecords, SoundRecord } from "@/lib/content";
import { ArchiveAtmosphere } from "./ArchiveAtmosphere";
import { useAudio } from "./AudioProvider";

type ArchiveGroup = {
  id: string;
  number: string;
  label: string;
  shortLabel: string;
  description: string;
  includes: (record: SoundRecord) => boolean;
};

const archiveGroups: ArchiveGroup[] = [
  {
    id: "scene-programmes",
    number: "01",
    label: "Lowkal scene programmes",
    shortLabel: "Programmes",
    description: "Complete programme recordings and sets kept together from each Lowkal gathering.",
    includes: (record) => record.format === "live-set"
  },
  {
    id: "volumes-residents",
    number: "02",
    label: "Lowkal FM resident volumes",
    shortLabel: "Residents",
    description: "Recurring Lowkal voices and the selections that shape the station over time.",
    includes: (record) => record.format === "weekly" && record.artist.toLowerCase() === "takezo"
  },
  {
    id: "volumes-guests",
    number: "03",
    label: "Lowkal FM guest volumes",
    shortLabel: "Guests",
    description: "One-off contributions from artists who pass through the room and leave a record behind.",
    includes: (record) => record.format === "weekly" && record.artist.toLowerCase() !== "takezo"
  }
];

function getGroup(record: SoundRecord) {
  return archiveGroups.find((group) => group.includes(record)) ?? archiveGroups[0];
}

export function SoundroomCatalog() {
  const [selectedSlug, setSelectedSlug] = useState(soundRecords[0].slug);
  const recordRefs = useRef(new Map<string, HTMLButtonElement>());
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();
  const selectedIndex = Math.max(0, soundRecords.findIndex((record) => record.slug === selectedSlug));
  const selected = soundRecords[selectedIndex];
  const group = useMemo(() => getGroup(selected), [selected]);
  const selectedIsActive = activeRecord.slug === selected.slug;

  useEffect(() => {
    recordRefs.current.get(selected.slug)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }, [selected.slug]);

  const move = (direction: -1 | 1) => {
    const nextIndex = (selectedIndex + direction + soundRecords.length) % soundRecords.length;
    setSelectedSlug(soundRecords[nextIndex].slug);
  };

  const handlePlay = () => {
    if (selectedIsActive) togglePlayback();
    else playRecord(selected.slug);
  };

  return (
    <section className="archive-room on-paper" id="archive" aria-labelledby="archive-title">
      <header className="archive-head">
        <div className="archive-head__title">
          <p className="section-kicker">Lowkal listening archive</p>
          <h1 id="archive-title">Archive Room</h1>
          <p className="archive-head__count label label--sm">
            AR — {String(soundRecords.length).padStart(2, "0")} records
          </p>
        </div>

        <nav className="archive-tabs" aria-label="Archive catalogues">
          {archiveGroups.map((item) => {
            const count = soundRecords.filter(item.includes).length;
            const isActive = item.id === group.id;
            return (
              <button
                type="button"
                aria-pressed={isActive}
                key={item.id}
                onClick={() => {
                  const firstRecord = soundRecords.find(item.includes);
                  if (firstRecord) setSelectedSlug(firstRecord.slug);
                }}
              >
                <span>{item.shortLabel}</span>
                <small className="tnum">[{count}]</small>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="archive-stage">
        <ArchiveAtmosphere />

        <div className="archive-track" aria-label="Lowkal records">
          {soundRecords.map((record, index) => {
            const isSelected = record.slug === selected.slug;
            return (
              <button
                type="button"
                className={`archive-record${isSelected ? " is-selected" : ""}`}
                aria-label={`Select ${record.series} by ${record.artist}`}
                aria-pressed={isSelected}
                key={record.slug}
                ref={(element) => {
                  if (element) recordRefs.current.set(record.slug, element);
                  else recordRefs.current.delete(record.slug);
                }}
                onClick={() => setSelectedSlug(record.slug)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") move(-1);
                  if (event.key === "ArrowRight") move(1);
                }}
              >
                <span className="archive-record-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="archive-record-frame">
                  <span className="archive-record-tab">{record.title}</span>
                  <span className="archive-vinyl">
                    <span className="archive-vinyl-label">
                      <Image src={record.artwork} alt="" fill sizes="120px" />
                    </span>
                  </span>
                </span>
                <span className="archive-record-caption">
                  <strong>{record.artist}</strong>
                  <small>{record.series}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div className="archive-controls" aria-label="Archive controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous record">
            <ArrowLeft aria-hidden="true" />
          </button>
          <span className="archive-controls__count label label--sm tnum">
            {String(selectedIndex + 1).padStart(2, "0")} / {String(soundRecords.length).padStart(2, "0")}
          </span>
          <button type="button" onClick={() => move(1)} aria-label="Next record">
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <footer className="archive-desk" aria-live="polite">
        <div className="archive-desk__group">
          <p className="section-kicker">Catalogue {group.number}</p>
          <p>{group.description}</p>
        </div>

        <div className="archive-selection">
          <div className="archive-selection__index">
            <strong>{String(selectedIndex + 1).padStart(2, "0")}</strong>
            <span className="label label--sm">
              {selected.format === "weekly" ? "FM volume" : "Scene programme"}
            </span>
          </div>

          <div className="archive-selection__title">
            <h2>{selected.artist}</h2>
            <p>{selected.series} — {selected.title}</p>
            <div className="archive-selection__meta label label--sm">
              <span>{selected.date}</span>
              <em>{selected.genres.join(" / ")}</em>
              <span className="tnum">{formatTime(selected.duration)}</span>
            </div>
          </div>

          <button type="button" className="archive-play" onClick={handlePlay}>
            <span>
              {selectedIsActive && isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </span>
            <span>{selectedIsActive && isPlaying ? "Pause" : "Play record"}</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
