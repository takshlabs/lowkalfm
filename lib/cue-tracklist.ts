export type ParsedCueTrack = {
  time: number;
  title: string;
  artist: string;
};

type CueTrackFields = {
  title?: string;
  performer?: string;
  index01?: string;
  index01Line?: number;
  number: string;
};

function cueValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    const closingQuote = trimmed.lastIndexOf('"');
    if (closingQuote > 0) {
      return trimmed.slice(1, closingQuote).replace(/\\(["\\])/g, "$1");
    }
  }
  return trimmed;
}

function secondsFromCueIndex(value: string, lineNumber: number) {
  const match = /^(\d+):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Line ${lineNumber}: expected a cue time in minutes:seconds:frames format.`);
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const frames = Number(match[3]);
  if (seconds > 59 || frames > 74) {
    throw new Error(`Line ${lineNumber}: cue time has an invalid seconds or frames value.`);
  }

  return Math.round((minutes * 60 * 75 + seconds * 75 + frames) / 75);
}

function splitArtistAndTitle(value: string) {
  const separator = value.indexOf(" - ");
  if (separator < 1) return undefined;
  return {
    artist: value.slice(0, separator).trim(),
    title: value.slice(separator + 3).trim()
  };
}

export function parseRekordboxCueFile(contents: string): ParsedCueTrack[] {
  const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/);
  const tracks: CueTrackFields[] = [];
  let currentTrack: CueTrackFields | undefined;
  let albumPerformer = "";

  for (const [index, line] of lines.entries()) {
    const match = /^\s*(TITLE|PERFORMER|TRACK|INDEX)\b\s*(.*)$/i.exec(line);
    if (!match) continue;

    const [, command, rest] = match;
    const lineNumber = index + 1;
    const commandName = command.toUpperCase();

    if (commandName === "TRACK") {
      const trackMatch = /^(\d+)\s+AUDIO\b/i.exec(rest.trim());
      if (!trackMatch) continue;
      currentTrack = { number: trackMatch[1] };
      tracks.push(currentTrack);
      continue;
    }

    if (commandName === "TITLE") {
      const title = cueValue(rest);
      if (currentTrack) currentTrack.title = title;
      continue;
    }

    if (commandName === "PERFORMER") {
      const performer = cueValue(rest);
      if (currentTrack) currentTrack.performer = performer;
      else albumPerformer = performer;
      continue;
    }

    if (commandName === "INDEX" && currentTrack) {
      const indexMatch = /^01\s+(\S+)/.exec(rest.trim());
      if (indexMatch) {
        currentTrack.index01 = indexMatch[1];
        currentTrack.index01Line = lineNumber;
      }
    }
  }

  if (tracks.length === 0) {
    throw new Error("No audio tracks were found. Select a Rekordbox CUE file with TRACK AUDIO entries.");
  }

  return tracks.map((track) => {
    const title = track.title?.trim() || "";
    const performer = track.performer?.trim() || "";
    const splitTitle = !performer ? splitArtistAndTitle(title) : undefined;
    const artist = performer || splitTitle?.artist || albumPerformer.trim();
    const trackTitle = splitTitle?.title || title;

    if (!track.index01) {
      throw new Error(`Track ${track.number}: no INDEX 01 start time was found.`);
    }
    if (!trackTitle) {
      throw new Error(`Track ${track.number}: no title was found.`);
    }
    if (!artist) {
      throw new Error(`Track ${track.number}: no artist was found. Add a PERFORMER line or use “Artist - Title” in TITLE.`);
    }

    return {
      time: secondsFromCueIndex(track.index01, track.index01Line || 1),
      title: trackTitle,
      artist
    };
  });
}
