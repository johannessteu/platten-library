// platten-sync: copies the vinyl shelf of platten.johannessteu.de into the
// tables platten, platten_artists and platten_sync of the Supabase project
// bean-go, so Claude chats with the Supabase connector can read it.
//
// Source: https://platten.johannessteu.de/regal.json, written by every build
// of github.com/johannessteu/platten-library (scripts/regal.ts). The repo is
// the source of truth; the tables are a read-only copy, replaced whenever
// regal.json changes. Rows that are no longer in regal.json are removed.
//
// Called by the site's Deploy workflow once the new regal.json is live, with
// the project's anon key. Returns { unchanged: true } when the records and
// artists are the same as last time (code-only deploys). Add ?force to copy
// anyway.
//
// Deployed from this file with the Supabase MCP (deploy_edge_function,
// verify_jwt on); the copy in Supabase is not edited by hand.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE = "https://platten.johannessteu.de/regal.json";

const RECORD_COLUMNS = [
  "id", "artist", "title", "year", "pressing_year", "genres", "styles", "format",
  "labels", "country", "added_at", "mood", "kicker", "about_record", "about_artist",
  "start_with", "facts", "trivia", "similar_artists", "tracklist", "artist_slug",
  "page_url", "cover_url", "discogs_url",
] as const;
const ARTIST_COLUMNS = [
  "slug", "name", "summary", "career", "sound", "highlights", "discography",
] as const;

type Row = Record<string, unknown>;
interface Shelf {
  generated_at: string;
  records: Row[];
  artists: Row[];
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Only the known columns, so a stray field in regal.json can't break the upsert. */
function pick(row: Row, columns: readonly string[], syncedAt: string): Row {
  const out: Row = { synced_at: syncedAt };
  for (const c of columns) if (c in row) out[c] = row[c];
  return out;
}

function check(shelf: Shelf): string | null {
  if (!Array.isArray(shelf.records) || !Array.isArray(shelf.artists)) return "records or artists missing";
  if (!shelf.records.length) return "no records";
  for (const r of shelf.records) {
    if (!Number.isInteger(r.id) || typeof r.artist !== "string" || typeof r.title !== "string" || typeof r.page_url !== "string") {
      return `malformed record ${JSON.stringify(r).slice(0, 120)}`;
    }
  }
  for (const a of shelf.artists) {
    if (typeof a.slug !== "string" || typeof a.name !== "string") return `malformed artist ${JSON.stringify(a).slice(0, 120)}`;
  }
  return null;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);

  try {
    // The query string gets past the CDN cache right after a deploy.
    const res = await fetch(`${SOURCE}?t=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) return reply({ error: `regal.json answered ${res.status}` }, 502);
    const shelf = (await res.json()) as Shelf;
    // Only the shelf itself counts; generated_at and commit change with every build.
    const hash = await sha256(JSON.stringify([shelf.records, shelf.artists]));

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const force = new URL(req.url).searchParams.has("force");
    const { data: state, error: stateError } = await db.from("platten_sync").select("source_hash").maybeSingle();
    if (stateError) throw stateError;
    if (!force && state?.source_hash === hash) return reply({ unchanged: true });

    const problem = check(shelf);
    if (problem) return reply({ error: `regal.json rejected: ${problem}` }, 422);

    // A file that suddenly lists far fewer records is more likely broken than
    // a shelf that lost half its records; keep the copy as it is.
    const { count, error: countError } = await db.from("platten").select("id", { count: "exact", head: true });
    if (countError) throw countError;
    if (count && shelf.records.length < count / 2) {
      return reply({ error: `regal.json has ${shelf.records.length} records, the copy ${count}; not replacing` }, 422);
    }

    const now = new Date().toISOString();
    const records = shelf.records.map((r) => pick(r, RECORD_COLUMNS, now));
    const artists = shelf.artists.map((a) => pick(a, ARTIST_COLUMNS, now));

    const up1 = await db.from("platten").upsert(records, { onConflict: "id" });
    if (up1.error) throw up1.error;
    const up2 = await db.from("platten_artists").upsert(artists, { onConflict: "slug" });
    if (up2.error) throw up2.error;

    // Everything in this file was just stamped with `now`; older rows are gone from the shelf.
    const gone1 = await db.from("platten").delete({ count: "exact" }).lt("synced_at", now);
    if (gone1.error) throw gone1.error;
    const gone2 = await db.from("platten_artists").delete({ count: "exact" }).lt("synced_at", now);
    if (gone2.error) throw gone2.error;

    const summary = {
      source_hash: hash,
      generated_at: shelf.generated_at,
      records: records.length,
      artists: artists.length,
      synced_at: now,
    };
    const saved = await db.from("platten_sync").upsert({ id: true, ...summary });
    if (saved.error) throw saved.error;

    return reply({ ...summary, removed: { records: gone1.count ?? 0, artists: gone2.count ?? 0 } });
  } catch (e) {
    console.error("platten-sync failed", e);
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
    return reply({ error: message }, 500);
  }
});
