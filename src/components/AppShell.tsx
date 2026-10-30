"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ic, type IcNome } from "./Ic";

const TABS: { href: string; nome: string; ic: IcNome; so?: "oportunidades" }[] = [
  { href: "/", nome: "Início", ic: "inicio" },
  { href: "/usinas", nome: "Usinas", ic: "usinas" },
  { href: "/oportunidades", nome: "Oportunidades", ic: "captacao", so: "oportunidades" },
  { href: "/relatorios", nome: "Relatórios", ic: "relatorios" },
  { href: "/perfil", nome: "Perfil", ic: "equipe" },
];

export function AppShell({ children, naoLidos, oportunidades }: { children: React.ReactNode; naoLidos: number; oportunidades: boolean }) {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === h : path === h || path.startsWith(h + "/"));
  return (
    <div className="app">
      <div className="inv-top">
        <Link className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icone-64.png" alt="" />
          <span>HAV Energia</span>
        </Link>
        <Link className="bell-btn" href="/avisos" aria-label={naoLidos ? `${naoLidos} avisos novos` : "Avisos"} style={{ width: 32, height: 32 }}>
          <Ic n="sino" />
          {naoLidos > 0 && <span className="bell-dot" />}
        </Link>
      </div>
      <div className="inv-scroll">{children}</div>
      <nav className="bottom-nav">
        {TABS.filter((t) => !t.so || oportunidades).map((t) => (
          <Link key={t.href} href={t.href} className={on(t.href) ? "active" : ""}>
            <Ic n={t.ic} />
            {t.nome}
          </Link>
        ))}
      </nav>
    </div>
  );
}
