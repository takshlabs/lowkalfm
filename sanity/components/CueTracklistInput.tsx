"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button, Stack, Text } from "@sanity/ui";
import { PatchEvent, set, type ArrayOfObjectsInputProps } from "sanity";
import { parseRekordboxCueFile } from "@/lib/cue-tracklist";

type CueTrackValue = {
  _key: string;
  _type: "track";
  time: number;
  title: string;
  artist: string;
};

function cueTrackKey(index: number) {
  return `cue-${Date.now().toString(36)}-${index.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CueTracklistInput(props: ArrayOfObjectsInputProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const trackCount = Array.isArray(props.value) ? props.value.length : 0;

  async function importCueFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".cue")) {
      setStatus("Choose a file with the .cue extension.");
      return;
    }

    if (trackCount > 0 && !window.confirm("Replace the current tracklist with tracks from this CUE file?")) return;

    try {
      const parsedTracks = parseRekordboxCueFile(await file.text());
      const tracks: CueTrackValue[] = parsedTracks.map((track, index) => ({
        _key: cueTrackKey(index),
        _type: "track",
        ...track
      }));
      props.onChange(PatchEvent.from(set(tracks)));
      setStatus(`Imported ${tracks.length} tracks from ${file.name}. Check the times and details before you publish.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The CUE file could not be read.");
    }
  }

  return (
    <Stack gap={3}>
      <Stack gap={2}>
        <Text size={1} weight="semibold">Import a Rekordbox CUE file</Text>
        <Text size={1} muted>Choose a .cue file to fill the tracklist. The CUE file must include a title, artist, and INDEX 01 time for each track. You can edit the imported tracks below.</Text>
        <div>
          <Button
            text="Choose CUE file"
            tone="primary"
            disabled={props.readOnly}
            onClick={() => fileInput.current?.click()}
          />
          <input
            ref={fileInput}
            type="file"
            accept=".cue,text/plain,application/octet-stream"
            aria-label="Choose Rekordbox CUE file"
            hidden
            disabled={props.readOnly}
            onChange={importCueFile}
          />
        </div>
        {status ? <Text size={1} muted>{status}</Text> : null}
      </Stack>
      {props.renderDefault(props)}
    </Stack>
  );
}
