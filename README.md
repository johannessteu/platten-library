# platten-library

Our vinyl shelf as a small website, so friends and guests can flip through the records, search for something specific and pick what to put on. It lives at [platten.johannessteu.de](https://platten.johannessteu.de).

- **Blättern**: a cover flow with reflections. Drag, swipe or scroll sideways, use the arrow keys, the slider or the A–Z letters.
- **Raster**: all covers as a grid.
- **Suche und Filter**: search artist, album, genre or label (accents don't matter); filter by genre, sort A–Z or by newest arrival.
- **Details**: cover with the vinyl sliding out, facts about our pressing, the tracklist, and German liner notes where we have them. Every record has its own link: `#/platte/<discogs-id>`.

The site is Vite + Preact + TypeScript, built to static files and hosted on GitHub Pages. Fonts and covers are served from the site itself, nothing loads from third parties.

## How the content gets here

```
Every Friday, GitHub Action "Weekly update":

  Discogs collection ──npm run sync -- --refresh──▶ data/records/<id>.json + public/covers/<id>.jpg
  Claude Code ──/liner-notes alle fehlenden──▶ data/notes/<id>.json   (records without notes)
  npm run check ──▶ commit to main ──▶ deploy

Any time, locally: npm run sync, /liner-notes <id> in Claude Code, commit and push.
```

### Records and covers: `npm run sync`

`scripts/sync.ts` reads the public Discogs collection of `stolle87` and

- adds records that are new on Discogs: release details (tracklist, labels, country), the original release year from the master release, and the 600 px cover;
- refreshes the basics of existing records from the collection listing;
- removes records that are no longer in the collection (their liner notes stay in `data/notes`).

No token is needed. Without one Discogs allows 25 requests a minute, so a new record takes about five seconds. `npm run sync -- --refresh` re-fetches details and tracklists for every record; add `--covers` to re-download the covers as well (they are kept otherwise, since Discogs re-encodes images and every download would show up as a change in git).

The **Weekly update** workflow runs `npm run sync -- --refresh` every Friday at 04:23 UTC, writes notes for new records (below), commits any changes to `main` and deploys. Run it by hand from the Actions tab (“Run workflow”) after adding records if you don't want to wait for Friday.

Settings in the repo (Settings → Secrets and variables → Actions):

| Name | Kind | What |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | secret | Lets the weekly job write liner notes with your Claude subscription. Without it, records still sync and new ones show “Noch keine Plattennotizen”. |
| `DISCOGS_USERNAME` | variable | Collection to read, defaults to `stolle87` |
| `DISCOGS_TOKEN` | secret | Personal access token from Discogs → Settings → Developers, for faster syncs |

To create the Claude token, run this locally and paste the token when `gh` asks for it:

```sh
claude setup-token
gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo johannessteu/platten-library
```

### Liner notes: Claude Code

Notes are written with the project skill in `.claude/skills/liner-notes`, a tuned version of the artist-profile skill: same research rules, German, short, written to JSON. The skill researches each record, writes `data/notes/<id>.json` against `schema/notes.schema.json` and runs `npm run check`.

The weekly job runs it in CI for every record without notes, through `anthropics/claude-code-action`. Claude may read and write files, search the web and run the checker, but has no git access; the workflow commits afterwards. Notes that fail `npm run check` are dropped, and the records are still committed.

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

GitHub Pages with the **GitHub Actions** source. `Deploy` runs on every push to `main` and after a weekly update that changed something.

Custom domain: `platten.johannessteu.de` is a DNS `CNAME` to `johannessteu.github.io`, set as the custom domain under Settings → Pages with “Enforce HTTPS” on. The build uses relative paths, so it works on any host or sub-path.

GitHub pauses scheduled workflows in repos without activity for 60 days. If the weekly update stops, re-enable it in the Actions tab.
