// Syncs data/records and public/covers with the Discogs collection.
//
//   npm run sync               add new records, drop removed ones, refresh basics
//   npm run sync -- --refresh  also re-fetch details and covers for every record
//
// New records cost two API calls (release + master) plus one cover download.
// Existing records are updated from the collection listing alone.

import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Label, RecordData, Track } from '../src/types.ts';
import {
  api,
  downloadImage,
  type DArtist,
  type DCollectionItem,
  type DCollectionPage,
  type DFormat,
  type DMaster,
  type DRelease,
  type DTrack,
} from './lib/discogs.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const RECORDS_DIR = path.join(ROOT, 'data/records');
const COVERS_DIR = path.join(ROOT, 'public/covers');
const USERNAME = process.env.DISCOGS_USERNAME || 'stolle87';
const REFRESH = process.argv.includes('--refresh');

const cleanName = (s: string) => s.replace(/\s+\(\d+\)$/, '').replace(/\*$/, '').trim();

function artistName(artists: DArtist[]): string {
  return artists
    .map((a, i) => {
      const name = cleanName(a.name);
      if (i === artists.length - 1) return name;
      const join = (a.join || ',').trim();
      return name + (join === ',' ? ', ' : ` ${join} `);
    })
    .join('');
}

function formatLabel(formats: DFormat[] = []): { format: string; details: string[] } {
  const vinyl = formats.filter((f) => f.name === 'Vinyl');
  const details = [...new Set(vinyl.flatMap((f) => f.descriptions ?? []))];
  const qty = vinyl.reduce((n, f) => n + (parseInt(f.qty ?? '1', 10) || 1), 0);
  if (formats.some((f) => f.name === 'Box Set')) return { format: 'Box-Set', details };
  if (details.includes('7"')) return { format: '7"', details };
  if (details.includes('10"')) return { format: '10"', details };
  return { format: qty > 1 ? `${qty}×LP` : 'LP', details };
}

function flattenTracks(list: DTrack[] = []): Track[] {
  const out: Track[] = [];
  for (const t of list) {
    if (t.type_ === 'track') out.push({ position: t.position.trim(), title: t.title.trim(), duration: t.duration.trim() });
    else if (t.type_ === 'index') out.push(...flattenTracks(t.sub_tracks ?? []).map((s) => ({ ...s, position: s.position || t.position })));
  }
  return out;
}

