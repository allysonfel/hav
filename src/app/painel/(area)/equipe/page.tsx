import Link from "next/link";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { requireUser, PERFIL_NOME, type Perfil } from "@/lib/session";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { guardarSegredo, lerSegredo } from "@/lib/segredo";
import { haQuanto } from "@/lib/format";
import { EMAIL } from "@/lib/settings";
import { Retorno } from "@/components/basicos";
import { Confirmar } from "@/components/Confirmar";

type Pessoa = { id: number; nome: string; email: string; perfil: Perfil; ativo: boolean; ultimo_acesso: Date | null };

// Senha provisória legível (sem letras que confundem), mostrada uma vez para o admin repassar.
function senhaProvisoria(): string {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12), (b) => a[b % a.length]).join("").replace(/(.{4})(?!$)/g, "$1-");
}

async function convidar(fd: FormData) {
  "use server";
  const u = await requireUser(["admin"]);
  const nome = String(fd.get("nome") ?? "").trim().slice(0, 80);
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const perfil: Perfil = fd.get("perfil") === "admin" ? "admin" : "operador";
  if (nome.length < 2 || !EMAIL.test(email)) redirect("/painel/equipe?erro=dados");
  const [existe] = await sql`SELECT 1 FROM usuarios WHERE email = ${email}`;
  if (existe) redirect("/painel/equipe?erro=email");
  const senha = senhaProvisoria();
  const [n] = await sql<{ id: number }[]>`
    INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (${nome}, ${email}, ${hashPassword(senha)}, ${perfil}) RETURNING id`;
  await audit(`usuario:${u.id}`, "usuario_criado", "usuario", n.id, perfil);
  await guardarSegredo("usuario", n.id, senha);
  redirect(`/painel/equipe?nova=${n.id}`);
}

async function mudarPerfil(fd: FormData) {
  "use server";
  const u = await requireUser(["admin"]);
  const id = Number(fd.get("id"));
  const perfil: Perfil = fd.get("perfil") === "admin" ? "admin" : "operador";
  if (id === u.id) redirect("/painel/equipe?erro=proprio");
  const r = await sql`UPDATE usuarios SET perfil = ${perfil}, sessao_versao = sessao_versao + 1 WHERE id = ${id} RETURNING id`;
  if (r.length) await audit(`usuario:${u.id}`, "usuario_editado", "usuario", id, perfil);
  redirect("/painel/equipe?ok=1");
}

async function novaSenha(fd: FormData) {
  "use server";
  const u = await requireUser(["admin"]);
  const id = Number(fd.get("id"));
  const senha = senhaProvisoria();
  const r = await sql`UPDATE usuarios SET senha_hash = ${hashPassword(senha)}, sessao_versao = sessao_versao + 1 WHERE id = ${id} RETURNING id`;
  if (!r.length) redirect("/painel/equipe");
  await audit(`usuario:${u.id}`, "senha_provisoria", "usuario", id);
  await guardarSegredo("usuario", id, senha);
  redirect(`/painel/equipe?nova=${id}`);
}

async function ativar(fd: FormData) {
  "use server";
  const u = await requireUser(["admin"]);
  const id = Number(fd.get("id"));
  if (id === u.id) redirect("/painel/equipe?erro=proprio");
  const ativo = fd.get("ativo") === "1";
  const r = await sql`UPDATE usuarios SET ativo = ${ativo}, sessao_versao = sessao_versao + 1 WHERE id = ${id} RETURNING id`;
  if (r.length) await audit(`usuario:${u.id}`, ativo ? "usuario_reativado" : "usuario_desativado", "usuario", id);
  redirect("/painel/equipe?ok=1");
}

const ERROS: Record<string, string> = {
  dados: "Confira nome e e-mail.",
  email: "Já existe alguém com este e-mail.",
  proprio: "Você não pode mudar o próprio perfil nem se desativar.",
};

