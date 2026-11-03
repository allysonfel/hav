// Ícones do protótipo aprovado (traço de 1,8 px, 24x24).
const IC = {
  inicio: <><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h12v-9" /></>,
  geral: <><rect x="3" y="12" width="4" height="8" rx="1" /><rect x="10" y="7" width="4" height="13" rx="1" /><rect x="17" y="3" width="4" height="17" rx="1" /></>,
  usinas: <><path d="M4 21V9l8-5 8 5v12" /><path d="M9 21v-7h6v7" /></>,
  investidores: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.3 2.6-5.6 5.5-5.6s5.5 2.3 5.5 5.6" /><path d="M16.5 8.3a3 3 0 1 1 0-5.9" /><path d="M15.5 14.3c2.6.3 4.5 2.4 4.5 5.7" /></>,
  captacao: <><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>,
  relatorios: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9.5 13h5M9.5 16.5h5" /></>,
  equipe: <><circle cx="12" cy="8" r="3.3" /><path d="M5 20c0-3.6 3-6.2 7-6.2s7 2.6 7 6.2" /></>,
  config: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  comparativo: <><path d="M3 20h18" /><path d="M4 16l5-6 4 3 7-8" /></>,
  agente: <><path d="M4 5h16v11H8l-4 4V5z" /><path d="M8.5 9.5h7M8.5 12.5h4.5" /></>,
  pdf: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" /></>,
  sino: <><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  fechar: <path d="M6 6l12 12M18 6 6 18" />,
};

export function Ic({ n }: { n: keyof typeof IC }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{IC[n]}</svg>;
}
export type IcNome = keyof typeof IC;