function uniqueLabels(labels: { name: string; catno: string }[] = []): Label[] {
  const seen = new Set<string>();
  const out: Label[] = [];
  for (const l of labels) {
    const name = cleanName(l.name);
    const key = `${name}|${l.catno}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, catno: l.catno === 'none' ? '' : l.catno });
  }
  return out.slice(0, 3);
}

const sortName = (artist: string) =>
  artist
    .replace(/^the\s+/i, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

async function readExisting(): Promise<Map<number, RecordData>> {
  const map = new Map<number, RecordData>();
  await mkdir(RECORDS_DIR, { recursive: true });
  for (const file of await readdir(RECORDS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const rec = JSON.parse(await readFile(path.join(RECORDS_DIR, file), 'utf8')) as RecordData;
    map.set(rec.id, rec);
  }
  return map;
}

async function fetchCollection(): Promise<DCollectionItem[]> {
  const items: DCollectionItem[] = [];
  for (let page = 1; ; page++) {
    const data = await api<DCollectionPage>(
      `/users/${encodeURIComponent(USERNAME)}/collection/folders/0/releases?per_page=100&page=${page}&sort=added&sort_order=asc`,
    );
    items.push(...data.releases);
    if (page >= data.pagination.pages) break;
  }
  // The same release can be in the collection twice; keep the first copy.
  const seen = new Set<number>();
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
}

async function saveCover(id: number, urls: (string | undefined)[]): Promise<string | null> {
  for (const url of urls) {
    if (!url) continue;
    const img = await downloadImage(url);
    if (!img) continue;
    const file = `${id}.${img.ext}`;
    await writeFile(path.join(COVERS_DIR, file), img.bytes);
    return `covers/${file}`;
  }
  return null;
}

async function writeIfChanged(file: string, data: unknown): Promise<boolean> {
  const next = JSON.stringify(data, null, 2) + '\n';
  const prev = await readFile(file, 'utf8').catch(() => '');
  if (prev === next) return false;
  await writeFile(file, next);
  return true;
}

async function main() {
  await mkdir(COVERS_DIR, { recursive: true });
  const existing = await readExisting();
  console.log(`Reading the Discogs collection of ${USERNAME}…`);
  const items = await fetchCollection();
  console.log(`${items.length} records on Discogs, ${existing.size} in the repo.`);

  const added: RecordData[] = [];
  let updated = 0;

  for (const [i, item] of items.entries()) {
    const b = item.basic_information;
    const prev = existing.get(item.id);
    const artist = artistName(b.artists);
    const title = b.title.trim();
    const { format, details } = formatLabel(b.formats);

    let originalYear = prev?.originalYear ?? null;
    let country = prev?.country ?? null;
    let tracklist = prev?.tracklist ?? [];
    let labels = prev?.labels ?? uniqueLabels(b.labels);
    let cover = prev?.cover ?? null;
    let releaseImage: string | undefined;

    if (!prev || REFRESH) {
      console.log(`  [${i + 1}/${items.length}] ${artist} – ${title}`);
      const rel = await api<DRelease>(`/releases/${item.id}`);
      country = rel.country || null;
      tracklist = flattenTracks(rel.tracklist);
      labels = uniqueLabels(rel.labels ?? b.labels);
      releaseImage = rel.images?.find((im) => im.type === 'primary')?.uri ?? rel.images?.[0]?.uri;
      const masterId = rel.master_id || b.master_id;
      if (masterId) {
        try {
          originalYear = (await api<DMaster>(`/masters/${masterId}`)).year || null;
        } catch (err) {
          console.warn(`    no master year: ${(err as Error).message}`);
        }
      }
      originalYear ??= b.year || null;
    }

    if (!cover || REFRESH) {
      cover = (await saveCover(item.id, [b.cover_image, releaseImage])) ?? cover;
    }

    const rec: RecordData = {
      id: item.id,
      artist,
      title,
      year: b.year || null,
      originalYear,
      genres: b.genres ?? [],
      styles: b.styles ?? [],
      format,
      formatDetails: details,
      labels,
      country,
      tracklist,
      addedAt: item.date_added.slice(0, 10),
      cover,
      discogsUrl: `https://www.discogs.com/release/${item.id}`,
      sortName: sortName(artist),
    };

    const changed = await writeIfChanged(path.join(RECORDS_DIR, `${item.id}.json`), rec);
    if (!prev) added.push(rec);
    else if (changed) updated++;
  }

  const onDiscogs = new Set(items.map((it) => it.id));
  const removed = [...existing.values()].filter((r) => !onDiscogs.has(r.id));
  for (const r of removed) {
    await rm(path.join(RECORDS_DIR, `${r.id}.json`), { force: true });
    if (r.cover) await rm(path.join(ROOT, 'public', r.cover), { force: true });
  }

  const missingCovers = [...(await readExisting()).values()].filter((r) => !r.cover).length;
  const parts = [
    added.length && `${added.length} added`,
    removed.length && `${removed.length} removed`,
    updated && `${updated} updated`,
  ].filter(Boolean);
  const summary = parts.length ? parts.join(', ') : 'nothing changed';
  console.log(`Done: ${summary}.${missingCovers > 0 ? ` ${missingCovers} records have no cover.` : ''}`);
  for (const r of added) console.log(`  + ${r.artist} – ${r.title}`);
  for (const r of removed) console.log(`  - ${r.artist} – ${r.title}`);

  if (process.env.GITHUB_OUTPUT) {
    const message =
      added.length === 1 && !removed.length
        ? `Add ${added[0].artist} – ${added[0].title} from Discogs`
        : added.length && !removed.length
          ? `Add ${added.length} records from Discogs`
          : removed.length && !added.length
            ? `Remove ${removed.length} records that left the Discogs collection`
            : `Sync records from Discogs (${summary})`;
    await appendFile(process.env.GITHUB_OUTPUT, `message=${message}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
