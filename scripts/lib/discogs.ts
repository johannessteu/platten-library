// Minimal Discogs API client with polite throttling.
// Works without a token (25 requests/min); DISCOGS_TOKEN raises that to 60/min.

const API = 'https://api.discogs.com';
export const USER_AGENT = 'PlattenLibrary/1.0 +https://github.com/johannessteu/platten-library';

const token = process.env.DISCOGS_TOKEN || '';
const MIN_INTERVAL_MS = token ? 1100 : 2600;
let lastRequest = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (token) h.Authorization = `Discogs token=${token}`;
  return h;
}

export async function api<T>(path: string): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();

    const res = await fetch(API + path, { headers: headers() });
    if (res.status === 429) {
      console.warn(`  rate limited on ${path}, waiting a minute (attempt ${attempt})`);
      await sleep(60_000);
      continue;
    }
    if (!res.ok) throw new Error(`Discogs answered ${res.status} for ${path}`);

    const remaining = Number(res.headers.get('x-discogs-ratelimit-remaining') ?? '99');
    if (remaining <= 1) await sleep(60_000);
    return (await res.json()) as T;
  }
  throw new Error(`Discogs kept rate limiting ${path}`);
}

export interface Download {
  bytes: Uint8Array;
  ext: 'jpg' | 'png' | 'webp';
}

/** Downloads an image; returns null for placeholders, errors and non-images. */
export async function downloadImage(url: string): Promise<Download | null> {
  if (!url || url.includes('spacer.gif')) return null;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return null;
  const type = res.headers.get('content-type') ?? '';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('jpeg') || type.includes('jpg') ? 'jpg' : null;
  if (!ext) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), ext };
}

// The parts of the Discogs responses we read.

export interface DArtist {
  name: string;
  join?: string;
}

export interface DFormat {
  name: string;
  qty?: string;
  descriptions?: string[];
}

export interface DBasicInformation {
  id: number;
  master_id?: number;
  title: string;
  year: number;
  cover_image?: string;
  artists: DArtist[];
  formats?: DFormat[];
  labels?: { name: string; catno: string }[];
  genres?: string[];
  styles?: string[];
}

export interface DCollectionItem {
  id: number;
  instance_id: number;
  date_added: string;
  basic_information: DBasicInformation;
}

export interface DCollectionPage {
  pagination: { page: number; pages: number; items: number };
  releases: DCollectionItem[];
}

export interface DTrack {
  position: string;
  title: string;
  duration: string;
  type_: string;
  sub_tracks?: DTrack[];
}

export interface DRelease {
  id: number;
  master_id?: number;
  country?: string;
  labels?: { name: string; catno: string }[];
  tracklist?: DTrack[];
  images?: { type: string; uri: string }[];
}

export interface DMaster {
  year?: number;
}
