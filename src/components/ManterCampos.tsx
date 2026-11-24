"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

// Mantém o que foi digitado quando o servidor recusa o formulário. As actions
// respondem com redirect para ?erro=..., que remonta a tela com os campos
// vazios. Ao enviar, guardamos os valores na aba (sessionStorage, nunca senha,
// campo oculto ou arquivo); se a tela volta com ?erro, devolvemos aos campos e
// apagamos a cópia. Sem erro, a cópia é apagada na hora.
export function ManterCampos({ chave }: { chave: string }) {
  const marca = useRef<HTMLSpanElement>(null);
  const busca = useSearchParams();
  const erro = busca.get("erro");

  useEffect(() => {
    const form = marca.current?.closest("form");
    if (!form) return;
    const k = `form:${chave}`;
    try {
      const salvo = sessionStorage.getItem(k);
      sessionStorage.removeItem(k);
      if (erro && salvo) {
        const valores = JSON.parse(salvo) as Record<string, string | boolean>;
        for (const [nome, v] of Object.entries(valores)) {
          const el = form.elements.namedItem(nome);
          if (el instanceof HTMLInputElement && !IGNORAR.has(el.type)) {
            if (el.type === "checkbox") el.checked = v === true;
            else el.value = String(v);
          } else if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
            el.value = String(v);
          }
        }
      }
    } catch {
      // sem sessionStorage (aba privada, bloqueio): segue sem guardar
    }
    const guardar = () => {
      try {
        const valores: Record<string, string | boolean> = {};
        for (const el of Array.from(form.elements)) {
          if (el instanceof HTMLInputElement) {
            if (!el.name || IGNORAR.has(el.type)) continue;
            valores[el.name] = el.type === "checkbox" ? el.checked : el.value;
          } else if ((el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) && el.name) {
            valores[el.name] = el.value;
          }
        }
        sessionStorage.setItem(k, JSON.stringify(valores));
      } catch {
        // idem
      }
    };
    form.addEventListener("submit", guardar);
    return () => form.removeEventListener("submit", guardar);
  }, [chave, erro]);

  return <span ref={marca} hidden />;
}

const IGNORAR = new Set(["password", "hidden", "file", "submit", "button"]);

// Filtro que aplica sozinho: trocar um select envia o formulário (GET).
export function EnviarAoTrocar() {
  const marca = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = marca.current?.closest("form");
    if (!form) return;
    const enviar = () => form.requestSubmit();
    form.addEventListener("change", enviar);
    return () => form.removeEventListener("change", enviar);
  }, []);
  return <span ref={marca} hidden />;
}
