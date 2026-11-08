// Writes dist/regal.json: the whole shelf (records, liner notes, artist
// profiles) as one machine-readable file next to the site. After every deploy
// the Supabase edge function platten-sync copies it into the platten tables,
// so Claude chats can read the shelf.
//
// Rows are shaped like those tables (snake_case columns); keep both in step.
// Runs after `vite build`; --out <file> writes somewhere else.

import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ArtistProfile, Notes, RecordData } from '../src/types.ts';
import { artistSlug } from '../src/lib/artists.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://platten.johannessteu.de/';
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(ROOT, 'dist/regal.json');

async function readDir<T>(dir: string, skip: string[] = []): Promise<Map<string, T>> {
  const files = (await readdir(path.join(ROOT, dir))).filter((f) => f.endsWith('.json') && !skip.includes(f)).sort();
  const entries = await Promise.all(
    files.map(async (f) => [f.replace(/\.json$/, ''), JSON.parse(await readFile(path.join(ROOT, dir, f), 'utf8'))] as const),
  );
  return new Map(entries);
}

const records = await readDir<RecordData>('data/records');
const notes = await readDir<Notes>('data/notes');
const profiles = await readDir<ArtistProfile>('data/artists', ['aliases.json']);

const recordRows = [...records.values()]
  .sort((a, b) => a.sortName.localeCompare(b.sortName, 'de') || a.title.localeCompare(b.title, 'de'))
  .map((r) => {
    const n = notes.get(String(r.id));
    const slug = artistSlug(r.artist);
    return {
      id: r.id,
      artist: r.artist,
      title: r.title,
      year: r.originalYear ?? r.year,
      pressing_year: r.year,
      genres: r.genres,
      styles: r.styles,
      format: r.format,
      labels: [...new Set(r.labels.map((l) => l.name))],
      country: r.country,
      added_at: r.addedAt,
      mood: n?.tag ?? null,
      kicker: n?.kicker ?? null,
      about_record: n?.record ?? null,
      about_artist: n?.band ?? null,
      start_with: n?.start ?? [],
      facts: n?.facts ?? [],
      trivia: n?.trivia ?? [],
      similar_artists: n?.similar ?? [],
      tracklist: r.tracklist,
      artist_slug: slug && profiles.has(slug) ? slug : null,
      page_url: `${SITE}#/platte/${r.id}`,
      cover_url: r.cover ? SITE + r.cover : null,
      discogs_url: r.discogsUrl,
    };
  });

// Profiles of artists who are no longer on the shelf stay in the repo for
// later, but aren't part of the shelf.
const onShelf = new Set(recordRows.map((r) => r.artist_slug).filter(Boolean));
const artistRows = [...profiles.entries()].filter(([slug]) => onShelf.has(slug)).map(([slug, p]) => ({
  slug,
  name: p.name,
  summary: p.summary,
  career: p.career,
  sound: p.sound,
  highlights: p.highlights,
  discography: p.discography.map(({ title, year, type, note }) => ({ title, year, type, note: note ?? null })),
}));

/** The commit being built, so the deploy can tell when this file is live. */
function commit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const shelf = {
  site: SITE,
  generated_at: new Date().toISOString(),
  commit: commit(),
  records: recordRows,
  artists: artistRows,
};

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(shelf));
console.log(`${path.relative(ROOT, OUT)}: ${recordRows.length} records, ${artistRows.length} artists.`);
