// Builds data/discography/<slug>.json from the Discogs monthly data dump
// (https://data.discogs.com, CC0). Needs two files from the same month:
//
//   discogs_<date>_masters.xml.gz    every master release: artists, title, year, main release
//   discogs_<date>_releases.xml.gz   every release, with its formats (Album, Single, Compilation …)
//
//   npm run discography                   artists without a discography file yet
//   npm run discography -- --all          rebuild every artist
//   npm run discography -- --dir <path>   folder with the dump files (default ~/Downloads)
//
// Both files are streamed, never unpacked to disk. The masters pass is quick;
// the releases pass reads the whole multi-gigabyte file once and takes a while.

import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { artistSlug, slugify } from '../src/lib/artists.ts';
import type { DumpDiscography, RecordData, ReleaseType } from '../src/types.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'data/discography');
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const DIR = args.includes('--dir') ? path.resolve(args[args.indexOf('--dir') + 1]) : path.join(os.homedir(), 'Downloads');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : (ENTITIES[e] ?? m),
  );
/**
 * Copies a string out of the big read buffer. Substrings in V8 can keep their
 * whole parent string alive, so storing them would hold on to every 1 MB chunk.
 */
const own = (s: string) => Buffer.from(s, 'utf8').toString('utf8');

const between = (s: string, open: string, close: string) => {
  const a = s.indexOf(open);
  if (a === -1) return '';
  const b = s.indexOf(close, a + open.length);
  return b === -1 ? '' : s.slice(a + open.length, b);
};

