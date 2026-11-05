"use client";

import { useFormStatus } from "react-dom";
import { useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// Botão de ação que pede confirmação antes de enviar o formulário em que está.
// Sem `ativo`, envia direto (ex.: "Reativar" não precisa perguntar).
export function Confirmar({
  className,
  children,
  titulo,
  texto,
  confirmar,
  perigo = true,
  ativo = true,
  ...resto
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  className: string;
  children: ReactNode;
  titulo: string;
  texto: ReactNode;
  confirmar: string;
  perigo?: boolean;
  ativo?: boolean;
}) {
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDialogElement>(null);
  const { pending: enviando } = useFormStatus();
  const idTitulo = useId();

  if (!ativo) return <button {...resto} className={className}>{children}</button>;

  const fechar = () => caixa.current?.close();
  return (
    <>
      <button {...resto} ref={botao} type="button" className={className} disabled={enviando} onClick={() => caixa.current?.showModal()}>
        {children}
      </button>
      <dialog
        ref={caixa}
        className="confirmar"
        aria-labelledby={idTitulo}
        onClick={(e) => { if (e.target === caixa.current) fechar(); }}
      >
        <div className="confirmar-corpo">
        <h3 id={idTitulo}>{titulo}</h3>
        <div className="confirmar-texto">{texto}</div>
        <div className="confirmar-acoes">
          <button type="button" className="btn btn-ghost" onClick={fechar} autoFocus>Cancelar</button>
          <button
            type="button"
            className={`btn ${perigo ? "btn-perigo" : "btn-primary"}`}
            disabled={enviando}
            onClick={() => {
              fechar();
              botao.current?.closest("form")?.requestSubmit();
            }}
          >
            {confirmar}
          </button>
        </div>
        </div>
      </dialog>
    </>
  );
}
