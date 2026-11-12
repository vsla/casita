import type { Weather } from '@home-hub/shared';
import type { SVGProps } from 'react';

type Sky = 'clear' | 'cloudy' | 'rain';

function skyFrom(w: Weather | null | undefined): Sky {
  if (!w) return 'clear';
  if (w.code >= 51) return 'rain';
  if (w.code >= 2) return 'cloudy';
  return 'clear';
}

/**
 * Paisagem viva do cabeçalho. Tudo em CSS (transform/opacity), barato até no PC antigo:
 * sol "respirando" que caminha pelo céu ao longo do dia, nuvens à deriva, pinheiros
 * balançando, um casal de pássaros de vez em quando, fumaça na chaminé.
 * À noite: lua e estrelas piscando. Com chuva: mais nuvens e gotas.
 * Respeita "reduzir movimento" do sistema (styles.css).
 */
export function LivingLandscape({ weather, hour, ...props }: SVGProps<SVGSVGElement> & { weather?: Weather | null; hour: number }) {
  const night = weather ? !weather.isDay : hour < 5.5 || hour >= 18;
  const sky = skyFrom(weather);
  // Posição do astro: de 260 (manhã) a 520 (fim da tarde), num arco suave
  const t = night ? ((hour + 24 - 18) % 24) / 12 : Math.min(1, Math.max(0, (hour - 5.5) / 12.5));
  const cx = 250 + t * 270;
  const cy = 52 - Math.sin(t * Math.PI) * 22;
  const clouds = sky === 'clear' ? 1 : sky === 'cloudy' ? 3 : 4;

  return (
    <svg viewBox="0 0 640 120" preserveAspectRatio="xMidYMax meet" {...props}>
      <defs>
        <linearGradient id="lv-fade" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.22" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.78" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="lv-mask">
          <rect width="640" height="120" fill="url(#lv-fade)" />
        </mask>
        <radialGradient id="lv-glow">
          <stop offset="0" stopColor={night ? '#e9e4f5' : '#f8d9a8'} stopOpacity="0.7" />
          <stop offset="1" stopColor={night ? '#e9e4f5' : '#f8d9a8'} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g mask="url(#lv-mask)">
        {night &&
          [
            [180, 22],
            [215, 40],
            [300, 16],
            [355, 34],
            [430, 20],
            [470, 44],
            [540, 26],
          ].map(([x, y], i) => <circle key={i} className="lv-star" style={{ animationDelay: `${i * 0.7}s` }} cx={x} cy={y} r={1.3} fill="#b9b2cc" />)}

        {/* Sol ou lua */}
        <g transform={`translate(${cx} ${cy})`}>
          <circle className="lv-glow" r="40" fill="url(#lv-glow)" />
          {night ? (
            <g className="lv-breathe">
              <circle r="15" fill="#ece6d6" />
              <circle cx="6" cy="-4" r="13" fill="#f4efe6" />
            </g>
          ) : (
            <circle className="lv-breathe" r="21" fill={sky === 'clear' ? '#f6cf98' : '#f3dcb8'} opacity="0.9" />
          )}
        </g>

        {/* Nuvens à deriva (velocidades e alturas diferentes) */}
        {Array.from({ length: clouds }, (_, i) => (
          <g key={i} className="lv-cloud" style={{ animationDuration: `${70 + i * 23}s`, animationDelay: `${-i * 31}s` }}>
            <g transform={`translate(0 ${20 + (i % 3) * 13}) scale(${0.8 + (i % 2) * 0.35})`} fill={sky === 'rain' ? '#d9dcd8' : '#fbf8f2'} opacity="0.92">
              <ellipse cx="22" cy="10" rx="22" ry="8" />
              <ellipse cx="36" cy="5" rx="13" ry="9" />
              <ellipse cx="14" cy="6" rx="10" ry="7" />
            </g>
          </g>
        ))}

        {sky === 'rain' &&
          Array.from({ length: 14 }, (_, i) => (
            <line
              key={i}
              className="lv-rain"
              style={{ animationDelay: `${(i * 0.37) % 1.2}s` }}
              x1={190 + i * 22}
              y1={30}
              x2={187 + i * 22}
              y2={38}
              stroke="#9fb4bf"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          ))}

        {/* Pássaros: atravessam o céu uma vez a cada ~40 s */}
        {!night && sky !== 'rain' && (
          <g className="lv-birds" fill="none" stroke="#7d8a82" strokeWidth="1.3" strokeLinecap="round">
            <path className="lv-wing" d="M0 0 q4 -4 8 0 q4 -4 8 0" />
            <path className="lv-wing" style={{ animationDelay: '0.2s' }} d="M14 -8 q3 -3 6 0 q3 -3 6 0" />
          </g>
        )}

        {/* Colinas */}
        <path d="M0 98 C90 58 170 62 250 80 S420 52 520 70 640 74 640 74 V120 H0Z" fill={night ? '#bccbc0' : '#c9d8cc'} />
        <path d="M60 110 C150 80 260 82 330 94 S500 78 640 96 V120 H40Z" fill={night ? '#9bb4a3' : '#a9c2b0'} />
        <path d="M0 116 C120 100 240 104 360 110 S560 102 640 112 V120 H0Z" fill={night ? '#82a18c' : '#8fae99'} />

        {/* Pinheiros balançando */}
        {[300, 316, 470, 486, 500].map((x, i) => (
          <path
            key={x}
            className="lv-tree"
            style={{ animationDelay: `${i * 0.6}s`, animationDuration: `${4.5 + (i % 3)}s` }}
            d={`M${x} ${92 - (i % 2) * 6} l7 -22 l7 22Z`}
            fill="#6f9a85"
            opacity="0.9"
          />
        ))}

        {/* Casinha com fumaça na chaminé e janela acesa à noite */}
        <g transform="translate(420 74)">
          <rect x="18" y="-1" width="4" height="7" fill="#c9a77c" />
          {[0, 1, 2].map((i) => (
            <circle key={i} className="lv-smoke" style={{ animationDelay: `${i * 1.6}s` }} cx="20" cy="-3" r="2.6" fill="#e6e0d4" />
          ))}
          <rect x="0" y="8" width="26" height="16" fill="#f8f3ea" />
          <path d="M-3 9 13 -3 29 9Z" fill="#d48a5a" />
          <rect x="10" y="14" width="6" height="10" fill="#c9a77c" />
          <rect x="19" y="12" width="4" height="4" fill={night ? '#f6cf72' : '#dfe8df'} className={night ? 'lv-window' : undefined} />
        </g>
      </g>
    </svg>
  );
}
