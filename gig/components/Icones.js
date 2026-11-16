// Ícones em SVG inline (traço simples), usados na navegação e nos botões.
const base = (corpo) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;

export const ICONES = {
  inicio: base('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>'),
  gig: base('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 15h3M13 15h3"/>'),
  agenda: base('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><circle cx="12" cy="15.5" r="2.6"/><path d="M12 14.4v1.2l.8.6"/>'),
  clima: base('<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><path d="M9.5 10.5s1 1.5 2.5 1.5 2.5-1.5 2.5-1.5"/>'),
  enc: base('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>'),
  atas: base('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/>'),
  membros: base('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21.5 19"/>'),
  quedas: base('<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>'),
  dash: base('<rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/>'),
  perfil: base('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  sair: base('<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M13 3h6v18h-6"/>'),
  mais: base('<path d="M12 5v14M5 12h14"/>'),
  copiar: base('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  salvar: base('<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3"/><path d="M8 21v-6h8v6"/>'),
  seta: base('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  voltar: base('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
};
