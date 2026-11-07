// Lists records that have no liner notes yet.
//   npm run notes:todo            readable list, newest additions first
//   npm run notes:todo -- --json  JSON for the liner-notes skill

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RecordData } from '../src/types.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const recordsDir = path.join(ROOT, 'data/records');
const notesDir = path.join(ROOT, 'data/notes');

const files = (await readdir(recordsDir)).filter((f) => f.endsWith('.json'));
const records = await Promise.all(
  files.map(async (f) => JSON.parse(await readFile(path.join(recordsDir, f), 'utf8')) as RecordData),
);
const todo = records
  .filter((r) => !existsSync(path.join(notesDir, `${r.id}.json`)))
  .sort((a, b) => b.addedAt.localeCompare(a.addedAt));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(todo.map((r) => ({ id: r.id, artist: r.artist, title: r.title, originalYear: r.originalYear })), null, 2));
} else if (!todo.length) {
  console.log('Every record has liner notes.');
} else {
  console.log(`${todo.length} of ${records.length} records have no liner notes yet:\n`);
  for (const r of todo) console.log(`  ${String(r.id).padEnd(10)} ${r.artist} – ${r.title}${r.originalYear ? ` (${r.originalYear})` : ''}`);
  console.log('\nIn Claude Code: /liner-notes <id> … or "/liner-notes alle fehlenden"');
}
