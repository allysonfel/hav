// Sobe junto com o servidor: cria as tabelas antes do primeiro acesso e liga a
// rotina da fila do relatório por e-mail (novas tentativas a cada 5 minutos).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { ensureSchema } = await import("./lib/db");
  await ensureSchema().catch((err) => console.error("[rotina] banco indisponível", err instanceof Error ? err.message : err));
  const g = globalThis as { __filaEmail?: NodeJS.Timeout };
  if (!g.__filaEmail) {
    const { processarFila } = await import("./lib/envios");
    g.__filaEmail = setInterval(() => void processarFila(), 5 * 60_000);
    g.__filaEmail.unref?.();
  }
}