export default async function Equipe({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; nova?: string; convidar?: string }> }) {
  const eu = await requireUser(["admin"]);
  const sp = await searchParams;
  const pessoas = await sql<Pessoa[]>`SELECT id, nome, email, perfil, ativo, ultimo_acesso FROM usuarios ORDER BY ativo DESC, perfil, nome`;
  const nova = pessoas.find((p) => p.id === Number(sp.nova));
  const senhaNova = nova ? await lerSegredo("usuario", nova.id) : "";

  return (
    <>
      <Retorno ok={sp.ok} erro={sp.erro} mapaErro={ERROS} />
      {nova && senhaNova && (
        <div className="card card-p" style={{ marginBottom: 16 }}>
          <b>Senha provisória de {nova.nome}</b>
          <p className="muted sm" style={{ margin: "4px 0 8px" }}>Aparece só agora. Repasse por um canal seguro; a pessoa troca em Minha conta depois de entrar.</p>
          <div className="segredo">{senhaNova}</div>
        </div>
      )}
      <div className="section-head">
        <h3>Equipe</h3>
        <Link className="btn btn-primary" href="/painel/equipe?convidar=1">+ Convidar</Link>
      </div>
      {sp.convidar && (
        <form action={convidar} className="card card-p" style={{ marginBottom: 16, maxWidth: 760 }}>
          <div className="form-grid">
            <div className="field"><label htmlFor="nome">Nome</label><input id="nome" name="nome" required maxLength={80} /></div>
            <div className="field"><label htmlFor="email">E-mail (login)</label><input id="email" name="email" type="email" required maxLength={160} /></div>
            <div className="field"><label htmlFor="perfil">Papel</label><select id="perfil" name="perfil" defaultValue="operador"><option value="operador">Operador</option><option value="admin">Administrador</option></select></div>
          </div>
          <div className="linha"><button className="btn btn-primary">Convidar</button><Link className="link" href="/painel/equipe">Cancelar</Link></div>
        </form>
      )}
      <div className="card card-t">
        <div className="tbl-wrap">
          <table className="dt">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Último acesso</th><th></th></tr></thead>
            <tbody>
              {pessoas.map((p) => (
                <tr key={p.id} style={p.ativo ? undefined : { opacity: .55 }}>
                  <td className="row-name">{p.nome}</td>
                  <td>{p.email}</td>
                  <td><span className="pill pill-muted">{PERFIL_NOME[p.perfil]}</span></td>
                  <td>{!p.ativo ? <span className="pill pill-muted">Inativo</span> : p.ultimo_acesso ? <span className="pill pill-ok">Ativo</span> : <span className="pill pill-warn">Convite pendente</span>}</td>
                  <td className="muted">{haQuanto(p.ultimo_acesso)}</td>
                  <td className="acoes">
                    {p.id !== eu.id && (
                      <div className="linha">
                        <form action={mudarPerfil}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="perfil" value={p.perfil === "admin" ? "operador" : "admin"} />
                          <button className="btn btn-ghost btn-sm">{p.perfil === "admin" ? "Tornar operador" : "Tornar admin"}</button>
                        </form>
                        <form action={novaSenha}><input type="hidden" name="id" value={p.id} /><button className="btn btn-ghost btn-sm">Nova senha</button></form>
                        <form action={ativar}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="ativo" value={p.ativo ? "0" : "1"} />
                          <Confirmar className={`btn btn-sm ${p.ativo ? "btn-danger" : "btn-ghost"}`} ativo={p.ativo} titulo={`Desativar ${p.nome}?`} texto="A pessoa sai do painel na hora e não consegue mais entrar. Dá para reativar depois." confirmar="Desativar">{p.ativo ? "Desativar" : "Reativar"}</Confirmar>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted sm">Administradores têm acesso completo, inclusive a dados financeiros, fechamento do mês e exclusão de registros. Operadores lançam geração e emitem relatórios, sem acesso a valores de captação, documentos e chaves Pix.</p>
    </>
  );
}
