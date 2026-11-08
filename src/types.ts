// Shared shapes for the generated data in data/records and data/notes.
// The sync script writes RecordData; the liner-notes skill writes Notes.

export interface Track {
  position: string;
  title: string;
  duration: string;
}

export interface Label {
  name: string;
  catno: string;
}

export interface RecordData {
  /** Discogs release id of the copy on our shelf. */
  id: number;
  artist: string;
  /** Discogs artist ids of the credited artists, main artist first. */
  artistIds: number[];
  title: string;
  /** Year of this pressing (Discogs release year). */
  year: number | null;
  /** Year of the original release (Discogs master year). */
  originalYear: number | null;
  genres: string[];
  styles: string[];
  /** Short format label: "LP", "2×LP", "7\"", "Box-Set". */
  format: string;
  /** Discogs format descriptions, e.g. ["LP", "Album", "Reissue"]. */
  formatDetails: string[];
  labels: Label[];
  country: string | null;
  tracklist: Track[];
  /** Date the record was added to the Discogs collection, YYYY-MM-DD. */
  addedAt: string;
  /** Path of the cover image relative to the site root, or null. */
  cover: string | null;
  discogsUrl: string;
  /** Artist name used for A–Z sorting ("The Strokes" sorts as "Strokes"). */
  sortName: string;
}

export interface Notes {
  /** "<Herkunft> · aktiv seit <Jahr> · <Kern-Genre>" */
  kicker: string;
  /** Short vibe tag, 2–4 words. */
  tag: string;
  /** 2–3 sentences about this album. */
  record: string;
  facts: { k: string; v: string }[];
  /** 2–3 songs from this record to put on first. */
  start: { t: string; why: string }[];
  /** 3–4 sentences about the artist. */
  band: string;
  trivia: string[];
  similar: { a: string; why: string }[];
  sources: { label: string; url: string }[];
  /** ISO date the notes were written. */
  writtenAt?: string;
}

export type ReleaseType = 'Studioalbum' | 'Livealbum' | 'EP' | 'Compilation' | 'Soundtrack';

/**
 * Discogs master releases of one artist (scripts/discography.ts), used to link
 * the curated discography entries of the artist profile to Discogs.
 */
export interface Discography {
  artist: string;
  discogsArtistIds: number[];
  /** Date of the Discogs data dump the file was built from, YYYY-MM-DD (older files). */
  dump?: string;
  /** Date the file was built from the Discogs API, YYYY-MM-DD. */
  fetchedAt?: string;
  releases: { title: string; year: number; type: ReleaseType; master: number }[];
}

/** Longer artist profile shown under „Mehr über …“, one per artist. */
export interface ArtistProfile {
  name: string;
  summary: string;
  /** Werdegang & Background, 2–4 paragraphs. */
  career: string[];
  /** Genre-Einordnung. */
  sound: string;
  highlights: string[];
  discography: {
    title: string;
    year: number;
    type: ReleaseType;
    note?: string;
    /** Discogs master id, added at runtime when the Discogs dump confirms the entry. */
    master?: number;
  }[];
  sources: { label: string; url: string }[];
  writtenAt?: string;
}
