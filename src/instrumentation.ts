// Sobe junto com o servidor: cria as tabelas antes do primeiro acesso.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { ensureSchema } = await import("./lib/db");
  await ensureSchema().catch((err) => console.error("[rotina] banco indisponível", err instanceof Error ? err.message : err));
}
