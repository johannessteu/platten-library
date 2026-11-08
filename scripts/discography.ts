// Builds data/discography/<slug>.json from the Discogs API: the Discogs master
// releases that match the curated discography in the artist profile
// (data/artists/<slug>.json), so the site can link those albums to Discogs.
//
//   npm run discography                    artists with a profile but no discography file yet
//   npm run discography -- --all           rebuild every artist
//   npm run discography -- --only <slug>   rebuild one artist
//   npm run discography -- --out <dir>     write somewhere else (default data/discography)
//
// Per artist: one request per 100 entries of its Discogs listing, plus one per
// candidate master to read its format, so singles and bootlegs that share an
// album's title don't get linked. Small acts take seconds; a huge catalogue
// (The Beatles: about 100 listing pages) a few minutes. Without a token Discogs
// allows 25 requests a minute, with DISCOGS_TOKEN 60.
//
// Older files in data/discography were built from the Discogs data dump and
// list every release; they work the same way and are kept unless rebuilt.

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { artistSlug, slugify } from '../src/lib/artists.ts';
import { sameTitle, titleKey } from '../src/lib/titles.ts';
import type { ArtistProfile, Discography, RecordData, ReleaseType } from '../src/types.ts';
import { api, type DArtistRelease, type DArtistReleasesPage, type DRelease } from './lib/discogs.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const OUT_DIR = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(ROOT, 'data/discography');

/** The type of a master from its main release's formats; null for singles, bootlegs and non-albums. */
function classify(title: string, descriptions: string[], genres: string[]): ReleaseType | null {
  const d = new Set(descriptions);
  if (d.has('Unofficial Release') || d.has('Single') || d.has('Maxi-Single')) return null;
  if (d.has('Compilation')) return 'Compilation';
  if (d.has('EP') || d.has('Mini-Album')) return 'EP';
  if (!d.has('Album') && !d.has('LP')) return null;
  if (genres.includes('Stage & Screen')) return 'Soundtrack';
  if (/\b(live|unplugged|in concert)\b/i.test(title)) return 'Livealbum';
  return 'Studioalbum';
}

/** Every master credited to the artist as main artist. */
async function masters(artistId: number): Promise<DArtistRelease[]> {
  const out: DArtistRelease[] = [];
  for (let page = 1; ; page++) {
    const data = await api<DArtistReleasesPage>(`/artists/${artistId}/releases?sort=year&sort_order=asc&per_page=100&page=${page}`);
    out.push(...data.releases.filter((r) => r.type === 'master' && r.role === 'Main' && r.main_release));
    if (page >= data.pagination.pages) return out;
    if (page % 10 === 0) console.log(`    … page ${page} of ${data.pagination.pages}`);
  }
}

async function main() {
  // Which artists, and their Discogs ids: the main artist of records credited
  // under the profile's own name ("Elton John"), else of any record mapped to it.
  const records: RecordData[] = await Promise.all(
    (await readdir(path.join(ROOT, 'data/records')))
      .filter((f) => f.endsWith('.json'))
      .map(async (f) => JSON.parse(await readFile(path.join(ROOT, 'data/records', f), 'utf8'))),
  );
  const targets = new Map<string, { name: string; ids: Set<number>; canonical: boolean }>();
  for (const r of records) {
    const slug = artistSlug(r.artist);
    const id = r.artistIds?.[0];
    if (!slug || !id) continue;
    const canonical = slugify(r.artist) === slug;
    const t = targets.get(slug);
    if (!t || (canonical && !t.canonical)) targets.set(slug, { name: r.artist, ids: new Set([id]), canonical });
    else if (canonical === t.canonical) t.ids.add(id);
  }

  const todo = [...targets.keys()].filter((slug) => {
    if (ONLY) return slug === ONLY;
    return ALL || !existsSync(path.join(OUT_DIR, `${slug}.json`));
  });
  if (ONLY && !todo.length) {
    console.error(`No artist "${ONLY}" on the shelf.`);
    process.exit(1);
  }
  if (!todo.length) {
    console.log('Every artist has a discography. Use --all or --only <slug> to rebuild.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  let built = 0;
  for (const slug of todo) {
    const t = targets.get(slug)!;
    const profileFile = path.join(ROOT, 'data/artists', `${slug}.json`);
    if (!existsSync(profileFile)) {
      console.log(`  ${slug.padEnd(40)} no artist profile yet, skipped`);
      continue;
    }
    const profile: ArtistProfile = JSON.parse(await readFile(profileFile, 'utf8'));

    const listed: DArtistRelease[] = [];
    for (const id of t.ids) listed.push(...(await masters(id)));

    // For every curated entry, the masters with the same title and a year
    // within one; the first whose format fits wins, preferring the same type.
    // A title that only contains the entry's title ("Land & Sea x Four Feet in
    // the Forest" for "Four Feet in the Forest") needs the same type as well.
    const found = new Map<number, Discography['releases'][number]>();
    const typeOf = new Map<number, ReleaseType | null>();
    for (const entry of profile.discography) {
      const candidates = listed
        .filter((m) => sameTitle(m.title, entry.title) && Math.abs((m.year ?? 0) - entry.year) <= 1)
        .sort((a, b) => Math.abs((a.year ?? 0) - entry.year) - Math.abs((b.year ?? 0) - entry.year));
      let pick: { m: DArtistRelease; type: ReleaseType } | null = null;
      for (const m of candidates) {
        if (!typeOf.has(m.id)) {
          const main = await api<DRelease>(`/releases/${m.main_release}`);
          const descriptions = (main.formats ?? []).flatMap((f) => [f.name, ...(f.descriptions ?? [])]);
          typeOf.set(m.id, classify(m.title, descriptions, main.genres ?? []));
        }
        const type = typeOf.get(m.id);
        if (!type) continue;
        if (type === entry.type) {
          pick = { m, type };
          break;
        }
        if (titleKey(m.title) === titleKey(entry.title)) pick ??= { m, type };
      }
      if (pick) found.set(pick.m.id, { title: pick.m.title, year: pick.m.year ?? entry.year, type: pick.type, master: pick.m.id });
    }

    const releases = [...found.values()].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
    const out: Discography = { artist: t.name, discogsArtistIds: [...t.ids], fetchedAt: today, releases };
    await writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(out, null, 2) + '\n');
    built++;
    console.log(`  ${slug.padEnd(40)} ${releases.length} of ${profile.discography.length} albums on Discogs (${listed.length} masters listed)`);
  }
  console.log(`Done: ${built} discograph${built === 1 ? 'y' : 'ies'} written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
