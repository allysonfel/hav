import { redirect } from "next/navigation";
import { requireUser, startSession, PERFIL_NOME } from "@/lib/session";
import { sql } from "@/lib/db";
import { hashPassword, verifyPassword, SENHA_MINIMA } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { Retorno } from "@/components/basicos";

async function salvarPerfil(fd: FormData) {
  "use server";
  const u = await requireUser();
  const nome = String(fd.get("nome") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const telefone = String(fd.get("telefone") ?? "").trim().slice(0, 20);
  const cargo = String(fd.get("cargo") ?? "").trim().slice(0, 60);
  if (nome.length < 2) redirect("/painel/conta?erro=nome");
  await sql`UPDATE usuarios SET nome = ${nome}, telefone = ${telefone}, cargo = ${cargo} WHERE id = ${u.id}`;
  await audit(`usuario:${u.id}`, "perfil_salvo", "usuario", u.id);
  redirect("/painel/conta?ok=perfil");
}

async function trocarSenha(fd: FormData) {
  "use server";
  const u = await requireUser();
  const atual = String(fd.get("atual") ?? "").slice(0, 200);
  const nova = String(fd.get("nova") ?? "");
  const [r] = await sql<{ senha_hash: string }[]>`SELECT senha_hash FROM usuarios WHERE id = ${u.id}`;
  if (!r || !verifyPassword(atual, r.senha_hash)) redirect("/painel/conta?erro=atual");
  if (nova.length < SENHA_MINIMA || nova.length > 200) redirect("/painel/conta?erro=curta");
  // Trocar a senha encerra as outras sessões (versão nova); esta continua.
  const [v] = await sql<{ v: number }[]>`
    UPDATE usuarios SET senha_hash = ${hashPassword(nova)}, sessao_versao = sessao_versao + 1 WHERE id = ${u.id} RETURNING sessao_versao AS v`;
  await startSession(u.id, v.v);
  await audit(`usuario:${u.id}`, "senha_trocada", "usuario", u.id);
  redirect("/painel/conta?ok=senha");
}

export default async function Conta({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  return (
    <div style={{ maxWidth: 560 }}>
      <Retorno ok={sp.ok} erro={sp.erro}
        mapaOk={{ perfil: "Perfil salvo.", senha: "Senha trocada. As outras sessões foram encerradas." }}
        mapaErro={{ nome: "Informe o nome.", atual: "Senha atual incorreta.", curta: `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` }} />
      <form action={salvarPerfil} className="card card-p" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>Perfil</h4>
        <div className="form-grid">
          <div className="field"><label htmlFor="nome">Nome</label><input id="nome" name="nome" defaultValue={u.nome} required maxLength={80} /></div>
          <div className="field"><label htmlFor="email">E-mail</label><input id="email" value={u.email} disabled readOnly /></div>
          <div className="field"><label htmlFor="telefone">Telefone</label><input id="telefone" name="telefone" defaultValue={u.telefone} maxLength={20} /></div>
          <div className="field"><label htmlFor="cargo">Cargo</label><input id="cargo" name="cargo" defaultValue={u.cargo} maxLength={60} /></div>
        </div>
        <div className="linha"><button className="btn btn-primary">Salvar alterações</button><span className="muted sm">{PERFIL_NOME[u.perfil]}</span></div>
      </form>
      <form action={trocarSenha} className="card card-p">
        <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>Trocar senha</h4>
        <div className="field"><label htmlFor="atual">Senha atual</label><input id="atual" name="atual" type="password" required maxLength={200} autoComplete="current-password" /></div>
        <div className="field"><label htmlFor="nova">Nova senha (mínimo {SENHA_MINIMA} caracteres)</label><input id="nova" name="nova" type="password" required minLength={SENHA_MINIMA} maxLength={200} autoComplete="new-password" /></div>
        <button className="btn btn-primary">Trocar senha</button>
      </form>
    </div>
  );
}
