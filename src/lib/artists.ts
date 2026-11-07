// Maps an artist name from a record to the file name of its artist profile
// in data/artists/<slug>.json. Shared by the site and the scripts.

import aliases from '../../data/artists/aliases.json' with { type: 'json' };

/** Artists that never get a profile. */
const NO_PROFILE = new Set(['Various']);

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Profile slug for a record's artist, or null when the artist gets none. */
export function artistSlug(artist: string): string | null {
  if (NO_PROFILE.has(artist)) return null;
  return (aliases as Record<string, string>)[artist] ?? slugify(artist);
}
