# platten-library

Our vinyl shelf as a small website, so friends and guests can flip through the records, search for something specific and pick what to put on. It lives at [platten.johannessteu.de](https://platten.johannessteu.de).

- **Blättern**: a cover flow with reflections. Drag, swipe or scroll sideways, use the arrow keys, the slider or the A–Z letters.
- **Raster**: all covers as a grid.
- **Suche und Filter**: search artist, album, genre or label (accents don't matter); filter by genre, sort A–Z or by newest arrival.
- **Details**: cover with the vinyl sliding out, facts about our pressing, the tracklist, and German liner notes. „Mehr über …“ expands a longer artist profile (career, sound, highlights, discography with links to the records we own). Every record has its own link: `#/platte/<discogs-id>`.

The site is Vite + Preact + TypeScript, built to static files and hosted on GitHub Pages. Fonts and covers are served from the site itself, nothing loads from third parties.

## How the content gets here

Everything runs locally. Every Friday morning a scheduled Claude Code task on the Mac does:

```
git pull
npm run sync -- --refresh    ──▶ data/records/<id>.json + public/covers/<id>.jpg
/liner-notes alle fehlenden  ──▶ data/notes/<id>.json      (only records without notes)
                             ──▶ data/artists/<slug>.json  (only artists without a profile)
npm run check ──▶ commit ──▶ git push ──▶ GitHub Action "Deploy" ──▶ platten.johannessteu.de
```

Any time by hand: the same commands, or `/liner-notes <id>` for a single record.

### Records and covers: `npm run sync`

`scripts/sync.ts` reads the public Discogs collection of `stolle87` and

- adds records that are new on Discogs: release details (tracklist, labels, country), the original release year from the master release, and the 600 px cover;
- refreshes the basics of existing records from the collection listing;
- removes records that are no longer in the collection (their liner notes stay in `data/notes`).

No token is needed. Without one Discogs allows 25 requests a minute, so a new record takes about five seconds. `npm run sync -- --refresh` re-fetches details and tracklists for every record; add `--covers` to re-download the covers as well (they are kept otherwise, since Discogs re-encodes images and every download would show up as a change in git).

Optional environment variables:

| Name | What |
|---|---|
| `DISCOGS_USERNAME` | Collection to read, defaults to `stolle87` |
| `DISCOGS_TOKEN` | Personal access token from Discogs → Settings → Developers, for faster syncs |

### The weekly task

`platten-weekly-update` is a scheduled Claude Code task (Claude app → Scheduled), every Friday at 08:00. Its prompt lives in `~/.claude/scheduled-tasks/platten-weekly-update/SKILL.md`. It pulls, syncs, writes notes for new records, runs the check, commits only `data/` and `public/covers/` and pushes; the push deploys. It stops without touching anything if the repo has uncommitted changes.

It runs while the Claude app is open; if the app is closed on Friday morning, the run happens on the next launch. Use “Run now” in the app after adding records if you don't want to wait.

### Liner notes: Claude Code

Notes are written with the project skill in `.claude/skills/liner-notes`, a tuned version of the artist-profile skill: same research rules, German, short, written to JSON. The skill researches each record, writes `data/notes/<id>.json` against `schema/notes.schema.json` and runs `npm run check`.

The same skill writes one artist profile per artist for „Mehr über …“: `data/artists/<slug>.json` against `schema/artist.schema.json` (the artist-profile skill's artist mode as JSON). The slug comes from `src/lib/artists.ts`; records credited differently but belonging to the same artist are mapped in `data/artists/aliases.json`.

The weekly task runs it for every record without notes. Notes that fail `npm run check` and can't be fixed are left out, so the record shows “Noch keine Plattennotizen” until the next run.

To write or rewrite notes yourself:

```sh
npm run notes:todo          # which records have no notes yet
```

Then in Claude Code in this repo: `/liner-notes 28537558` or `/liner-notes alle fehlenden`. Read the notes, then commit and push; the push deploys.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # validates records, covers and notes
npm run build      # type check + static build into dist/
```

Node 24 or newer: the scripts in `scripts/` are TypeScript run directly by Node.

## Hosting

GitHub Pages with the **GitHub Actions** source. `Deploy` runs on every push to `main`, including the weekly task's push.

Custom domain: `platten.johannessteu.de` is a DNS `CNAME` to `johannessteu.github.io`, set as the custom domain under Settings → Pages with “Enforce HTTPS” on. The build uses relative paths, so it works on any host or sub-path.