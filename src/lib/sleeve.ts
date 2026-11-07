// Generated sleeve art for records without a cover image, and the vinyl disc
// that slides out of a sleeve. Colours are picked from the release id, so a
// record always gets the same look.

const PALETTE: [bg: string, fg: string, ink: string][] = [
  ['#E8542F', '#F6D7B0', '#1A1310'],
  ['#2F5D50', '#E9C46A', '#F6F1E7'],
  ['#F2E8D5', '#1F3A5F', '#1A1310'],
  ['#1F3A5F', '#F28C38', '#F6F1E7'],
  ['#F4C430', '#2B2118', '#1A1310'],
  ['#7A4E9E', '#F4B6C2', '#FBF6EF'],
  ['#C9D6DF', '#E8542F', '#1A1310'],
  ['#3B2A20', '#E07A5F', '#F6F1E7'],
  ['#8DB596', '#1F3A5F', '#1A1310'],
  ['#1B1B1B', '#F2E8D5', '#F2E8D5'],
];

function pattern(b: string, f: string, variant: number): string {
  if (variant === 0) return `radial-gradient(circle at 72% 74%, ${f} 0 30%, transparent 30.4%), ${b}`;
  if (variant === 1) return `linear-gradient(${b} 0 46%, transparent 46%), repeating-linear-gradient(180deg, ${f} 0 6%, ${b} 6% 12%)`;
  if (variant === 2) return `linear-gradient(135deg, ${b} 0 54%, ${f} 54% 100%)`;
  return `radial-gradient(circle at 50% 112%, transparent 0 64%, ${b} 64.4%), repeating-radial-gradient(circle at 50% 112%, ${f} 0 4%, ${b} 4% 8%)`;
}

function disc(label: string): string {
  return (
    `radial-gradient(circle closest-side, #FFFFFF 0 2.6%, ${label} 3% 33%, #0B0A09 33.6% 36%, transparent 36.4%), ` +
    'conic-gradient(from 20deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,.09) 35deg, rgba(255,255,255,0) 70deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,.09) 215deg, rgba(255,255,255,0) 250deg), ' +
    'repeating-radial-gradient(circle closest-side, #1C1A18 0 .6%, #0D0C0B .6% 1.3%)'
  );
}

export interface SleeveStyle {
  art: string;
  ink: string;
  disc: string;
}

export function sleeveFor(id: number): SleeveStyle {
  const [bg, fg, ink] = PALETTE[id % PALETTE.length];
  return { art: pattern(bg, fg, Math.floor(id / 7) % 4), ink, disc: disc(fg) };
}
