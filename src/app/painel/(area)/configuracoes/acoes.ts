"use server";

// Liga ou desliga os dados de demonstração (sistema preenchido para apresentar).
// Só administrador. Usado em Configurações e no atalho da Visão geral; volta
// para a tela de origem.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { carregarDemo, removerDemo } from "@/lib/demo";

export async function alternarDemo(fd: FormData) {
  const u = await requireUser(["admin"]);
  const ligar = fd.get("acao") === "ligar";
  const destino = fd.get("de") === "/painel" ? "/painel" : "/painel/configuracoes";
  let erro = "";
  try {
    if (ligar) await carregarDemo(u.id);
    else await removerDemo();
  } catch (e) {
    const fk = (e as { code?: string }).code === "23503";
    erro = fk
      ? "Há cadastros reais ligados aos dados de demonstração (por exemplo, uma cota real numa usina fictícia). Remova esse vínculo e tente de novo."
      : e instanceof Error && e.message.startsWith("Já existe") ? e.message : "Não deu para concluir. Nada foi alterado.";
    console.error("[demo]", e instanceof Error ? e.message : e);
  }
  if (erro) redirect(`${destino}?demo_erro=${encodeURIComponent(erro)}`);
  await audit(`usuario:${u.id}`, ligar ? "demo_ligada" : "demo_removida");
  revalidatePath("/", "layout");
  redirect(`${destino}?demo=${ligar ? "ligada" : "removida"}`);
}
