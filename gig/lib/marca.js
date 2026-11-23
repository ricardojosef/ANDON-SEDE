// Desenho da marca do GIG (SVG puro, sem Vue): usado pelo componente Logo
// e para gerar os arquivos assets/marca/gig-*.svg.
// O ícone vem da marca do GLean: o anel com seta (o ciclo de melhoria, no
// mesmo degradê marinho → azul) envolvendo uma grade 2×2, os quatro blocos
// da planilha do GIG. O "GIG" usa o mesmo G geométrico e fino do "GLean".

let seq = 0;

// variante "cor" (fundo claro) ou "clara" (fundo escuro, como a navegação)
export function svgIcone({ variante = "cor", id = `gig${++seq}` } = {}) {
  const [c1, c2] = variante === "clara" ? ["#8fd0f2", "#ffffff"] : ["#0f3a5e", "#2a9fd0"];
  const q = variante === "clara"
    ? ["#ffffff", "#cfe9f8", "#9fd5f2", "#5fb6e3"]
    : ["#123a5c", "#1f6a9a", "#2e8bc0", "#5fb6e3"];
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GIG">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <path d="M45 9.5A26 26 0 1 1 27.5 6.4" fill="none" stroke="url(#${id})" stroke-width="4.6" stroke-linecap="round"/>
  <path d="M33 5.4 26.9 10.2 25.8 2.9Z" fill="${c1}"/>
  <rect x="21" y="21" width="9.6" height="9.6" rx="2.2" fill="${q[0]}"/>
  <rect x="33.4" y="21" width="9.6" height="9.6" rx="2.2" fill="${q[1]}"/>
  <rect x="21" y="33.4" width="9.6" height="9.6" rx="2.2" fill="${q[2]}"/>
  <rect x="33.4" y="33.4" width="9.6" height="9.6" rx="2.2" fill="${q[3]}"/>
</svg>`;
}

// "GIG" desenhado com traços (não depende de fonte); usa currentColor.
export function svgLetras({ cor = "currentColor" } = {}) {
  const g = (cx) => `M${cx + 13.4} 11.5A17 17 0 1 0 ${cx + 17} 22H${cx + 1.5}`;
  return `<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GIG">
  <g fill="none" stroke="${cor}" stroke-width="3.6" stroke-linecap="butt">
    <path d="${g(20)}"/><path d="M50 5V39"/><path d="${g(80)}"/>
  </g>
</svg>`;
}
