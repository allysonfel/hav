import { redirect } from "next/navigation";
import { getInvestidor } from "@/lib/investidor";
import { Abas } from "../Abas";
import { entrar } from "../acoes";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  if (await getInvestidor()) redirect("/");
  const q = await searchParams;
  return (
    <>
      <Abas atual="/entrar" />
      {q.erro && <div className="aviso erro">{q.erro === "bloqueado" ? "Muitas tentativas. Aguarde 15 minutos." : "E-mail ou senha incorretos."}</div>}
      {q.ok === "senha" && <div className="aviso ok">Senha criada. Entre para continuar.</div>}
      <form action={entrar}>
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" required maxLength={160} autoComplete="username" /></div>
        <div className="field"><label htmlFor="senha">Senha</label><input id="senha" name="senha" type="password" required maxLength={200} autoComplete="current-password" /></div>
        <button className="btn btn-primary btn-block">Entrar</button>
      </form>
    </>
  );
}
