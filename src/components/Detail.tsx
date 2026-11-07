import { useEffect, useRef, useState } from 'preact/hooks';
import { BY_ARTIST, RECORDS, loadNotes, type Rec } from '../data.ts';
import { fmtDate, genreLabel } from '../lib/format.ts';
import type { Notes, Track } from '../types.ts';
import { Cover, Disc } from './Cover.tsx';
import { IconClose, IconExternal } from './Icons.tsx';

interface Props {
  rec: Rec;
  onClose: () => void;
  onPick: (id: number) => void;
  onFind: (id: number) => void;
}

/** Groups "A1, A2, B1…" into sides; positions without a side letter stay in one group. */
function sides(tracks: Track[]): { side: string | null; tracks: Track[] }[] {
  const groups: { side: string | null; tracks: Track[] }[] = [];
  for (const t of tracks) {
    const side = t.position.match(/^([A-Z])\d*/)?.[1] ?? null;
    const last = groups[groups.length - 1];
    if (last && last.side === side) last.tracks.push(t);
    else groups.push({ side, tracks: [t] });
  }
  return groups;
}

export function Detail({ rec, onClose, onPick, onFind }: Props) {
  // undefined while loading, null when the record has no notes yet
  const [notes, setNotes] = useState<Notes | null | undefined>(rec.hasNotes ? undefined : null);
  const overlay = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    setNotes(rec.hasNotes ? undefined : null);
    if (rec.hasNotes) loadNotes(rec.id).then((n) => alive && setNotes(n));
    overlay.current?.scrollTo({ top: 0 });
    return () => {
      alive = false;
    };
  }, [rec.id]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    const root = document.documentElement;
    root.classList.add('modal-open');
    return () => {
      removeEventListener('keydown', onKey);
      root.classList.remove('modal-open');
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  const label = rec.labels[0];
  const facts = [
    ...(notes
      ? notes.facts
      : [
          rec.originalYear ? { k: 'Erschienen', v: String(rec.originalYear) } : null,
          { k: 'Genre', v: rec.genres.map(genreLabel).join(' · ') || '—' },
          rec.styles.length ? { k: 'Stil', v: rec.styles.join(' · ') } : null,
        ]),
    { k: 'Unsere Pressung', v: [rec.format, rec.year ? `gepresst ${rec.year}` : null, rec.country].filter(Boolean).join(', ') },
    label ? { k: 'Katalog', v: [label.name, label.catno].filter(Boolean).join(' · ') } : null,
    { k: 'Im Regal seit', v: fmtDate(rec.addedAt) },
  ].filter((f): f is { k: string; v: string } => f != null);

  const siblings = RECORDS.filter((r) => r.artist === rec.artist && r.id !== rec.id);
  const kicker = notes?.kicker ?? [rec.genres.map(genreLabel).join(' · '), rec.originalYear].filter(Boolean).join(' · ');
  const tags = [...rec.genres.map(genreLabel), ...rec.styles];

  return (
    <div class="overlay" ref={overlay}>
      <button type="button" class="overlay-bg" aria-label="Details schließen" tabIndex={-1} onClick={onClose} />
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <span class="sheet-handle" aria-hidden="true" />
        <article class="detail">
          <div class="detail-top">
            {notes ? <span class="tag">{notes.tag}</span> : <span class="detail-eyebrow">Aus dem Regal</span>}
            <button ref={closeButton} type="button" class="icon-btn" aria-label="Details schließen" onClick={onClose}>
              <IconClose />
            </button>
          </div>

          <div class="detail-body">
            <div class="detail-side">
              <div class="detail-art">
                <Disc rec={rec} class="detail-disc" />
                <Cover rec={rec} class="detail-sleeve" />
              </div>

              <div class="detail-head">
                <h2 id="detail-title">{rec.title}</h2>
                <p class="detail-artist">{rec.artist}</p>
                <p class="detail-kicker">{kicker}</p>
              </div>

              <div class="detail-actions">
                <button type="button" class="btn btn-accent" onClick={() => onFind(rec.id)}>
                  Im Regal zeigen
                </button>
                <a class="btn" href={rec.discogsUrl} target="_blank" rel="noopener">
                  Discogs <IconExternal />
                </a>
              </div>

              <dl class="facts">
                {facts.map((f) => (
                  <div class="fact" key={f.k}>
                    <dt>{f.k}</dt>
                    <dd>{f.v}</dd>
                  </div>
                ))}
              </dl>

              {siblings.length > 0 && (
                <div class="siblings">
                  <p class="siblings-title">Mehr von {rec.artist} im Regal</p>
                  {siblings.map((o) => (
                    <button key={o.id} type="button" class="sibling" onClick={() => onPick(o.id)}>
                      <Cover rec={o} lazy class="sibling-cover" />
                      <span class="sibling-text">
                        <span class="sibling-title">{o.title}</span>
                        <span class="sibling-meta">
                          {o.format}
                          {o.originalYear ? ` · ${o.originalYear}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div class="detail-main">
              {notes === undefined && <p class="loading">Lade Notizen …</p>}

              {notes && (
                <>
                  <section>
                    <h3>Die Platte</h3>
                    <p class="lead">{notes.record}</p>
                  </section>

                  <section>
                    <h3>Zuerst auflegen</h3>
                    <ol class="picks">
                      {notes.start.map((s, i) => (
                        <li key={s.t}>
                          <span class="pick-no" aria-hidden="true">
                            {i + 1}
                          </span>
                          <span class="pick-text">
                            <span class="pick-title">„{s.t}“</span>
                            <span class="pick-why">{s.why}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section>
                    <h3>Über {rec.artist}</h3>
                    <p class="body">{notes.band}</p>
                  </section>

                  {notes.trivia.length > 0 && (
                    <section>
                      <h3>Gut zu wissen</h3>
                      <ul class="trivia">
                        {notes.trivia.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {notes.similar.length > 0 && (
                    <section>
                      <h3>Wenn dir das gefällt</h3>
                      <div class="similar">
                        {notes.similar.map((m) => {
                          const onShelf = m.a !== rec.artist ? BY_ARTIST.get(m.a) : undefined;
                          return (
                            <div class="similar-row" key={m.a}>
                              <span class="similar-text">
                                <span class="similar-name">{m.a}</span>
                                <span class="similar-why">{m.why}</span>
                              </span>
                              {onShelf && (
                                <button type="button" class="btn btn-outline" onClick={() => onPick(onShelf.id)}>
                                  Bei uns im Regal →
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              )}

              {notes === null && (
                <section class="no-notes">
                  <h3>Noch keine Plattennotizen</h3>
                  <p>Wir schreiben nach und nach ein paar Zeilen zu jeder Platte im Regal. Diese hier ist noch nicht dran, auflegen kann man sie trotzdem.</p>
                  <div class="tags">
                    {tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </section>
              )}

              {rec.tracklist.length > 0 && (
                <section>
                  <h3>Titelliste</h3>
                  <div class="tracks">
                    {sides(rec.tracklist).map((g, gi) => (
                      <div class="side" key={gi}>
                        {g.side && <p class="side-name">Seite {g.side}</p>}
                        <ol>
                          {g.tracks.map((t, ti) => (
                            <li key={ti}>
                              <span class="track-pos">{t.position}</span>
                              <span class="track-title">{t.title}</span>
                              <span class="track-time">{t.duration}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {notes && notes.sources.length > 0 && (
                <p class="sources">
                  Quellen:{' '}
                  {notes.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener">
                      {s.label}
                    </a>
                  ))}
                </p>
              )}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
