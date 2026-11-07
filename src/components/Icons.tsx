// Inline stroke icons. All decorative: the buttons that use them carry the label.

interface Props {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'aria-hidden': 'true' as const,
});

export const IconSearch = ({ size = 20 }: Props) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconShuffle = ({ size = 20 }: Props) => (
  <svg {...base(size)}>
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </svg>
);

export const IconPrev = ({ size = 24 }: Props) => (
  <svg {...base(size)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconNext = ({ size = 24 }: Props) => (
  <svg {...base(size)}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconFlow = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M2 7l4 2v6l-4 2z" />
    <rect x="9" y="5" width="6" height="14" rx="1" />
    <path d="M22 7l-4 2v6l4 2z" />
  </svg>
);

export const IconGrid = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export const IconSliders = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M4 6h9" />
    <path d="M17 6h3" />
    <circle cx="15" cy="6" r="2" />
    <path d="M4 12h3" />
    <path d="M11 12h9" />
    <circle cx="9" cy="12" r="2" />
    <path d="M4 18h11" />
    <circle cx="17" cy="18" r="2" />
  </svg>
);

export const IconChevronDown = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconClose = ({ size = 20 }: Props) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconExternal = ({ size = 15 }: Props) => (
  <svg {...base(size)}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
);

export const Logo = ({ size = 36 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="2" />
    <circle cx="18" cy="18" r="10" stroke="currentColor" stroke-opacity=".35" stroke-width="1" />
    <circle cx="18" cy="18" r="5" fill="var(--accent)" />
  </svg>
);
