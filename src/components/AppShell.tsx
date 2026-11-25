"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ic, type IcNome } from "./Ic";
import { TemaBotao } from "./TemaBotao";

const TABS: { href: string; nome: string; ic: IcNome; so?: "oportunidades" }[] = [
  { href: "/", nome: "Início", ic: "inicio" },
  { href: "/usinas", nome: "Usinas", ic: "usinas" },
  { href: "/oportunidades", nome: "Oportunidades", ic: "captacao", so: "oportunidades" },
  { href: "/relatorios", nome: "Relatórios", ic: "relatorios" },
  { href: "/perfil", nome: "Perfil", ic: "equipe" },
];

// Telas de leitura e formulário: no computador ficam numa coluna mais estreita.
const LARGAS = ["/", "/usinas", "/oportunidades"];

// No celular (até 1023 px) o app é a coluna com a barra de abas embaixo, como sempre.
// No computador (a partir de 1024 px) o menu vai para a lateral (.inv-side, escondido
// no celular) e a barra de abas some; tudo isso só no CSS de min-width: 1024px.
export function AppShell({ children, naoLidos, oportunidades, nome, email }: { children: React.ReactNode; naoLidos: number; oportunidades: boolean; nome: string; email: string }) {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === h : path === h || path.startsWith(h + "/"));
  const tabs = TABS.filter((t) => !t.so || oportunidades);
  return (
    <div className="app">
      <aside className="inv-side" aria-label="Menu">
        <Link className="inv-side-brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icone-64.png" alt="" />
          <span>HAV Energia</span>
        </Link>
        <nav className="inv-side-nav">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={on(t.href) && !(t.href === "/perfil" && path === "/avisos") ? "active" : ""}>
              <Ic n={t.ic} />
              {t.nome}
            </Link>
          ))}
          <Link href="/avisos" className={on("/avisos") ? "active" : ""}>
            <Ic n="sino" />
            Avisos
            {naoLidos > 0 && <span className="inv-side-cont">{naoLidos > 9 ? "9+" : naoLidos}</span>}
          </Link>
          <Link href="/ajuda" className={on("/ajuda") ? "active" : ""}>
            <Ic n="ajuda" />
            Ajuda
          </Link>
        </nav>
        <Link className="inv-side-user" href="/perfil">
          <span className="inv-side-av">{nome.trim().split(/\s+/).map((p, i, l) => (i === 0 || i === l.length - 1 ? p[0] : "")).join("").toUpperCase()}</span>
          <span className="inv-side-meta"><b>{nome}</b><small>{email}</small></span>
        </Link>
      </aside>
      <div className="inv-top">
        <Link className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icone-64.png" alt="" />
          <span>HAV Energia</span>
        </Link>
        <div className="linha" style={{ gap: 8, flexWrap: "nowrap" }}>
          <TemaBotao />
        <Link className="bell-btn" href="/avisos" aria-label={naoLidos ? `${naoLidos} avisos novos` : "Avisos"} style={{ width: 32, height: 32 }}>
          <Ic n="sino" />
          {naoLidos > 0 && <span className="bell-dot" />}
        </Link>
        </div>
      </div>
      <div className={`inv-scroll${LARGAS.includes(path) ? "" : " estreita"}`}>{children}</div>
      <nav className="bottom-nav">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={on(t.href) ? "active" : ""}>
            <Ic n={t.ic} />
            {t.nome}
          </Link>
        ))}
      </nav>
    </div>
  );
}
