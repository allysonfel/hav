// LGPD: cópia dos dados do próprio investidor, em JSON.
import { getInvestidor } from "@/lib/investidor";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { decifrar } from "@/lib/cifra";
import { meusRelatorios, minhasUsinas } from "@/lib/app";

export const dynamic = "force-dynamic";

export async function GET() {
  const i = await getInvestidor();
  if (!i) return new Response("proibido", { status: 403 });
  const [c] = await sql<{ documento_cifrado: string | null; pix_cifrado: string | null; aceite_em: Date | null; criado_em: Date; ultimo_acesso: Date | null }[]>`
    SELECT documento_cifrado, pix_cifrado, aceite_em, criado_em, ultimo_acesso FROM investidores WHERE id = ${i.id}`;
  const usinas = await minhasUsinas(i.id);
  const relatorios = await meusRelatorios(i.id);
  await audit(`investidor:${i.id}`, "dados_baixados", "investidor", i.id);
  const dados = {
    gerado_em: new Date().toISOString(),
    conta: { nome: i.nome, email: i.email, celular: i.celular, documento: decifrar(c.documento_cifrado), chave_pix: decifrar(c.pix_cifrado), aceite_em: c.aceite_em, criado_em: c.criado_em, ultimo_acesso: c.ultimo_acesso },
    cotas: usinas.map((u) => ({ usina: u.nome, cota_ppm: u.cota_ppm, valor_centavos: u.valor_centavos })),
    rateios: relatorios.map((r) => ({ usina: r.usina, mes: r.comp, cota_ppm: r.cota_ppm, geracao_wh: r.geracao_wh, receita_centavos: r.receita_centavos, repasse: r.repasse_status })),
  };
  return new Response(JSON.stringify(dados, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="meus-dados-hav.json"`, "Cache-Control": "no-store" },
  });
}
