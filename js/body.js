// Einfache Muskelgrafik (vorne/hinten). Hauptmuskeln kräftig, Hilfsmuskeln blass.

// [Muskel, Form, Attribute]; jede Form wird für links/rechts gespiegelt, wenn mirror gesetzt ist
const FRONT = [
  ['frontDelts', 'ellipse', { cx: 33, cy: 37, rx: 6.5, ry: 6 }, true],
  ['sideDelts', 'ellipse', { cx: 29, cy: 40, rx: 3.5, ry: 6 }, true],
  ['chest', 'ellipse', { cx: 42, cy: 44, rx: 8.5, ry: 6.5 }, true],
  ['biceps', 'ellipse', { cx: 27, cy: 54, rx: 4.2, ry: 8.5 }, true],
  ['abs', 'rect', { x: 44, y: 52, width: 12, height: 27, rx: 4 }],
  ['obliques', 'ellipse', { cx: 38.5, cy: 64, rx: 3.6, ry: 10 }, true],
  ['gluteMed', 'ellipse', { cx: 35.5, cy: 86, rx: 3.5, ry: 7 }, true],
  ['quads', 'ellipse', { cx: 42, cy: 105, rx: 6.8, ry: 18 }, true],
  ['adductors', 'ellipse', { cx: 47.5, cy: 97, rx: 2.6, ry: 11 }, true],
  ['calves', 'ellipse', { cx: 41.5, cy: 146, rx: 3.6, ry: 12 }, true],
];

const BACK = [
  ['upperBack', 'path', { d: 'M150 26 L163 34 L157 52 L150 56 L143 52 L137 34 Z' }],
  ['rearDelts', 'ellipse', { cx: 133, cy: 37, rx: 6.5, ry: 6 }, true],
  ['lats', 'ellipse', { cx: 140, cy: 56, rx: 6.5, ry: 12 }, true],
  ['triceps', 'ellipse', { cx: 127, cy: 54, rx: 4.2, ry: 8.5 }, true],
  ['lowerBack', 'rect', { x: 145, y: 60, width: 10, height: 17, rx: 3 }],
  ['gluteMed', 'ellipse', { cx: 137.5, cy: 81, rx: 4.5, ry: 5.5 }, true],
  ['glutes', 'ellipse', { cx: 143.5, cy: 89, rx: 7.5, ry: 9 }, true],
  ['hamstrings', 'ellipse', { cx: 142.5, cy: 112, rx: 6.5, ry: 16 }, true],
  ['calves', 'ellipse', { cx: 141.5, cy: 145, rx: 5, ry: 12 }, true],
];

function silhouette(cx) {
  const x = (v) => cx + v;
  return `
    <circle cx="${cx}" cy="13" r="9"/>
    <rect x="${x(-4)}" y="20" width="8" height="8" rx="3"/>
    <path d="M${x(-17)} 32 Q${cx} 26 ${x(17)} 32 L${x(14)} 80 L${x(-14)} 80 Z"/>
    <path d="M${x(-15)} 78 L${x(15)} 78 L${x(16)} 92 L${x(-16)} 92 Z"/>
    <rect x="${x(-27)}" y="31" width="9" height="34" rx="4.5"/>
    <rect x="${x(18)}" y="31" width="9" height="34" rx="4.5"/>
    <rect x="${x(-29)}" y="62" width="7.5" height="26" rx="3.5"/>
    <rect x="${x(21.5)}" y="62" width="7.5" height="26" rx="3.5"/>
    <rect x="${x(-15)}" y="86" width="14" height="44" rx="6"/>
    <rect x="${x(1)}" y="86" width="14" height="44" rx="6"/>
    <rect x="${x(-13)}" y="128" width="10" height="34" rx="4.5"/>
    <rect x="${x(3)}" y="128" width="10" height="34" rx="4.5"/>
    <ellipse cx="${x(-8)}" cy="164" rx="5.5" ry="3"/>
    <ellipse cx="${x(8)}" cy="164" rx="5.5" ry="3"/>`;
}

// cls(muscle) liefert die CSS-Klasse, tap = Muskeln lassen sich antippen (Muskelkater)
function shapes(list, center, cls, tap) {
  let out = '';
  for (const [muscle, tag, attrs, mirror] of list) {
    const extra = tap ? ` data-action="sore-tap" data-m="${muscle}"` : '';
    const draw = (a) => `<${tag} class="${cls(muscle)}"${extra} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
    out += draw(attrs);
    if (mirror) {
      const m = { ...attrs };
      if ('cx' in m) m.cx = 2 * center - m.cx;
      if ('x' in m) m.x = 2 * center - m.x - m.width;
      out += draw(m);
    }
  }
  return out;
}

function svg(cls, label, tap = false) {
  return `<svg class="bodymap${tap ? ' tap' : ''}" viewBox="0 0 200 178" role="img" aria-label="${label}">
    <g class="sil">${silhouette(50)}${silhouette(150)}</g>
    ${shapes(FRONT, 50, cls, tap)}
    ${shapes(BACK, 150, cls, tap)}
    <text x="50" y="176" text-anchor="middle">vorne</text>
    <text x="150" y="176" text-anchor="middle">hinten</text>
  </svg>`;
}

export function bodyMap(primary = [], secondary = []) {
  return svg((m) => (primary.includes(m) ? 'm1' : secondary.includes(m) ? 'm2' : 'm0'), 'Beanspruchte Muskeln');
}

// Muskelkater: levels = { chest: 2, … } (1 leicht, 2 mittel, 3 stark)
export function soreMap(levels = {}, tap = false) {
  return svg((m) => `s${levels[m] || 0}`, 'Muskelkater', tap);
}
