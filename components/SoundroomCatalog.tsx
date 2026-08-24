"use client";

import { MediaFrame } from "@/components/MediaFrame";
import { Pause, Play, Star } from "lucide-react";
import { lazy, Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { formatTime, soundRecords, SoundRecord } from "@/lib/content";
import { useAudio } from "./AudioProvider";
import type { ArchiveGroupId } from "./SoundroomScene";

const SoundroomScene = lazy(
  () => import("./SoundroomScene").then((module) => ({ default: module.SoundroomScene })),
);

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

type ArchiveGroup = {
  id: ArchiveGroupId;
  eyebrow: string;
  label: string;
  shortLabel: string;
  description: string;
  includes: (record: SoundRecord) => boolean;
};

const archiveGroups: ArchiveGroup[] = [
  {
    id: "scene-broadcast",
    eyebrow: "Catalogue 01",
    label: "Lowkal scene broadcast",
    shortLabel: "Scene broadcast",
    description: "Complete programme recordings and sets kept together from each Lowkal gathering.",
    includes: (record) => record.format === "live-set"
  },
  {
    id: "volumes-residents",
    eyebrow: "Catalogue 02",
    label: "Lowkal FM volumes — Residents",
    shortLabel: "Volumes · Residents",
    description: "Recurring Lowkal voices and the selections that shape the station over time.",
    includes: (record) => record.format === "weekly" && record.artist.toLowerCase() === "takezo"
  },
  {
    id: "volumes-guests",
    eyebrow: "Catalogue 03",
    label: "Lowkal FM volumes — Guests",
    shortLabel: "Volumes · Guests",
    description: "Guest mixes and one-off contributions from artists passing through the room.",
    includes: (record) => record.format === "weekly" && record.artist.toLowerCase() !== "takezo"
  }
];

function ClientSoundroomScene({ selectedSlug, activeGroup, onSelect }: { selectedSlug: string; activeGroup: ArchiveGroupId; onSelect: (slug: string) => void }) {
  const isClient = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot);
  const fallback = <div className="soundroom-canvas soundroom-canvas-fallback">Preparing the record room…</div>;

  if (!isClient) return fallback;

  return (
    <Suspense fallback={fallback}>
      <SoundroomScene records={soundRecords} selectedSlug={selectedSlug} activeGroup={activeGroup} onSelect={onSelect} />
    </Suspense>
  );
}

export function SoundroomCatalog() {
  const [activeGroup, setActiveGroup] = useState<ArchiveGroupId>("scene-broadcast");
  const [selectedSlug, setSelectedSlug] = useState(soundRecords.find(archiveGroups[0].includes)?.slug ?? soundRecords[0].slug);
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();
  const group = archiveGroups.find((item) => item.id === activeGroup) ?? archiveGroups[0];
  const records = useMemo(() => soundRecords.filter(group.includes), [group]);
  const selected = soundRecords.find((record) => record.slug === selectedSlug) ?? records[0] ?? soundRecords[0];
  const selectedIsActive = activeRecord.slug === selected.slug;

  const selectGroup = (nextGroup: ArchiveGroup) => {
    setActiveGroup(nextGroup.id);
    const firstRecord = soundRecords.find(nextGroup.includes);
    if (firstRecord) setSelectedSlug(firstRecord.slug);
  };

  const selectRecord = (slug: string) => {
    const record = soundRecords.find((item) => item.slug === slug);
    if (!record) return;
    const recordGroup = archiveGroups.find((item) => item.includes(record));
    if (recordGroup) setActiveGroup(recordGroup.id);
    setSelectedSlug(slug);
  };

  const handlePlay = () => {
    if (selectedIsActive) togglePlayback();
    else playRecord(selected.slug);
  };

  return (
    <section className="archive-room" id="archive" aria-labelledby="archive-title">
      <div className="archive-room-heading">
        <div>
          <span className="section-kicker">The archive room</span>
          <h1 id="archive-title">Pick a shelf.<br /><em>Pull a record.</em></h1>
        </div>
        <p>A small three-dimensional record shop for Lowkal broadcasts, resident volumes and guest selections. Choose a catalogue to cross the room.</p>
      </div>

      <div className="archive-group-index" role="tablist" aria-label="Archive catalogues">
        {archiveGroups.map((item) => {
          const count = soundRecords.filter(item.includes).length;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === item.id}
              aria-controls="archive-catalogue"
              key={item.id}
              onClick={() => selectGroup(item)}
            >
              <span>{item.eyebrow}</span>
              <strong>{item.shortLabel}</strong>
              <small>{count.toString().padStart(2, "0")} records</small>
            </button>
          );
        })}
      </div>

      <ClientSoundroomScene selectedSlug={selected.slug} activeGroup={activeGroup} onSelect={selectRecord} />

      <div className="archive-desk" id="archive-catalogue" role="tabpanel">
        <div className="archive-desk-group">
          <span>{group.eyebrow}</span>
          <h2>{group.label}</h2>
          <p>{group.description}</p>
        </div>

        <div className="selected-record" aria-live="polite">
          <MediaFrame variant="record" src={selected.artwork} alt={`${selected.series} artwork`} width={180} height={180} />
          <div className="selected-record-copy">
            <span>{selected.format === "weekly" ? "Lowkal FM volume" : "Scene broadcast set"}{selected.featured ? " · Featured" : ""}</span>
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

        <div className="record-catalog-list" aria-label={`${group.label} record list`}>
          {records.map((record, index) => (
            <button type="button" className={selected.slug === record.slug ? "is-selected" : ""} onClick={() => selectRecord(record.slug)} key={record.slug}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <MediaFrame variant="record" src={record.artwork} alt="" width={64} height={64} />
              <span><strong>{record.series}</strong><small>{record.artist} · {record.title}</small></span>
              {record.featured ? <Star aria-label="Featured set" /> : <small>{record.format === "weekly" ? "Volume" : "Broadcast"}</small>}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
