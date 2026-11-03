"use client";

// Agente de IA (Plus), como no protótipo: botão dourado no canto e conversa
// num painel com cabeçalho azul. No painel fica no canto da tela; no app,
// acima da barra de baixo. A conversa dura enquanto a aba está aberta.
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Ic } from "./Ic";

type Msg = { r: "u" | "b"; t: string; ir?: { nome: string; href: string } | null };

const CONF = {
  painel: {
    url: "/api/agente/painel",
    sub: "Tira dúvidas da equipe, 24h",
    ola: "Oi! Pergunte sobre usinas, geração, receita, cotistas, repasses ou como usar o painel.",
    sugestoes: ["Quais repasses estão pendentes?", "Qual usina rendeu mais por kWp?", "Como fecho o mês?"],
  },
  app: {
    url: "/api/agente/app",
    sub: "Tira dúvidas sobre sua cota, 24h",
    ola: "Oi! Pergunte sobre suas usinas, sua receita, seus repasses ou como usar o app.",
    sugestoes: ["Quanto recebi no último mês?", "Por que minha receita mudou?", "Meus repasses estão em dia?"],
  },
};

let guardada: Record<string, Msg[]> = {};

export function Agente({ onde }: { onde: "painel" | "app" }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button className={`ai-fab ai-fab-${onde}`} onClick={() => setAberto(!aberto)} aria-label={aberto ? "Fechar o agente" : "Abrir o agente de IA"} aria-expanded={aberto} title="Agente de IA HAV Energia">
        <Ic n={aberto ? "fechar" : "agente"} />
      </button>
      {aberto && <Painel onde={onde} fechar={() => setAberto(false)} />}
    </>
  );
}

function Painel({ onde, fechar }: { onde: "painel" | "app"; fechar: () => void }) {
  const c = CONF[onde];
  const router = useRouter();
  const path = usePathname();
  const [msgs, setMsgs] = useState<Msg[]>(guardada[onde] ?? [{ r: "b", t: c.ola }]);
  const [txt, setTxt] = useState("");
  const [esperando, setEsperando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { guardada = { ...guardada, [onde]: msgs }; }, [msgs, onde]);
  useEffect(() => { caixa.current?.scrollTo({ top: caixa.current.scrollHeight }); }, [msgs, esperando]);
  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [fechar]);

  async function perguntar(q: string) {
    q = q.trim();
    if (!q || esperando) return;
    setTxt("");
    // Só a conversa de verdade vai junto (a saudação inicial fica de fora).
    const anteriores = msgs.slice(1).map((m) => ({ r: m.r, t: m.t }));
    setMsgs((l) => [...l, { r: "u", t: q }]);
    setEsperando(true);
    let m: Msg = { r: "b", t: "Não consegui responder agora. Confira a internet e tente de novo." };
    try {
      const res = await fetch(c.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, anteriores }),
        signal: AbortSignal.timeout(40_000),
      });
      if (res.ok) m = { r: "b", ...((await res.json()) as { t: string; ir: Msg["ir"] }) };
      else if (res.status === 401) m = { r: "b", t: "Sua sessão expirou. Entre de novo para continuar." };
      else if (res.status === 429) m = { r: "b", t: "Muitas perguntas seguidas. Espere um minuto e tente de novo." };
    } catch { /* sem rede ou demorou */ }
    setMsgs((l) => [...l, m]);
    setEsperando(false);
  }

  return (
    <div className={`ai-panel ai-panel-${onde}`} role="dialog" aria-label="Agente de IA">
      <div className="ai-panel-head">
        <div><b>Agente HAV Energia</b><span>{c.sub}</span></div>
        <button onClick={fechar} aria-label="Fechar">✕</button>
      </div>
      <div className="ai-panel-body" ref={caixa} aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`ai-msg ${m.r === "u" ? "user" : "bot"}`}>
            {m.t}
            {m.ir && m.ir.href !== path && (
              <button className="ai-ir" onClick={() => { fechar(); router.push(m.ir!.href); }}>Abrir {m.ir.nome} ›</button>
            )}
          </div>
        ))}
        {esperando && <div className="ai-msg bot ai-pensando" aria-label="Pensando"><i /><i /><i /></div>}
        {msgs.length === 1 && (
          <div className="ai-sugestoes">
            {c.sugestoes.map((q) => <button key={q} onClick={() => perguntar(q)}>{q}</button>)}
          </div>
        )}
      </div>
      <form className="ai-panel-input" onSubmit={(e) => { e.preventDefault(); perguntar(txt); }}>
        <input ref={campo} value={txt} onChange={(e) => setTxt(e.target.value)} maxLength={400} placeholder="Pergunte algo..." aria-label="Sua pergunta" />
        <button disabled={!txt.trim() || esperando}>Enviar</button>
      </form>
      <p className="ai-rodape">Respostas geradas por IA com os dados do sistema. Confira os valores nas telas.</p>
    </div>
  );
}
