import { useEffect, useRef } from 'preact/hooks';
import type { Rec } from '../data.ts';
import { genreLabel, pad2 } from '../lib/format.ts';
import { PHONE, useMedia } from '../lib/useMedia.ts';
import { Cover } from './Cover.tsx';
import { IconNext, IconPrev } from './Icons.tsx';

interface Props {
  list: Rec[];
  idx: number;
  /** Step with wrap-around (arrow buttons). */
  go: (i: number) => void;
  /** Jump to an index, clamped (drag, slider, letters). */
  jump: (i: number) => void;
  onOpen: (id: number) => void;
  showLetters: boolean;
  /** False while the detail view is open, so arrow keys stay with it. */
  active: boolean;
}

export function Flow({ list, idx, go, jump, onOpen, showLetters, active }: Props) {
  const compact = useMedia(PHONE);
  const side = compact ? 3 : 6;
  const n = list.length;
  const cur = list[idx];
  const drag = useRef({ x: 0, moved: false });
  const wheel = useRef(0);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        jump(idx - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        jump(idx + 1);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [active, idx, jump]);

  const [x0, step, depth, lift, dim] = compact ? [64, 18, 110, 20, 0.14] : [68, 20, 160, 30, 0.1];
  const covers = [];
  for (let i = Math.max(0, idx - side - 1); i <= Math.min(n - 1, idx + side + 1); i++) {
    const r = list[i];
    const d = i - idx;
    const ad = Math.abs(d);
    const sg = d > 0 ? 1 : -1;
    const hidden = ad > side;
    const transform =
      d === 0
        ? `translateX(-50%) translateZ(${lift}px)`
        : `translateX(-50%) translateX(${sg * (x0 + (ad - 1) * step)}%) translateZ(-${depth}px) rotateY(${-sg * 64}deg)`;
    covers.push(
      <button
        key={r.id}
        type="button"
        class="flow-item"
        tabIndex={d === 0 ? 0 : -1}
        aria-hidden={hidden ? 'true' : undefined}
        aria-label={d === 0 ? `Details zu ${r.label}` : `Zeige ${r.label}`}
        style={{
          transform,
          zIndex: 100 - ad,
          opacity: hidden ? 0 : 1,
          filter: `brightness(${Math.max(0.35, 1 - dim * ad).toFixed(2)})`,
        }}
        onClick={() => {
          if (drag.current.moved) return;
          if (d === 0) onOpen(r.id);
          else jump(i);
        }}
      >
        <Cover rec={r} />
      </button>,
    );
  }

  const letters: { letter: string; at: number }[] = [];
  if (showLetters) {
    list.forEach((r, i) => {
      if (!letters.length || letters[letters.length - 1].letter !== r.letter) letters.push({ letter: r.letter, at: i });
    });
  }

  const meta = [cur.genres.map(genreLabel).join(' · '), cur.format, cur.originalYear].filter(Boolean).join(' · ');

  return (
    <section class="stage" aria-label="Durch die Platten blättern">
      <div
        class="flow"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, moved: false };
        }}
        onPointerUp={(e) => {
          const dx = e.clientX - drag.current.x;
          if (Math.abs(dx) < 12) return;
          drag.current.moved = true;
          const steps = Math.max(1, Math.round(Math.abs(dx) / (compact ? 70 : 90)));
          jump(idx + (dx < 0 ? steps : -steps));
        }}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
          e.preventDefault();
          wheel.current += e.deltaX;
          if (Math.abs(wheel.current) > 70) {
            jump(idx + (wheel.current > 0 ? 1 : -1));
            wheel.current = 0;
          }
        }}
      >
        {covers}
      </div>

      <div class="now">
        <p class="now-no">
          Nr. {pad2(idx + 1)} von {n}
        </p>
        <h2 class="now-artist">{cur.artist}</h2>
        <p class="now-title">{cur.title}</p>
        <p class="now-meta">{meta}</p>
      </div>

      <div class="flow-nav">
        <button type="button" class="btn btn-round" aria-label="Vorherige Platte" onClick={() => go(idx - 1)}>
          <IconPrev />
        </button>
        <button type="button" class="btn btn-details" onClick={() => onOpen(cur.id)}>
          Details
        </button>
        <button type="button" class="btn btn-round btn-dark" aria-label="Nächste Platte" onClick={() => go(idx + 1)}>
          <IconNext />
        </button>
      </div>

      <div class="scrubber">
        <div class="scrubber-head">
          <label for="scrub">Durchs Regal schieben</label>
          <span>
            {pad2(idx + 1)} / {n}
          </span>
        </div>
        <input
          id="scrub"
          type="range"
          min={0}
          max={Math.max(0, n - 1)}
          step={1}
          value={idx}
          aria-valuetext={cur.label}
          onInput={(e) => jump(Number(e.currentTarget.value))}
        />
        {showLetters && letters.length > 1 && (
          <nav class="letters" aria-label="Zum Buchstaben springen">
            {letters.map((l) => (
              <button
                key={l.letter}
                type="button"
                aria-pressed={cur.letter === l.letter}
                aria-label={`Zu ${l.letter} springen`}
                onClick={() => jump(l.at)}
              >
                {l.letter}
              </button>
            ))}
          </nav>
        )}
      </div>
    </section>
  );
}
