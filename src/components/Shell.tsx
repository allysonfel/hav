"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Ic, type IcNome } from "./Ic";

type Perfil = "admin" | "operador";
type Item = { href: string; nome: string; ic: IcNome; so?: Perfil };

const NAV: Item[] = [
  { href: "/painel", nome: "Visão geral", ic: "geral" },
  { href: "/painel/usinas", nome: "Usinas", ic: "usinas" },
  { href: "/painel/investidores", nome: "Investidores", ic: "investidores" },
  { href: "/painel/captacao", nome: "Captação", ic: "captacao", so: "admin" },
  { href: "/painel/comparativo", nome: "Comparativo", ic: "comparativo" },
  { href: "/painel/relatorios", nome: "Relatórios", ic: "relatorios" },
  { href: "/painel/equipe", nome: "Equipe", ic: "equipe", so: "admin" },
  { href: "/painel/configuracoes", nome: "Configurações", ic: "config", so: "admin" },
];

const TITULOS: [RegExp, string, string][] = [
  [/^\/painel$/, "Visão geral", "Resumo de todas as usinas"],
  [/^\/painel\/usinas\/nova/, "Nova usina", "Cadastro da usina"],
  [/^\/painel\/usinas\/[^/]+\/lancar/, "Lançar geração", "Geração e receita do mês"],
  [/^\/painel\/usinas\/[^/]+\/editar/, "Editar usina", "Cadastro da usina"],
  [/^\/painel\/usinas\/.+/, "Usina", "Geração, receita e cotistas"],
  [/^\/painel\/usinas/, "Usinas", "Gestão das usinas e dos cotistas de cada uma"],
  [/^\/painel\/fechamentos/, "Fechamento do mês", "Rateio por cota e repasses"],
  [/^\/painel\/investidores\/novo/, "Novo investidor", "Cadastro do investidor"],
  [/^\/painel\/investidores\/.+\/editar/, "Editar investidor", "Cadastro do investidor"],
  [/^\/painel\/investidores\/.+/, "Investidor", "Cotas, receita e repasses"],
  [/^\/painel\/investidores/, "Investidores", "Todos os investidores da HAV Energia"],
  [/^\/painel\/captacao/, "Captação", "Usinas em captação e interessados"],
  [/^\/painel\/comparativo/, "Comparativo", "Usinas lado a lado no mesmo período"],
  [/^\/painel\/relatorios/, "Relatórios", "Rateio por usina e por investidor"],
  [/^\/painel\/equipe/, "Equipe", "Usuários internos e papéis de acesso"],
  [/^\/painel\/configuracoes/, "Configurações", "Preferências do sistema"],
  [/^\/painel\/conta/, "Minha conta", "Perfil e senha"],
];

export function Shell({ children, usuario, avisos, sair }: {
  children: React.ReactNode;
  usuario: { nome: string; iniciais: string; perfil: Perfil; perfilNome: string };
  avisos: { texto: string; href: string }[];
  sair: () => Promise<void>;
}) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [pathMenu, setPathMenu] = useState(path);
  if (pathMenu !== path) {
    setPathMenu(path);
    setMenu(false);
  }
  const on = (h: string) => (h === "/painel" ? path === h : path === h || path.startsWith(h + "/"));
  const [, titulo = "", sub = ""] = TITULOS.find(([r]) => r.test(path)) ?? [];

  return (
    <div className="shell">
      <aside className={`a-sidebar${menu ? " aberta" : ""}`}>
        <Link className="a-brand" href="/painel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icone-64.png" alt="" />
          <span>HAV Energia</span>
        </Link>
        <nav className="a-nav">
          {NAV.filter((n) => !n.so || n.so === usuario.perfil).map((n) => (
            <Link key={n.href} href={n.href} className={on(n.href) ? "active" : ""}>
              <Ic n={n.ic} />
              {n.nome}
            </Link>
          ))}
        </nav>
        <div className="a-sidebar-foot">
          <Link className="a-user" href="/painel/conta">
            <div className="av">{usuario.iniciais}</div>
            <div className="meta"><b>{usuario.nome}</b><span>{usuario.perfilNome}</span></div>
          </Link>
          <form action={sair}><button className="sair">Sair</button></form>
        </div>
      </aside>

      <div className="a-main">
        <div className="a-topbar">
          <Link className="mob-logo" href="/painel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icone-64.png" alt="" />
            HAV Energia
          </Link>
          <div className="titulo"><h2>{titulo}</h2><div className="sub">{sub}</div></div>
          <div className="a-top-actions">
            <details className="sino" key={path}>
              <summary className="bell-btn" aria-label="Avisos">
                <Ic n="sino" />
                {avisos.length > 0 && <span className="bell-dot" />}
              </summary>
              <div className="sino-lista">
                {avisos.length === 0 && <p>Nada pendente.</p>}
                {avisos.map((a) => <Link key={a.texto} href={a.href}>{a.texto}</Link>)}
              </div>
            </details>
            <button type="button" className="bell-btn btn-menu" onClick={() => setMenu(!menu)} aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu}>
              <Ic n={menu ? "fechar" : "menu"} />
            </button>
          </div>
        </div>
        <div className="mob-titulo"><h2>{titulo}</h2></div>
        <div className="a-content">{children}</div>
      </div>
    </div>
  );
}
