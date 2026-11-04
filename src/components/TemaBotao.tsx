"use client";

import { useEffect, useState } from "react";
import { Ic } from "./Ic";

// Alterna claro/escuro. A escolha vai para o cookie hav-tema, que o layout lê no
// servidor (abre já no tema certo, sem piscar). Sem escolha, segue o aparelho.
export function TemaBotao() {
  const [tema, setTema] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTema(t === "dark" || t === "light" ? t : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  const trocar = () => {
    const novo = tema === "dark" ? "light" : "dark";
    const html = document.documentElement;
    html.classList.add("trocando-tema");
    html.dataset.theme = novo;
    document.cookie = `hav-tema=${novo}; path=/; max-age=31536000; samesite=lax`;
    setTema(novo);
    setTimeout(() => html.classList.remove("trocando-tema"), 300);
  };
  const nome = tema === "dark" ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button type="button" className="tema-btn" onClick={trocar} aria-label={nome} title={nome}>
      <Ic key={tema ?? "x"} n={tema === "dark" ? "sol" : "lua"} />
    </button>
  );
}
