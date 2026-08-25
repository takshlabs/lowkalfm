"use client";

import Image from "next/image";
import { type CSSProperties, useState } from "react";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";

const frequencyMin = 88;
const frequencyMax = 108;

const stations = [
  {
    frequency: 91.7,
    number: "01",
    name: "Listen",
    href: "/listen",
    note: "Weekly mixes and live Lowkal programs.",
    image: "/kinetic-drift.png",
    imageAlt: "Artwork for the latest Lowkal mix"
  },
  {
    frequency: 99.3,
    number: "02",
    name: "Read",
    href: "/read",
    note: "Field notes and stories behind the sound.",
    image: "/lowkal-logo.jpg",
    imageAlt: "Lowkal mark"
  },
  {
    frequency: 106.4,
    number: "03",
    name: "Go out",
    href: "/go-out",
    note: "A small guide to a very large city.",
    image: "/meeting-point.png",
    imageAlt: "Lowkal Meeting Point artwork"
  }
] as const;

export function HomeFrequencyHero() {
  const [frequency, setFrequency] = useState(stations[0].frequency);
  const activeStation = stations.reduce((nearest, station) => (
    Math.abs(station.frequency - frequency) < Math.abs(nearest.frequency - frequency) ? station : nearest
  ));
  const needle = ((frequency - frequencyMin) / (frequencyMax - frequencyMin)) * 100;
  const heroStyle = { "--tune-position": `${needle}%` } as CSSProperties;

  return (
    <section className="frequency-hero" style={heroStyle} aria-labelledby="frequency-hero-title">
      <div className="frequency-hero-meta">
        <span>Bengaluru · Independent community radio</span>
        <span className="frequency-status"><i aria-hidden="true" /> Signal open · 24 / 7</span>
      </div>

      <div className="frequency-hero-stage">
        <div className="frequency-hero-copy">
          <p className="eyebrow">Lowkal finds the sound between places.</p>
          <h1 id="frequency-hero-title" aria-label="The city has a frequency.">
            <span>The city</span>
            <span>has a</span>
            <span className="frequency-word" data-text="frequency.">frequency.</span>
          </h1>
          <p className="frequency-intro">Music, field notes, people and nights from Bengaluru—broadcast live and kept with care.</p>
        </div>

        <SiteLink className="frequency-receiver" href={sitePath(activeStation.href)} aria-label={`Open ${activeStation.name}`}>
          <div className="receiver-head">
            <span>Lowkal receiver</span>
            <span>CH · {activeStation.number}</span>
          </div>
          <div className="receiver-window">
            <Image
              key={activeStation.image}
              src={sitePath(activeStation.image)}
              alt={activeStation.imageAlt}
              fill
              sizes="(max-width: 900px) 92vw, 38vw"
              priority={activeStation.number === "01"}
            />
            <span className="receiver-scan" aria-hidden="true" />
          </div>
          <div className="receiver-readout">
            <span className="receiver-frequency">{frequency.toFixed(1)}</span>
            <span>FM · BLR</span>
          </div>
          <div className="receiver-channel">
            <strong>{activeStation.name}</strong>
            <span>{activeStation.note}</span>
            <i>Enter channel ↗</i>
          </div>
        </SiteLink>
      </div>

      <div className="frequency-tuner">
        <div className="tuner-instruction">
          <span>Tune the city</span>
          <span>Drag · use arrow keys · choose a channel</span>
        </div>
        <div className="tuner-control">
          <input
            aria-label="Tune the Lowkal frequency"
            type="range"
            min={frequencyMin}
            max={frequencyMax}
            step="0.1"
            value={frequency}
            onInput={(event) => setFrequency(Number(event.currentTarget.value))}
          />
          <span className="tuner-needle" aria-hidden="true" />
          <span className="tuner-min" aria-hidden="true">88</span>
          <span className="tuner-max" aria-hidden="true">108</span>
        </div>
        <nav className="frequency-stations" aria-label="Lowkal channels">
          {stations.map((station) => (
            <SiteLink
              className={station === activeStation ? "is-tuned" : undefined}
              href={sitePath(station.href)}
              key={station.name}
              onFocus={() => setFrequency(station.frequency)}
              onMouseEnter={() => setFrequency(station.frequency)}
            >
              <span>{station.frequency.toFixed(1)}</span>
              <strong>{station.name}</strong>
            </SiteLink>
          ))}
        </nav>
      </div>
    </section>
  );
}
