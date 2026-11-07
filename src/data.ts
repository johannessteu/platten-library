// Loads the generated records at build time and the liner notes on demand.

import type { Notes, RecordData } from './types.ts';
import { genreLabel, norm } from './lib/format.ts';
import { sleeveFor, type SleeveStyle } from './lib/sleeve.ts';

export interface Rec extends RecordData, SleeveStyle {
  /** Position in A–Z order. */
  order: number;
  /** First letter for the A–Z jump bar. */
  letter: string;
  /** Normalised text the search runs against. */
  hay: string;
  label: string;
  hasNotes: boolean;
}

const recordFiles = import.meta.glob<RecordData>('../data/records/*.json', { eager: true, import: 'default' });
const noteFiles = import.meta.glob<Notes>('../data/notes/*.json', { import: 'default' });

const idFromPath = (p: string) => Number(p.match(/(\d+)\.json$/)?.[1]);
const noteLoaders = new Map(Object.entries(noteFiles).map(([p, load]) => [idFromPath(p), load]));

export const RECORDS: Rec[] = Object.values(recordFiles)
  .sort((a, b) => a.sortName.localeCompare(b.sortName, 'de') || a.title.localeCompare(b.title, 'de'))
  .map((r, order) => {
    const first = r.sortName.charAt(0).toUpperCase();
    return {
      ...r,
      ...sleeveFor(r.id),
      order,
      letter: /[A-Z]/.test(first) ? first : '#',
      hay: norm([r.artist, r.title, ...r.genres.map(genreLabel), ...r.genres, ...r.styles, ...r.labels.map((l) => l.name)].join(' ')),
      label: `${r.artist}, ${r.title}`,
      hasNotes: noteLoaders.has(r.id),
    };
  });

export const BY_ID = new Map(RECORDS.map((r) => [r.id, r]));

/** First record per artist name, used to link "similar" artists that are on the shelf. */
export const BY_ARTIST = new Map<string, Rec>();
for (const r of RECORDS) if (!BY_ARTIST.has(r.artist)) BY_ARTIST.set(r.artist, r);

/** Genre chips: every genre on the shelf, most common first. */
export const GENRES: string[] = (() => {
  const count = new Map<string, number>();
  for (const r of RECORDS) for (const g of r.genres) count.set(g, (count.get(g) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
})();

export const STATS = {
  records: RECORDS.length,
  artists: new Set(RECORDS.map((r) => r.artist)).size,
  newest: RECORDS.reduce((m, r) => (r.addedAt > m ? r.addedAt : m), ''),
};

export function loadNotes(id: number): Promise<Notes | null> {
  return noteLoaders.get(id)?.() ?? Promise.resolve(null);
}
