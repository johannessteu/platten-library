// Matching album titles across sources (records, profiles, Discogs) that
// spell the same album slightly differently. Pure, so the site and the
// scripts in scripts/ share it.

import { norm } from './format.ts';

/** Title key: no case, accents, punctuation or (…) suffixes. */
export const titleKey = (t: string) =>
  norm(t.replace(/\s*\([^)]*\)/g, ' '))
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Same album under slightly different titles: equal keys, or one contains the
 * other when the shorter has at least three words ("Von allem anders" inside
 * "Unplugged 2 – Von allem anders", but not "Greatest Hits" in "… Vol. 2").
 */
export function sameTitle(a: string, b: string): boolean {
  const ka = titleKey(a);
  const kb = titleKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return short.split(' ').length >= 3 && ` ${long} `.includes(` ${short} `);
}
