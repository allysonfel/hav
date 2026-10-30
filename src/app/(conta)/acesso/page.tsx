import Link from "next/link";
import { ensureSchema } from "@/lib/db";
import { SENHA_MINIMA } from "@/lib/auth";
import { tokenValido } from "@/lib/acesso";
import { definirSenha } from "../acoes";

export default async function Acesso({ searchParams }: { searchParams: Promise<{ t?: string; erro?: string }> }) {
  const q = await searchParams;
  await ensureSchema();
  const valido = q.t ? await tokenValido(q.t) : null;
  if (!valido) {
    return (
      <>
        <div className="aviso erro">Este link expirou ou já foi usado.</div>
        <Link className="btn btn-primary btn-block" href="/recuperar">Pedir novo link</Link>
      </>
    );
  }
  return (
    <form action={definirSenha}>
      <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Crie sua senha</h2>
      <p className="muted sm" style={{ marginTop: 0 }}>Use pelo menos {SENHA_MINIMA} caracteres.</p>
      {q.erro === "senha" && <div className="aviso erro">A senha precisa ter pelo menos {SENHA_MINIMA} caracteres.</div>}
      {q.erro === "aceite" && <div className="aviso erro">Para continuar, marque que leu o aviso de privacidade.</div>}
      <input type="hidden" name="t" value={q.t} />
      <div className="field"><label htmlFor="senha">Nova senha</label><input id="senha" name="senha" type="password" required minLength={SENHA_MINIMA} maxLength={200} autoComplete="new-password" /></div>
      {!valido.aceite && (
        <label className="linha sm" style={{ marginBottom: 14, flexWrap: "nowrap" }}>
          <input type="checkbox" name="aceite" value="1" />
          <span>Li o <Link className="link" href="/privacidade">aviso de privacidade</Link>.</span>
        </label>
      )}
      <button className="btn btn-primary btn-block">Salvar senha</button>
    </form>
  );
}
