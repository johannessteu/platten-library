// Loads the generated records at build time and the liner notes on demand.

import type { ArtistProfile, Discography, Notes, RecordData } from './types.ts';
import { artistSlug, slugify } from './lib/artists.ts';
import { sameTitle } from './lib/titles.ts';
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
  /** Slug of the artist profile behind „Mehr über …“, if one exists. */
  profile: string | null;
}

const recordFiles = import.meta.glob<RecordData>('../data/records/*.json', { eager: true, import: 'default' });
const noteFiles = import.meta.glob<Notes>('../data/notes/*.json', { import: 'default' });
const artistFiles = import.meta.glob<ArtistProfile>(['../data/artists/*.json', '!../data/artists/aliases.json'], {
  import: 'default',
});

const idFromPath = (p: string) => Number(p.match(/(\d+)\.json$/)?.[1]);
const noteLoaders = new Map(Object.entries(noteFiles).map(([p, load]) => [idFromPath(p), load]));
const artistLoaders = new Map(Object.entries(artistFiles).map(([p, load]) => [p.match(/([^/]+)\.json$/)![1], load]));
const discographyFiles = import.meta.glob<Discography>('../data/discography/*.json', { import: 'default' });
const discographyLoaders = new Map(
  Object.entries(discographyFiles).map(([p, load]) => [p.match(/([^/]+)\.json$/)![1], load]),
);

const profileOf = (artist: string) => {
  const slug = artistSlug(artist);
  return slug && artistLoaders.has(slug) ? slug : null;
};

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
      profile: profileOf(r.artist),
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

/**
 * The artist profile. Its curated discography stays as written; entries that
 * Discogs confirms (same title, year within one) get their Discogs master id,
 * which the site turns into a link. Discogs' own lists aren't shown: for big
 * catalogues they are full of regional editions, interview records and
 * archive releases.
 */
export async function loadArtist(slug: string): Promise<ArtistProfile | null> {
  const [profile, discogs] = await Promise.all([
    artistLoaders.get(slug)?.() ?? null,
    discographyLoaders.get(slug)?.() ?? null,
  ]);
  if (!profile || !discogs) return profile;
  const discography = profile.discography.map((entry) => {
    const match = discogs.releases.find((r) => sameTitle(r.title, entry.title) && Math.abs(r.year - entry.year) <= 1);
    return match ? { ...entry, master: match.master } : entry;
  });
  return { ...profile, discography };
}

/** Records per artist profile, to link discography entries we own. */
export const BY_PROFILE = new Map<string, Rec[]>();
for (const r of RECORDS) if (r.profile) BY_PROFILE.set(r.profile, [...(BY_PROFILE.get(r.profile) ?? []), r]);

/** Display name per profile: the record artist whose name is the slug itself. */
export const PROFILE_NAME = new Map<string, string>();
for (const r of RECORDS) if (r.profile && slugify(r.artist) === r.profile) PROFILE_NAME.set(r.profile, r.artist);

export { sameTitle, titleKey } from './lib/titles.ts';
