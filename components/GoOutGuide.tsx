"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { collectGoOutPins, type GoOutPin } from "@/lib/go-out-map";
import { sitePath } from "@/lib/site-path";
import { SiteLink } from "@/components/SiteLink";
import { useListenContent } from "./ListenContentProvider";
import "leaflet/dist/leaflet.css";

const BENGALURU: [number, number] = [12.9716, 77.5946];

function selectedFromHash(pins: GoOutPin[]) {
  const hash = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "");
  return pins.find((pin) => pin.id === hash)?.id ?? pins[0]?.id ?? "";
}

export function GoOutGuide() {
  const { artists } = useListenContent();
  const pins = useMemo(() => collectGoOutPins(artists), [artists]);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const selected = pins.find((pin) => pin.id === selectedId) ?? pins[0];

  useEffect(() => {
    // Hash is available only in the browser after the map shell hydrates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(selectedFromHash(pins));
  }, [pins]);

  useEffect(() => {
    const node = mapNode.current;
    if (!node) return;
    let cancelled = false;

    void import("leaflet").then((mod) => {
      if (cancelled || !mapNode.current) return;
      const L = (mod.default ?? mod) as typeof import("leaflet");
      const start = pins.find((pin) => pin.id === selectedFromHash(pins)) ?? pins[0];
      const map = L.map(mapNode.current, {
        center: start ? [start.lat, start.lng] : BENGALURU,
        zoom: start ? 14 : 12,
        scrollWheelZoom: false,
        attributionControl: true
      });
      mapRef.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 19
      }).addTo(map);
      for (const pin of pins) {
        const marker = L.marker([pin.lat, pin.lng], {
          icon: L.divIcon({
            className: "go-out-pin",
            html: "<span></span>",
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          }),
          title: `${pin.placeName} · ${pin.artistName}`
        });
        marker.on("click", () => {
          setSelectedId(pin.id);
          window.history.replaceState(null, "", `#${pin.id}`);
          map.flyTo([pin.lat, pin.lng], 15, { duration: 0.6 });
        });
        marker.addTo(map);
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pins]);

  return (
    <div className="go-out-guide">
      <section className="section-page-hero city-hero">
        <span className="section-kicker">03 · Go out</span>
        <h1>Where they<br />hang out.</h1>
        <p>Artist hangouts on a Bengaluru map. Pins come from published field notes.</p>
      </section>
      <section className="go-out-map-shell" aria-label="Bengaluru hangouts">
        <div ref={mapNode} className="go-out-map" role="presentation" />
        {pins.length === 0 ? (
          <div className="go-out-empty">
            <span>Next pin</span>
            <h2>Artist hangouts will appear here.</h2>
            <p>When a Lowkal artist adds a place they return to, it lands on this map.</p>
          </div>
        ) : selected ? (
          <article className="go-out-card" id={selected.id}>
            <span>{selected.area || "Bengaluru"}</span>
            <h2>{selected.placeName}</h2>
            <blockquote>“{selected.note}”</blockquote>
            <p>{selected.artistName}</p>
            <footer>
              <SiteLink href={sitePath(`/artists/${selected.artistSlug}`)}>Open artist file ↗</SiteLink>
              {selected.mapUrl ? <a href={selected.mapUrl} target="_blank" rel="noreferrer">Map ↗</a> : null}
            </footer>
          </article>
        ) : null}
      </section>
    </div>
  );
}
