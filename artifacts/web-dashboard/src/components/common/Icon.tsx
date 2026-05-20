interface IconProps {
  name: keyof typeof ICONS;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

const ICONS = {
  timeline: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 5h2M3 9h2M3 13h2M7 5h10M7 9h10M7 13h10" />
  ),
  bookmark: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M5 3h10a1 1 0 0 1 1 1v14l-6-3-6 3V4a1 1 0 0 1 1-1z" />
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path strokeLinecap="round" d="M14.5 14.5L19 19" />
    </>
  ),
  chat: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 4h16v11H4V4zM8 19l4-4h4" />
  ),
  report: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 18V10l4-4 4 4 4-6v14H4z" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round"
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </>
  ),
  pencil: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M16 3l5 5L7 22H2v-5L16 3z" />
  ),
  trash: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  ),
  tag: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />
  ),
  download: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 4v12m-6 0l6 6 6-6M3 20h18" />
  ),
  logout: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round"
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </>
  ),
  moon: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  ),
  plus: (
    <path strokeLinecap="round" d="M12 4v16M4 12h16" />
  ),
  close: (
    <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
  ),
  check: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
  ),
  chevronDown: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
  ),
  chevronUp: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
  ),
  chevronLeft: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
  ),
  link: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
    </>
  ),
  sparkle: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 2l2.4 7.6H22l-6.2 4.5 2.4 7.6L12 17.2l-6.2 4.5 2.4-7.6L2 9.6h7.6L12 2z" />
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path strokeLinecap="round"
        d="M9 7V4M12 7V4M15 7V4M9 20v-3M12 20v-3M15 20v-3M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3" />
    </>
  ),
  refresh: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  ),
  externalLink: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
  ),
  note: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
  ),
  warning: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
  ),
  lightbulb: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2V17H9v-2.8C7.21 13.16 6 11.22 6 9a6 6 0 0 1 6-6z" />
  ),
  list: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  ),
  shuffle: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  ),
  clipboard: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </>
  ),
  graph: (
    <>
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="12" cy="19" r="2" />
      <circle cx="5" cy="14" r="2" />
      <path strokeLinecap="round" d="M7 5h10M6.5 6.5l4 11M17.5 6.5l-4 11M5 12v0M7 14l5 3.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round"
        d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9M3 12h18" />
    </>
  ),
  eye: (
    <>
      <path strokeLinecap="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
  ),
} as const;

export default function Icon({ name, size = 16, color = 'currentColor', style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}
