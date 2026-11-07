# platten-library

Our vinyl shelf as a small website, so friends and guests can flip through the records, search for something specific and pick what to put on. It lives at [platten.steu.de](https://platten.steu.de).

- **Blättern**: a cover flow with reflections. Drag, swipe or scroll sideways, use the arrow keys, the slider or the A–Z letters.
- **Raster**: all covers as a grid.
- **Suche und Filter**: search artist, album, genre or label (accents don't matter); filter by genre, sort A–Z or by newest arrival.
- **Details**: cover with the vinyl sliding out, facts about our pressing, the tracklist, and German liner notes where we have them. Every record has its own link: `#/platte/<discogs-id>`.

The site is Vite + Preact + TypeScript, built to static files and hosted on GitHub Pages. Fonts and covers are served from the site itself, nothing loads from third parties.

## How the content gets here

```
Discogs collection ──npm run sync──▶ data/records/<id>.json + public/covers/<id>.jpg
                                    (daily GitHub Action, commits to main, redeploys)

Claude Code ──/liner-notes──▶ data/notes/<id>.json
              (local, you review and commit)
```

### Records and covers: `npm run sync`

`scripts/sync.ts` reads the public Discogs collection of `stolle87` and

- adds records that are new on Discogs: release details (tracklist, labels, country), the original release year from the master release, and the 600 px cover;
- refreshes the basics of existing records from the collection listing;
- removes records that are no longer in the collection (their liner notes stay in `data/notes`).

No token is needed. Without one Discogs allows 25 requests a minute, so a new record takes about five seconds. `npm run sync -- --refresh` re-fetches details and covers for every record.

The **Sync Discogs** workflow runs this every morning, commits any changes to `main` and deploys. Run it by hand from the Actions tab after adding records.

Optional settings in the repo (Settings → Secrets and variables → Actions):

| Name | Kind | What |
|---|---|---|
| `DISCOGS_USERNAME` | variable | Collection to read, defaults to `stolle87` |
| `DISCOGS_TOKEN` | secret | Personal access token from Discogs → Settings → Developers, for faster syncs |

### Liner notes: Claude Code

Notes are written locally with the project skill in `.claude/skills/liner-notes`, a tuned version of the artist-profile skill: same research rules, German, short, written to JSON.

```sh
npm run notes:todo          # which records have no notes yet
```

Then in Claude Code in this repo: `/liner-notes 28537558` or `/liner-notes alle fehlenden`. The skill researches each record, writes `data/notes/<id>.json` against `schema/notes.schema.json` and runs `npm run check`. Read the notes, then commit and push; the push deploys.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # validates records, covers and notes
npm run build      # type check + static build into dist/
```

Node 24 or newer: the scripts in `scripts/` are TypeScript run directly by Node.

## Hosting

GitHub Pages with the **GitHub Actions** source. `Deploy` runs on every push to `main` and after a sync that changed something.

Custom domain: add a DNS `CNAME` record `platten.steu.de → johannessteu.github.io`, then set the domain under Settings → Pages and turn on “Enforce HTTPS”. The build uses relative paths, so it also works at `johannessteu.github.io/platten-library/` until then.

GitHub pauses scheduled workflows in repos without activity for 60 days. If the sync stops, re-enable it in the Actions tab.
