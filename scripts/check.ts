// Validates data/records and data/notes before a build.
//   npm run check
// Notes are checked against schema/notes.schema.json (the subset of JSON Schema it uses).

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RecordData } from '../src/types.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

interface Schema {
  type?: 'object' | 'array' | 'string' | 'number';
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
  items?: Schema;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
}

function validate(value: unknown, schema: Schema, at: string, errors: string[]) {
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return void errors.push(`${at}: expected an object`);
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in obj)) errors.push(`${at}: missing "${key}"`);
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties?.[key];
      if (sub) validate(v, sub, `${at}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unexpected "${key}"`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return void errors.push(`${at}: expected an array`);
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${at}: at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => validate(v, schema.items!, `${at}[${i}]`, errors));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return void errors.push(`${at}: expected a string`);
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength} characters`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${at}: ${value.length} characters, max ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: does not match ${schema.pattern}`);
  }
}

async function readJsonDir<T>(dir: string): Promise<[string, T][]> {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map(async (f) => [f, JSON.parse(await readFile(path.join(dir, f), 'utf8')) as T] as [string, T]));
}

async function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  const records = await readJsonDir<RecordData>(path.join(ROOT, 'data/records'));
  const ids = new Set<number>();
  for (const [file, rec] of records) {
    if (`${rec.id}.json` !== file) errors.push(`records/${file}: id ${rec.id} does not match the file name`);
    for (const key of ['artist', 'title', 'format', 'addedAt', 'discogsUrl', 'sortName'] as const) {
      if (!rec[key]) errors.push(`records/${file}: missing ${key}`);
    }
    if (rec.cover && !existsSync(path.join(ROOT, 'public', rec.cover))) errors.push(`records/${file}: cover ${rec.cover} not found`);
    if (!rec.cover) warnings.push(`records/${file}: no cover (${rec.artist} – ${rec.title})`);
    ids.add(rec.id);
  }

  const schema = JSON.parse(await readFile(path.join(ROOT, 'schema/notes.schema.json'), 'utf8')) as Schema;
  const notes = await readJsonDir<unknown>(path.join(ROOT, 'data/notes'));
  for (const [file, note] of notes) {
    validate(note, schema, `notes/${file}`, errors);
    const id = Number(file.replace('.json', ''));
    if (!ids.has(id)) warnings.push(`notes/${file}: no record with this id on the shelf (kept for later)`);
  }

  for (const w of warnings) console.warn(`warn  ${w}`);
  for (const e of errors) console.error(`error ${e}`);
  console.log(`${records.length} records, ${notes.length} with notes, ${errors.length} errors, ${warnings.length} warnings.`);
  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
