// German labels and small text helpers.

const GENRE_LABEL: Record<string, string> = {
  'Folk, World, & Country': 'Folk',
  'Funk / Soul': 'Soul & Funk',
  'Brass & Military': 'Blasmusik',
  Electronic: 'Elektronik',
  'Stage & Screen': 'Film & Bühne',
  Classical: 'Klassik',
  "Children's": 'Kinder',
  'Non-Music': 'Sonstiges',
};

export const genreLabel = (g: string) => GENRE_LABEL[g] ?? g;

const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

/** "2026-10-30" → "30. Okt. 2026" */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)}. ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** Lowercase without accents, so "gronemeyer" finds "Grönemeyer". */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const pad2 = (n: number) => String(n).padStart(2, '0');
