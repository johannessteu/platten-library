import { useEffect, useState } from 'preact/hooks';

/** True while the media query matches, e.g. useMedia('(max-width: 640px)'). */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const onChange = () => setMatch(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);
  return match;
}

export const PHONE = '(max-width: 640px)';
