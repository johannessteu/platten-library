import { useEffect, useState } from 'preact/hooks';
import { BY_PROFILE, PROFILE_NAME, loadArtist, sameTitle, type Rec } from '../data.ts';
import type { ArtistProfile } from '../types.ts';
import { IconChevronDown } from './Icons.tsx';

interface Props {
  rec: Rec;
  onPick: (id: number) => void;
}

/** „Mehr über …“: the longer artist profile, loaded and shown on demand. */
export function ArtistMore({ rec, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ArtistProfile | null>(null);

  useEffect(() => {
    setOpen(false);
    setProfile(null);
  }, [rec.profile]);

  if (!rec.profile) return null;
  const slug = rec.profile;
  const name = profile?.name ?? PROFILE_NAME.get(slug) ?? rec.artist;
  const owned = BY_PROFILE.get(slug) ?? [];

  const toggle = () => {
    if (!open && !profile) loadArtist(slug).then(setProfile);
    setOpen(!open);
  };

  return (
    <div class="more">
      <button type="button" class="more-toggle" aria-expanded={open} aria-controls="artist-more" onClick={toggle}>
        Mehr über {name}
        <IconChevronDown />
      </button>

      {open && (
        <div id="artist-more" class="more-body">
          {!profile ? (
            <p class="loading">Lade …</p>
          ) : (
            <>
              <p class="more-summary">{profile.summary}</p>

              <h4>Werdegang</h4>
              {profile.career.map((p, i) => (
                <p class="body" key={i}>
                  {p}
                </p>
              ))}

              <h4>Sound</h4>
              <p class="body">{profile.sound}</p>

              <h4>Interessantes</h4>
              <ul class="trivia">
                {profile.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>

              <h4>Diskografie</h4>
              <ol class="disco">
                {profile.discography.map((d) => {
                  const mine = owned.find((r) => sameTitle(r.title, d.title));
                  return (
                    <li key={`${d.year}-${d.title}`}>
                      <span class="disco-year">{d.year}</span>
                      <span class="disco-main">
                        <span class="disco-head">
                          {d.master ? (
                            <a
                              class="disco-title"
                              href={`https://www.discogs.com/master/${d.master}`}
                              target="_blank"
                              rel="noopener"
                              aria-label={`${d.title} auf Discogs`}
                            >
                              {d.title}
                            </a>
                          ) : (
                            <span class="disco-title">{d.title}</span>
                          )}
                          {d.type !== 'Studioalbum' && <span class="disco-type">{d.type}</span>}
                        </span>
                        {d.note && <span class="disco-note">{d.note}</span>}
                      </span>
                      {mine &&
                        (mine.id === rec.id ? (
                          <span class="disco-here">Diese Platte</span>
                        ) : (
                          <button type="button" class="btn btn-outline btn-sm" onClick={() => onPick(mine.id)}>
                            Im Regal →
                          </button>
                        ))}
                    </li>
                  );
                })}
              </ol>

              {profile.sources.length > 0 && (
                <p class="sources">
                  Quellen:{' '}
                  {profile.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener">
                      {s.label}
                    </a>
                  ))}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