function newestDump(kind: 'masters' | 'releases'): { file: string; date: string } | null {
  if (!existsSync(DIR)) return null;
  const re = new RegExp(`^discogs_(\\d{8})_${kind}\\.xml\\.gz$`);
  const files = readdirSync(DIR).filter((f) => re.test(f)).sort();
  const file = files.at(-1);
  if (!file) return null;
  const d = file.match(re)![1];
  return { file: path.join(DIR, file), date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` };
}

/**
 * Streams a gzipped dump and calls onElement for every <tag id="…">…</tag>
 * whose id passes `want`. Elements that aren't wanted are skipped without
 * being copied. Return false from onElement to stop early.
 */
async function scan(
  file: string,
  tag: string,
  want: (id: number) => boolean,
  onElement: (id: number, xml: string) => boolean | void,
): Promise<void> {
  const open = `<${tag} id="`;
  const close = `</${tag}>`;
  const stream = createReadStream(file, { highWaterMark: 1 << 20 }).pipe(createGunzip({ chunkSize: 1 << 20 }));
  stream.setEncoding('utf8');
  let buf = '';
  let seen = 0;
  let mb = 0;
  for await (const chunk of stream as AsyncIterable<string>) {
    buf += chunk;
    mb += chunk.length / 1e6;
    let pos = 0;
    for (;;) {
      const start = buf.indexOf(open, pos);
      if (start === -1) break;
      const end = buf.indexOf(close, start);
      if (end === -1) {
        pos = start;
        break;
      }
      const idEnd = buf.indexOf('"', start + open.length);
      const id = Number(buf.slice(start + open.length, idEnd));
      seen++;
      if (want(id) && onElement(id, buf.slice(start, end + close.length)) === false) {
        stream.destroy();
        return;
      }
      pos = end + close.length;
    }
    buf = buf.slice(pos);
    if (seen && seen % 500_000 < 2000 && mb > 1) {
      process.stdout.write(`\r  ${tag}s: ${(seen / 1e6).toFixed(1)} M read (${(mb / 1000).toFixed(1)} GB unpacked)   `);
    }
  }
  process.stdout.write(`\r  ${tag}s: ${(seen / 1e6).toFixed(2)} M read, done.                    \n`);
}

interface Master {
  id: number;
  slug: string;
  title: string;
  year: number;
  mainRelease: number;
  genres: string[];
}

function classify(m: Master, descriptions: string[]): ReleaseType | null {
  const d = new Set(descriptions);
  if (d.has('Unofficial Release') || d.has('Single') || d.has('Maxi-Single')) return null;
  if (d.has('Compilation')) return 'Compilation';
  if (d.has('EP') || d.has('Mini-Album')) return 'EP';
  if (!d.has('Album') && !d.has('LP')) return null;
  if (m.genres.includes('Stage & Screen')) return 'Soundtrack';
  if (/\b(live|unplugged|in concert)\b/i.test(m.title)) return 'Livealbum';
  return 'Studioalbum';
}

async function main() {
  const masters = newestDump('masters');
  const releases = newestDump('releases');
  if (!masters || !releases) {
    console.error(`Put discogs_<date>_masters.xml.gz and discogs_<date>_releases.xml.gz into ${DIR}`);
    console.error('(download from https://data.discogs.com, newest month), or pass --dir <folder>.');
    process.exit(1);
  }
  if (masters.date !== releases.date) console.warn(`Note: masters are from ${masters.date}, releases from ${releases.date}.`);

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
  for (const slug of [...targets.keys()]) {
    if (!ALL && existsSync(path.join(OUT_DIR, `${slug}.json`))) targets.delete(slug);
  }
  if (!targets.size) {
    console.log('Every artist has a discography. Use --all to rebuild.');
    return;
  }
  const slugById = new Map<number, string>();
  for (const [slug, t] of targets) for (const id of t.ids) slugById.set(id, slug);
  console.log(`Building ${targets.size} discographies from the Discogs dump of ${masters.date}.`);

  // Pass 1: masters credited to our artists.
  const found: Master[] = [];
  await scan(
    masters.file,
    'master',
    () => true,
    (id, xml) => {
      const artists = between(xml, '<artists>', '</artists>');
      let slug: string | undefined;
      for (const m of artists.matchAll(/<id>(\d+)<\/id>/g)) {
        slug = slugById.get(Number(m[1]));
        if (slug) break;
      }
      if (!slug) return;
      const head = xml.split('<videos>')[0];
      found.push({
        id,
        slug,
        title: own(decode(between(head, '<title>', '</title>')).trim()),
        year: Number(between(head, '<year>', '</year>')) || 0,
        mainRelease: Number(between(head, '<main_release>', '</main_release>')),
        genres: [...between(head, '<genres>', '</genres>').matchAll(/<genre>([^<]*)<\/genre>/g)].map((g) => own(decode(g[1]))),
      });
    },
  );
  console.log(`  ${found.length} masters by our artists.`);

  // Pass 2: formats of each master's main release. Stops as soon as all are found.
  const byRelease = new Map(found.map((m) => [m.mainRelease, m]));
  const formats = new Map<number, { descriptions: string[]; year: number }>();
  await scan(
    releases.file,
    'release',
    (id) => byRelease.has(id),
    (id, xml) => {
      const f = between(xml, '<formats>', '</formats>');
      formats.set(id, {
        descriptions: [...f.matchAll(/<description>([^<]*)<\/description>/g)].map((d) => own(decode(d[1]))),
        year: Number(between(xml, '<released>', '</released>').slice(0, 4)) || 0,
      });
      if (formats.size === byRelease.size) return false;
    },
  );

  await mkdir(OUT_DIR, { recursive: true });
  for (const [slug, t] of targets) {
    const seen = new Set<string>();
    const list: DumpDiscography['releases'] = [];
    for (const m of found.filter((m) => m.slug === slug)) {
      const fmt = formats.get(m.mainRelease);
      if (!fmt) continue;
      const type = classify(m, fmt.descriptions);
      const year = m.year || fmt.year;
      if (!type || !year) continue;
      const key = `${type}|${m.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ title: m.title, year, type, master: m.id });
    }
    list.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
    const out: DumpDiscography = { artist: t.name, discogsArtistIds: [...t.ids], dump: masters.date, releases: list };
    await writeFile(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(out, null, 2) + '\n');
    const counts = list.reduce<Record<string, number>>((c, r) => ((c[r.type] = (c[r.type] ?? 0) + 1), c), {});
    console.log(`  ${slug.padEnd(40)} ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing found'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
