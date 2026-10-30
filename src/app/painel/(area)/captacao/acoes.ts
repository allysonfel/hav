"use server";

// Funil da captação (só admin). Confirmar um interessado cria a cota dele:
// valor / meta da usina, sem passar de 100%.
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { celularValido } from "@/lib/cpf";
import { centavosDe } from "@/lib/format";
import { PPM_TOTAL, somaPpm } from "@/lib/rateio";

export async function novoInteressado(fd: FormData) {
  const u = await requireUser(["admin"]);
  const usina = Number(fd.get("usina"));
  const nome = String(fd.get("nome") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const telTxt = String(fd.get("telefone") ?? "").trim();
  const telefone = telTxt ? celularValido(telTxt) : "";
  const valor = centavosDe(fd.get("valor"));
  const origem = String(fd.get("origem") ?? "") === "equipe" ? "equipe" : "indicacao";
  if (nome.length < 2) redirect("/painel/captacao?erro=nome");
  if (telefone === null) redirect("/painel/captacao?erro=telefone");
  if (!valor) redirect("/painel/captacao?erro=valor");
  const [existe] = await sql`SELECT 1 FROM usinas WHERE id = ${usina} AND status = 'captacao'`;
  if (!existe) redirect("/painel/captacao?erro=usina");
  const [n] = await sql<{ id: number }[]>`
    INSERT INTO interesses (usina_id, nome, telefone, valor_centavos, origem) VALUES (${usina}, ${nome}, ${telefone}, ${valor}, ${origem}) RETURNING id`;
  await audit(`usuario:${u.id}`, "interessado_criado", "interesse", n.id);
  redirect("/painel/captacao?ok=interessado");
}

export async function mudarInteresse(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = Number(fd.get("id"));
  const s = String(fd.get("status") ?? "");
  if (!["aguardando", "negociacao", "desistiu"].includes(s)) redirect("/painel/captacao");
  const r = await sql`UPDATE interesses SET status = ${s} WHERE id = ${id} AND status <> 'confirmado' RETURNING id`;
  if (r.length) await audit(`usuario:${u.id}`, "interesse_status", "interesse", id, s);
  redirect("/painel/captacao?ok=status");
}

export async function confirmarInteresse(fd: FormData) {
  const u = await requireUser(["admin"]);
  const id = Number(fd.get("id"));
  const investidor = Number(fd.get("investidor"));
  const valor = centavosDe(fd.get("valor"));
  if (!valor) redirect(`/painel/captacao?confirmar=${id}&erro=valor`);
  const erro = await sql.begin(async (tx) => {
    const [i] = await tx<{ usina_id: number; status: string }[]>`SELECT usina_id, status FROM interesses WHERE id = ${id} FOR UPDATE`;
    if (!i || i.status === "confirmado") return "interesse";
    const [usina] = await tx<{ investimento_centavos: number }[]>`SELECT investimento_centavos FROM usinas WHERE id = ${i.usina_id} FOR UPDATE`;
    const [inv] = await tx`SELECT 1 FROM investidores WHERE id = ${investidor} AND ativo`;
    if (!inv) return "investidor";
    const atual = await tx<{ valor_centavos: number }[]>`SELECT valor_centavos FROM cotas WHERE usina_id = ${i.usina_id} AND investidor_id = ${investidor} AND ativa`;
    // Quem já é cotista desta usina soma o novo valor ao que tinha.
    const total = valor + (atual[0]?.valor_centavos ?? 0);
    const ppm = Math.round((total / usina.investimento_centavos) * PPM_TOTAL);
    const outras = await tx<{ cota_ppm: number }[]>`SELECT cota_ppm FROM cotas WHERE usina_id = ${i.usina_id} AND ativa AND investidor_id <> ${investidor}`;
    if (ppm < 1 || somaPpm(outras) + ppm > PPM_TOTAL) return "excede";
    await tx`
      INSERT INTO cotas (usina_id, investidor_id, cota_ppm, valor_centavos) VALUES (${i.usina_id}, ${investidor}, ${ppm}, ${total})
      ON CONFLICT (usina_id, investidor_id) DO UPDATE SET cota_ppm = ${ppm}, valor_centavos = ${total}, ativa = true`;
    await tx`UPDATE interesses SET status = 'confirmado', investidor_id = ${investidor}, valor_centavos = ${valor} WHERE id = ${id}`;
    return "";
  });
  if (erro) redirect(`/painel/captacao?confirmar=${id}&erro=${erro}`);
  await audit(`usuario:${u.id}`, "interesse_confirmado", "interesse", id, `investidor ${investidor}`);
  redirect("/painel/captacao?ok=confirmado");
}
