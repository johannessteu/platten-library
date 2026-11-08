import { useEffect, useRef, useState } from 'preact/hooks';
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

/** Pointer drag in progress: where it started, where it is, and how fast it moves. */
interface Drag {
  id: number;
  x: number;
  start: number;
  pos: number;
  moved: boolean;
  lastX: number;
  lastT: number;
  /** Finger speed in px/ms, smoothed. */
  v: number;
}

export function Flow({ list, idx, go, jump, onOpen, showLetters, active }: Props) {
  const compact = useMedia(PHONE);
  const side = compact ? 3 : 6;
  const n = list.length;
  const cur = list[idx];
  const drag = useRef<Drag>({ id: -1, x: 0, start: 0, pos: 0, moved: false, lastX: 0, lastT: 0, v: 0 });
  /** Fractional position while dragging, so the covers follow the finger; null otherwise. */
  const [dragPos, setDragPos] = useState<number | null>(null);
  const wheel = useRef(0);
  const pxPerItem = compact ? 70 : 90;

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
  // Covers are placed by their distance from `pos`. At rest that is a whole
  // number; while dragging it is fractional and the centre cover turns away
  // gradually, the way the finger moves it.
  const pos = dragPos ?? idx;
  const covers = [];
  for (let i = Math.max(0, Math.floor(pos) - side - 1); i <= Math.min(n - 1, Math.ceil(pos) + side + 1); i++) {
    const r = list[i];
    const d = i - pos;
    const ad = Math.abs(d);
    const sg = d < 0 ? -1 : 1;
    const t = Math.min(1, ad);
    const x = sg * (x0 * t + Math.max(0, ad - 1) * step);
    const z = lift - (lift + depth) * t;
    const turn = -sg * 64 * t;
    const hidden = Math.abs(i - idx) > side;
    covers.push(
      <button
        key={r.id}
        type="button"
        class="flow-item"
        tabIndex={i === idx ? 0 : -1}
        aria-hidden={hidden ? 'true' : undefined}
        aria-label={i === idx ? `Details zu ${r.label}` : `Zeige ${r.label}`}
        style={{
          transform: `translateX(-50%) translateX(${x.toFixed(2)}%) translateZ(${z.toFixed(1)}px) rotateY(${turn.toFixed(1)}deg)`,
          zIndex: 1000 - Math.round(ad * 10),
          opacity: Math.max(0, Math.min(1, side + 1 - ad)),
          filter: `brightness(${Math.max(0.35, 1 - dim * ad).toFixed(2)})`,
        }}
        onClick={(e) => {
          // The click that ends a drag isn't a tap; keyboard clicks (detail 0) always count.
          if (drag.current.moved && e.detail !== 0) return;
          if (i === idx) onOpen(r.id);
          else jump(i);
        }}
      >
        <Cover rec={r} />
        <span class="reflection" aria-hidden="true">
          <Cover rec={r} />
        </span>
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

  /** Let go: settle on the nearest cover, or glide on a few covers after a quick flick. */
  const endDrag = (e: PointerEvent, fling: boolean) => {
    const g = drag.current;
    if (g.id !== e.pointerId) return;
    g.id = -1;
    if (!g.moved) return;
    const v = fling && e.timeStamp - g.lastT < 80 ? g.v : 0;
    const glide = Math.max(-12, Math.min(12, (-v * 180) / pxPerItem));
    jump(Math.round(g.pos + glide));
    setDragPos(null);
  };

  return (
    <section class="stage" aria-label="Durch die Platten blättern">
      <div
        class={dragPos === null ? 'flow' : 'flow dragging'}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = {
            id: e.pointerId,
            x: e.clientX,
            start: idx,
            pos: idx,
            moved: false,
            lastX: e.clientX,
            lastT: e.timeStamp,
            v: 0,
          };
        }}
        onPointerMove={(e) => {
          const g = drag.current;
          if (g.id !== e.pointerId) return;
          const dx = e.clientX - g.x;
          if (!g.moved) {
            if (Math.abs(dx) < 8) return;
            g.moved = true;
            // Keep getting moves when the finger leaves the flow; the pointer may already be gone.
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}
          }
          const dt = e.timeStamp - g.lastT;
          if (dt > 0) g.v = 0.7 * ((e.clientX - g.lastX) / dt) + 0.3 * g.v;
          g.lastX = e.clientX;
          g.lastT = e.timeStamp;
          // Follow the finger; past either end it gives way only a little.
          let p = g.start - dx / pxPerItem;
          if (p < 0) p = Math.max(-0.6, p * 0.35);
          else if (p > n - 1) p = Math.min(n - 0.4, n - 1 + (p - (n - 1)) * 0.35);
          g.pos = p;
          setDragPos(p);
          jump(Math.round(p));
        }}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
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
