// Lists records without liner notes and artists without a profile.
//   npm run notes:todo            readable list, newest additions first
//   npm run notes:todo -- --json  JSON for the liner-notes skill:
//                                 { "records": [...], "artists": [...] }

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { artistSlug } from '../src/lib/artists.ts';
import type { RecordData } from '../src/types.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const recordsDir = path.join(ROOT, 'data/records');

const files = (await readdir(recordsDir)).filter((f) => f.endsWith('.json'));
const records = await Promise.all(
  files.map(async (f) => JSON.parse(await readFile(path.join(recordsDir, f), 'utf8')) as RecordData),
);
records.sort((a, b) => b.addedAt.localeCompare(a.addedAt));

const todoRecords = records.filter((r) => !existsSync(path.join(ROOT, 'data/notes', `${r.id}.json`)));

const todoArtists = new Map<string, { slug: string; artist: string; records: string[] }>();
for (const r of records) {
  const slug = artistSlug(r.artist);
  if (!slug || existsSync(path.join(ROOT, 'data/artists', `${slug}.json`))) continue;
  const entry = todoArtists.get(slug) ?? { slug, artist: r.artist, records: [] };
  entry.records.push(r.title);
  todoArtists.set(slug, entry);
}

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        records: todoRecords.map((r) => ({ id: r.id, artist: r.artist, title: r.title, originalYear: r.originalYear })),
        artists: [...todoArtists.values()],
      },
      null,
      2,
    ),
  );
} else {
  if (!todoRecords.length) console.log('Every record has liner notes.');
  else {
    console.log(`${todoRecords.length} of ${records.length} records have no liner notes yet:\n`);
    for (const r of todoRecords) console.log(`  ${String(r.id).padEnd(10)} ${r.artist} – ${r.title}${r.originalYear ? ` (${r.originalYear})` : ''}`);
  }
  console.log('');
  if (!todoArtists.size) console.log('Every artist has a profile.');
  else {
    console.log(`${todoArtists.size} artists have no profile yet:\n`);
    for (const a of todoArtists.values()) console.log(`  ${a.slug.padEnd(40)} ${a.artist}`);
  }
  if (todoRecords.length || todoArtists.size) console.log('\nIn Claude Code: /liner-notes alle fehlenden');
}
