import type { SVGProps } from 'react';

const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function HouseHeart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path {...stroke} strokeWidth={2.4} d="M6 22 24 7l18 15M11 18v22h26V18" />
      <path
        fill="currentColor"
        d="M24 35s-7-4.3-7-9.2c0-2.3 1.7-4 3.8-4 1.4 0 2.6.8 3.2 1.9.6-1.1 1.8-1.9 3.2-1.9 2.1 0 3.8 1.7 3.8 4 0 4.9-7 9.2-7 9.2Z"
      />
    </svg>
  );
}

export function MusicNote(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path {...stroke} strokeWidth={1.8} d="M9 18V5l11-2v13" />
      <circle {...stroke} strokeWidth={1.8} cx="6" cy="18" r="3" />
      <circle {...stroke} strokeWidth={1.8} cx="17" cy="16" r="3" />
    </svg>
  );
}

/** Paisagem do cabeçalho: colinas em sálvia, sol, pinheiros e uma casinha */
export function Landscape(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 640 120" preserveAspectRatio="xMidYMax meet" {...props}>
      <defs>
        <linearGradient id="ls-fade" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="ls-mask">
          <rect width="640" height="120" fill="url(#ls-fade)" />
        </mask>
      </defs>
      <g mask="url(#ls-mask)">
        <circle cx="390" cy="44" r="22" fill="#f6cf98" opacity="0.85" />
        <path d="M0 98 C90 58 170 62 250 80 S420 52 520 70 640 74 640 74 V120 H0Z" fill="#c9d8cc" />
        <path d="M60 110 C150 80 260 82 330 94 S500 78 640 96 V120 H40Z" fill="#a9c2b0" />
        <path d="M0 116 C120 100 240 104 360 110 S560 102 640 112 V120 H0Z" fill="#8fae99" />
        {[300, 316, 470, 486, 500].map((x, i) => (
          <path key={x} d={`M${x} ${92 - (i % 2) * 6} l7 -22 l7 22Z`} fill="#6f9a85" opacity="0.9" />
        ))}
        <g transform="translate(420 74)">
          <rect x="0" y="8" width="26" height="16" fill="#f8f3ea" />
          <path d="M-3 9 13 -3 29 9Z" fill="#d48a5a" />
          <rect x="10" y="14" width="6" height="10" fill="#c9a77c" />
        </g>
      </g>
    </svg>
  );
}

export function LeafSprig(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 60" {...props}>
      <path d="M8 52 C40 40 70 26 112 8" fill="none" stroke="#9db7a4" strokeWidth="1.6" strokeLinecap="round" />
      {[
        [30, 44, -30],
        [48, 36, -40],
        [66, 28, -35],
        [84, 20, -45],
        [40, 46, 30],
        [60, 38, 25],
        [80, 30, 30],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="10" ry="4.2" fill="#b7cbb9" transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  );
}

export function FoldedTowels(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 90" {...props}>
      <rect x="10" y="78" width="140" height="8" rx="3" fill="#e3d4bf" />
      <rect x="22" y="58" width="104" height="20" rx="9" fill="#efe6d8" stroke="#dccdb6" />
      <rect x="28" y="40" width="96" height="19" rx="9" fill="#f6efe4" stroke="#dccdb6" />
      <rect x="34" y="23" width="86" height="18" rx="9" fill="#e8ede4" stroke="#cfd9cd" />
      <path d="M134 78c0-18 6-30 14-38m-8 38c-2-14-10-22-18-26" fill="none" stroke="#8fae99" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="148" cy="40" rx="7" ry="3.4" fill="#a9c2b0" transform="rotate(-50 148 40)" />
      <ellipse cx="122" cy="52" rx="7" ry="3.4" fill="#a9c2b0" transform="rotate(30 122 52)" />
    </svg>
  );
}

/** Retrato ilustrado de cachorro quando ainda não há foto do pet */
export function DogFace({ tone = 'gold', ...props }: SVGProps<SVGSVGElement> & { tone?: 'gold' | 'cream' }) {
  const fur = tone === 'gold' ? '#d9a45f' : '#e8cfa6';
  const ear = tone === 'gold' ? '#b9823f' : '#cfae7c';
  return (
    <svg viewBox="0 0 64 64" {...props}>
      <circle cx="32" cy="32" r="32" fill="#f3e6d2" />
      <path d="M14 22c-4 8-3 18 3 22 3-6 4-14 3-22Z" fill={ear} />
      <path d="M50 22c4 8 3 18-3 22-3-6-4-14-3-22Z" fill={ear} />
      <ellipse cx="32" cy="34" rx="16" ry="17" fill={fur} />
      <ellipse cx="32" cy="42" rx="9" ry="7" fill="#f6ead8" />
      <circle cx="25.5" cy="31" r="2.2" fill="#3a3833" />
      <circle cx="38.5" cy="31" r="2.2" fill="#3a3833" />
      <ellipse cx="32" cy="38.5" rx="3.2" ry="2.3" fill="#3a3833" />
      <path d="M32 41v2.5m0 0c-1.5 1.5-3.5 1.5-4.5.5m4.5-.5c1.5 1.5 3.5 1.5 4.5.5" stroke="#3a3833" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
