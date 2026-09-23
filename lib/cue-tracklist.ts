export type ParsedCueTrack = {
  title: string;
  artist?: string;
};

type CueTrackFields = {
  title?: string;
  performer?: string;
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

  for (const line of lines) {
    const match = /^\s*(TITLE|PERFORMER|TRACK)\b\s*(.*)$/i.exec(line);
    if (!match) continue;

    const [, command, rest] = match;
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
      continue;
    }

  }

  if (tracks.length === 0) {
    throw new Error("No audio tracks were found. Select a Rekordbox CUE file with TRACK AUDIO entries.");
  }

  return tracks.map((track) => {
    const title = track.title?.trim() || "";
    const performer = track.performer?.trim() || "";
    const splitTitle = !performer ? splitArtistAndTitle(title) : undefined;
    const artist = performer || splitTitle?.artist;
    const trackTitle = splitTitle?.title || title;

    if (!trackTitle) {
      throw new Error(`Track ${track.number}: no title was found.`);
    }
    return {
      title: trackTitle,
      ...(artist ? { artist } : {})
    };
  });
}
