import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { BY_ID, GENRES, RECORDS, type Rec } from './data.ts';
import { genreLabel, norm } from './lib/format.ts';
import { PHONE, useMedia } from './lib/useMedia.ts';
import { Detail } from './components/Detail.tsx';
import { Flow } from './components/Flow.tsx';
import { IconFlow, IconGrid, IconSearch, IconShuffle, IconSliders } from './components/Icons.tsx';
import { Wall } from './components/Wall.tsx';

type Mode = 'flow' | 'wall';
type Sort = 'az' | 'new';

const readHash = (): number | null => {
  const m = location.hash.match(/^#\/platte\/(\d+)/);
  return m && BY_ID.has(Number(m[1])) ? Number(m[1]) : null;
};

export function App() {
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('all');
  const [sort, setSort] = useState<Sort>('az');
  const [mode, setMode] = useState<Mode>('flow');
  const [idx, setIdx] = useState(() => {
    const id = readHash();
    return id ? (BY_ID.get(id)?.order ?? 0) : 0;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(readHash);
  const phone = useMedia(PHONE);

  useEffect(() => {
    const onHash = () => setOpenId(readHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const qn = norm(q.trim());
  const searched = useMemo(() => (qn ? RECORDS.filter((r) => r.hay.includes(qn)) : RECORDS), [qn]);
  const list = useMemo(() => {
    const byGenre = genre === 'all' ? searched : searched.filter((r) => r.genres.includes(genre));
    return sort === 'new' ? [...byGenre].sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.order - b.order) : byGenre;
  }, [searched, genre, sort]);

  const n = list.length;
  const at = n ? Math.min(idx, n - 1) : 0;

  const go = useCallback((i: number) => n && setIdx(((i % n) + n) % n), [n]);
  const jump = useCallback((i: number) => n && setIdx(Math.max(0, Math.min(n - 1, i))), [n]);

  const open = (id: number) => {
    location.hash = `/platte/${id}`;
  };
  const close = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setOpenId(null);
  };
  const showInFlow = (id: number) => {
    const rec = BY_ID.get(id);
    if (!rec) return;
    const pos = list.indexOf(rec);
    if (pos === -1) {
      setQ('');
      setGenre('all');
      setSort('az');
      setIdx(rec.order);
    } else setIdx(pos);
    setMode('flow');
    close();
  };
  const surprise = () => {
    const pool = n ? list : RECORDS;
    let pick = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && pick === at) pick = (pick + 1) % pool.length;
    if (!n) {
      setQ('');
      setGenre('all');
    }
    setMode('flow');
    setIdx(pick);
  };
  const resetFilters = () => {
    setGenre('all');
    setSort('az');
    setIdx(0);
  };

  const activeFilters = (genre !== 'all' ? 1 : 0) + (sort !== 'az' ? 1 : 0);
  const genreName = genreLabel(genre);
  const filtered = Boolean(qn) || genre !== 'all';
  const status = !filtered
    ? `Alle ${n} Platten, ${sort === 'az' ? 'von A bis Z nach Künstler' : 'die neuesten zuerst'}`
    : `${n} von ${RECORDS.length} Platten${qn ? ` zu „${q.trim()}“` : ''}${genre !== 'all' ? ` in ${genreName}` : ''}`;

  const opened = openId != null ? BY_ID.get(openId) : undefined;

  return (
    <>
      <div class="wrap">
        <h1 class="sr-only">Unser Plattenregal</h1>

        <div class="topbar">
            <div class="search">
              <label for="q" class="sr-only">
                Im Regal suchen
              </label>
              <IconSearch />
              <input
                id="q"
                type="search"
                autocomplete="off"
                placeholder={phone ? 'Suchen' : 'Künstler, Album oder Genre suchen'}
                value={q}
                onInput={(e) => {
                  setQ(e.currentTarget.value);
                  setIdx(0);
                }}
              />
            </div>
            <button type="button" class="btn btn-filter" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
              <IconSliders />
              <span class="btn-label">Filter</span>
              {activeFilters > 0 && <span class="badge">{activeFilters}</span>}
            </button>
            <div class="seg" role="group" aria-label="Ansicht">
              <button type="button" aria-pressed={mode === 'flow'} onClick={() => setMode('flow')}>
                <IconFlow />
                <span class="btn-label">Blättern</span>
              </button>
              <button type="button" aria-pressed={mode === 'wall'} onClick={() => setMode('wall')}>
                <IconGrid />
                <span class="btn-label">Raster</span>
              </button>
            </div>
            <button type="button" class="btn btn-accent btn-surprise" onClick={surprise}>
              <IconShuffle />
              <span class="btn-label">Überrasch mich</span>
            </button>
        </div>

        <p class={filtered ? 'status' : 'sr-only'} aria-live="polite">
          {status}
        </p>

        {filtersOpen && (
          <section class="filters" aria-label="Filter">
            <div class="chips" role="group" aria-label="Nach Genre filtern">
              {['all', ...GENRES].map((g) => {
                const count = g === 'all' ? searched.length : searched.filter((r) => r.genres.includes(g)).length;
                return (
                  <button
                    key={g}
                    type="button"
                    class="chip"
                    aria-pressed={genre === g}
                    onClick={() => {
                      setGenre(g);
                      setIdx(0);
                    }}
                  >
                    {g === 'all' ? 'Alle' : genreLabel(g)}
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
            <div class="filters-end">
              <div class="seg" role="group" aria-label="Sortierung">
                <button
                  type="button"
                  aria-pressed={sort === 'az'}
                  onClick={() => {
                    setSort('az');
                    setIdx(0);
                  }}
                >
                  A–Z
                </button>
                <button
                  type="button"
                  aria-pressed={sort === 'new'}
                  onClick={() => {
                    setSort('new');
                    setIdx(0);
                  }}
                >
                  Neu im Regal
                </button>
              </div>
              {activeFilters > 0 && (
                <button type="button" class="link-btn" onClick={resetFilters}>
                  Zurücksetzen
                </button>
              )}
            </div>
          </section>
        )}

        {n === 0 ? (
          <Empty
            message={qn ? `Nichts im Regal passt zu „${q.trim()}“${genre !== 'all' ? ` in ${genreName}` : ''}.` : `Noch kein ${genreName} im Regal.`}
            onClear={() => {
              setQ('');
              setGenre('all');
              setIdx(0);
            }}
          />
        ) : mode === 'flow' ? (
          <Flow list={list} idx={at} go={go} jump={jump} onOpen={open} showLetters={sort === 'az'} active={!opened} />
        ) : (
          <Wall list={list} onOpen={open} />
        )}      </div>

      {opened && <Detail rec={opened} onClose={close} onPick={open} onFind={showInFlow} />}
    </>
  );
}

function Empty({ message, onClear }: { message: string; onClear: () => void }) {
  return (
    <section class="empty">
      <p class="empty-title">{message}</p>
      <p>Versuch es mit Künstler, Album oder Genre.</p>
      <button type="button" class="btn btn-dark" onClick={onClear}>
        Suche und Filter zurücksetzen
      </button>
    </section>
  );
}

export type { Rec };
