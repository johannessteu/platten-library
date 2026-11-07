import type { Rec } from '../data.ts';

interface Props {
  rec: Rec;
  /** Lazy-load the image (grid); the flow loads its few covers eagerly. */
  lazy?: boolean;
  class?: string;
}

/** The record sleeve: the Discogs cover, or generated art when there is none. */
export function Cover({ rec, lazy = false, class: cls = '' }: Props) {
  if (rec.cover) {
    return (
      <span class={`cover ${cls}`}>
        <img src={rec.cover} alt="" loading={lazy ? 'lazy' : 'eager'} decoding="async" draggable={false} />
      </span>
    );
  }
  return (
    <span class={`cover cover-generated ${cls}`} style={{ background: rec.art, color: rec.ink }}>
      <span class="cover-text">
        <span class="cover-artist">{rec.artist}</span>
        <span class="cover-title">{rec.title}</span>
      </span>
    </span>
  );
}

/** The vinyl that peeks out of the sleeve. */
export function Disc({ rec, class: cls = '' }: { rec: Rec; class?: string }) {
  return <span class={`disc ${cls}`} style={{ background: rec.disc }} aria-hidden="true" />;
}
