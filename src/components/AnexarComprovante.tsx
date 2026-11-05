"use client";

import { useRef, useState } from "react";

// Botão que abre o seletor de arquivo e já envia o comprovante ao escolher
// (sem um segundo clique). A ação no servidor confere tipo e tamanho.
export function AnexarComprovante({ acao, fechamento, rateio, rotulo }: { acao: (fd: FormData) => Promise<void>; fechamento: number; rateio: number; rotulo: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <form ref={form} action={acao}>
      <input type="hidden" name="fechamento" value={fechamento} />
      <input type="hidden" name="rateio" value={rateio} />
      <label className={`btn btn-ghost btn-sm${enviando ? " carregando" : ""}`} title="Imagem ou PDF do Pix, até 3 MB">
        {enviando ? "Enviando…" : rotulo}
        <input
          type="file"
          name="comprovante"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          hidden
          disabled={enviando}
          onChange={(e) => {
            if (!e.currentTarget.files?.length) return;
            setEnviando(true);
            form.current?.requestSubmit();
          }}
        />
      </label>
    </form>
  );
}
