import type { ArtistFieldNote, ArtistProfile } from "./content";

export type GoOutPin = {
  id: string;
  placeName: string;
  area: string;
  note: string;
  tags: string[];
  lat: number;
  lng: number;
  artistSlug: string;
  artistName: string;
  mapUrl?: string;
};

const PAIR = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;

function bounded(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function coordinatesFromMapUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const at = parsed.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) return bounded(Number(at[1]), Number(at[2]));
    for (const key of ["q", "query", "ll", "center", "destination"]) {
      const match = parsed.searchParams.get(key)?.match(PAIR);
      if (match) return bounded(Number(match[1]), Number(match[2]));
    }
    const mlat = parsed.searchParams.get("mlat");
    const mlon = parsed.searchParams.get("mlon") ?? parsed.searchParams.get("mlng");
    if (mlat && mlon) return bounded(Number(mlat), Number(mlon));
  } catch {
    const match = url.match(PAIR);
    if (match) return bounded(Number(match[1]), Number(match[2]));
  }
  return null;
}

export function coordinatesFromFieldNote(note: ArtistFieldNote) {
  if (Number.isFinite(note.latitude) && Number.isFinite(note.longitude)) {
    return bounded(Number(note.latitude), Number(note.longitude));
  }
  return coordinatesFromMapUrl(note.mapUrl);
}

function pinId(artistSlug: string, note: ArtistFieldNote, index: number) {
  if (note.goOutSlug) return note.goOutSlug;
  const fromName = note.placeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${artistSlug}-${fromName || index}`;
}

export function collectGoOutPins(artists: ArtistProfile[]) {
  const pins: GoOutPin[] = [];
  for (const artist of artists) {
    artist.fieldNotes.forEach((note, index) => {
      const coords = coordinatesFromFieldNote(note);
      if (!coords) return;
      pins.push({
        id: pinId(artist.slug, note, index),
        placeName: note.placeName,
        area: note.area,
        note: note.note,
        tags: note.tags,
        lat: coords.lat,
        lng: coords.lng,
        artistSlug: artist.slug,
        artistName: artist.name,
        mapUrl: note.mapUrl
      });
    });
  }
  return pins;
}
