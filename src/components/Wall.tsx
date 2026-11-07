import type { Rec } from '../data.ts';
import { Cover, Disc } from './Cover.tsx';

export function Wall({ list, onOpen }: { list: Rec[]; onOpen: (id: number) => void }) {
  return (
    <section class="wall" aria-label="Alle Platten">
      {list.map((r) => (
        <button key={r.id} type="button" class="card" onClick={() => onOpen(r.id)}>
          <span class="card-art" aria-hidden="true">
            <Disc rec={r} class="card-disc" />
            <Cover rec={r} lazy class="card-sleeve" />
          </span>
          <span class="card-text">
            <span class="card-artist">{r.artist}</span>
            <span class="card-title">{r.title}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
