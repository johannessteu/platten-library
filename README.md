# platten-library

Our vinyl shelf as a small website, so friends and guests can flip through the records, search for something specific and pick what to put on. It lives at [platten.johannessteu.de](https://platten.johannessteu.de).

- **Blättern**: a cover flow with reflections. Drag, swipe or scroll sideways, use the arrow keys, the slider or the A–Z letters.
- **Raster**: all covers as a grid.
- **Suche und Filter**: search artist, album, genre or label (accents don't matter); filter by genre, sort A–Z or by newest arrival.
- **Details**: cover with the vinyl sliding out, facts about our pressing, the tracklist, and German liner notes. „Mehr über …“ expands a longer artist profile (career, sound, highlights, discography with links to the records we own). Every record has its own link: `#/platte/<discogs-id>`.

The site is Vite + Preact + TypeScript, built to static files and hosted on GitHub Pages. Fonts and covers are served from the site itself, nothing loads from third parties.

## How the content gets here

Records are added on Discogs by hand; after that the **Update** workflow in GitHub Actions does the rest. Start it under Actions → Update → Run workflow, or with `gh workflow run update.yml` (or ask Claude Code to run it):

```
npm run sync                 ──▶ data/records/<id>.json + public/covers/<id>.jpg
/liner-notes alle fehlenden  ──▶ data/notes/<id>.json      (only records without notes)
   (Claude Code)             ──▶ data/artists/<slug>.json  (only artists without a profile)
npm run check                    (new notes that fail are left out)
npm run discography          ──▶ data/discography/<slug>.json (new artists only)
commit to main ──▶ Deploy ──▶ platten.johannessteu.de + regal.json ──▶ Supabase copy
```

If Claude Code fails (token, usage limits) or what it wrote fails the check, the records still go online without notes and the run ends red with the reason. Tick “refresh” to re-read details and tracklists of every record. Everything also works locally with the same commands, or `/liner-notes <id>` for a single record; a push to `main` deploys.

### Secrets

Set once with `gh secret set <NAME>`; the workflows run without them, just with less:

| Secret | What | Without it |
|---|---|---|
| `DISCOGS_TOKEN` | Personal access token from Discogs → Settings → Developers | Discogs allows 25 instead of 60 requests a minute |
| `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token`; Claude Code runs on the Claude subscription, not on API billing | Records are added without liner notes |
| `SUPABASE_ANON_KEY` | Anon key of the Supabase project bean-go (Project Settings → API keys) | The Supabase copy for Claude chats isn't refreshed |

Don't add an `ANTHROPIC_API_KEY` secret: Claude Code would use it instead of the subscription and bill the API.

### Records and covers: `npm run sync`

`scripts/sync.ts` reads the public Discogs collection of `stolle87` and

- adds records that are new on Discogs: release details (tracklist, labels, country), the original release year from the master release, and the 600 px cover;
- refreshes the basics of existing records from the collection listing;
- removes records that are no longer in the collection (their liner notes stay in `data/notes`).

No token is needed. Without one Discogs allows 25 requests a minute, so a new record takes about five seconds. `npm run sync -- --refresh` re-fetches details and tracklists for every record; add `--covers` to re-download the covers as well (they are kept otherwise, since Discogs re-encodes images and every download would show up as a change in git).

Optional environment variables (the same in CI, from the secrets):

| Name | What |
|---|---|
| `DISCOGS_USERNAME` | Collection to read, defaults to `stolle87` |
| `DISCOGS_TOKEN` | Personal access token from Discogs → Settings → Developers, for faster syncs |

### Liner notes: Claude Code

Notes are written with the project skill in `.claude/skills/liner-notes`, a tuned version of the artist-profile skill: same research rules, German, short, written to JSON. The skill researches each record, writes `data/notes/<id>.json` against `schema/notes.schema.json` and runs `npm run check`.

The same skill writes one artist profile per artist for „Mehr über …“: `data/artists/<slug>.json` against `schema/artist.schema.json` (the artist-profile skill's artist mode as JSON). The slug comes from `src/lib/artists.ts`; records credited differently but belonging to the same artist are mapped in `data/artists/aliases.json`.

The Update workflow runs it for every record without notes and every artist without a profile. Notes that fail `npm run check` and can't be fixed are left out, so the record shows “Noch keine Plattennotizen” until the next run.

To write or rewrite notes yourself:

```sh
npm run notes:todo          # which records have no notes yet
```

Then in Claude Code in this repo: `/liner-notes 28537558` or `/liner-notes alle fehlenden`. Read the notes, then commit and push; the push deploys.

### Discographies from the Discogs API: `npm run discography`

`scripts/discography.ts` links the curated discography of each artist profile to Discogs. It reads the artist's Discogs listing (`/artists/{id}/releases`), takes the master releases with the same title and a year within one of a curated entry, and checks each candidate's format, so a single or bootleg that shares an album's title isn't linked. The matches go to `data/discography/<slug>.json`; the site turns them into links to the Discogs master pages.

It only builds artists that have a profile but no file yet; `--only <slug>` rebuilds one artist and `--all` every artist. A small act takes seconds, a huge catalogue a few minutes (The Beatles list about 10,000 entries). The site doesn't show Discogs' own lists: for big catalogues they are full of regional editions, interview records and archive releases.

The first 40 files were built in November 2026 from the Discogs data dump instead (field `dump`); they list every release and work the same way.

### The shelf in Claude chats: `regal.json` and Supabase

Every build also writes `dist/regal.json` (`scripts/regal.ts`): all records with their liner notes and the profiles of the artists on the shelf in one file, published at [platten.johannessteu.de/regal.json](https://platten.johannessteu.de/regal.json).

A read-only copy lives in the Supabase project **bean-go**, in the tables `platten`, `platten_artists` and `platten_sync`. They are separate from RecordZ's `records` tables in the same project. After every deploy, the Deploy workflow waits until the new `regal.json` is live and calls the edge function `platten-sync` (source in `supabase/functions/platten-sync`, deployed with the Supabase MCP). It replaces the copy when the records or artists have changed and does nothing when they haven't. The repo stays the source of truth: never edit the tables by hand.

Claude chats read the copy through the Supabase connector. The skill in `claude-skill/plattenregal` tells Claude where the shelf is and how to suggest records for an evening; upload it as a zip under Settings → Capabilities → Skills on claude.ai.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # validates records, covers, notes and artist profiles
npm run discography  # link new artists' albums to Discogs
npm run build      # type check + static build into dist/, plus dist/regal.json
```

Node 24 or newer: the scripts in `scripts/` are TypeScript run directly by Node.

## Hosting

GitHub Pages with the **GitHub Actions** source. `Deploy` runs on every push to `main` and at the end of the Update workflow.

Custom domain: `platten.johannessteu.de` is a DNS `CNAME` to `johannessteu.github.io`, set as the custom domain under Settings → Pages with “Enforce HTTPS” on. The build uses relative paths, so it works on any host or sub-path.