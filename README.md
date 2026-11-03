# HAV Energia

Painel interno (usinas, investidores, captação, rateio) e app do investidor. Next.js + PostgreSQL + Railway.

## Rodar local
1. Postgres na porta 5434, banco `hav_local`.
2. `.env.local` a partir do `.env.example`.
3. `npm run dev` → http://localhost:3800/painel
4. Demonstração: com o sistema já tendo subido uma vez, `DATABASE_URL=... node scripts/seed-demo.mjs`.

`npm run teste` confere o cálculo do rateio. O backup diário é um serviço separado, na pasta `backup/`.

## Plano Plus
- Agente de IA (botão dourado) no painel e no app: `src/lib/agente.ts`. Contexto montado no servidor pelo perfil (operador sem captação; investidor só os próprios dados). Precisa de `GROQ_API_KEY`.
- Comparativo entre usinas: `/painel/comparativo` (geração, receita, kWh/kWp, R$/kWp). No app, em Usinas, quando o investidor tem 2 ou mais.
- Histórico de 12 ou 24 meses com projeção de 3 meses (`src/lib/projecao.ts`, testada em `npm run teste`). No app, só com "projeção no app" ligada em Configurações.
- PDF com a identidade da HAV: `src/lib/pdf/RelatoriosPdf.tsx` (relatório do investidor e rateio da usina).
- Relatório mensal por e-mail: ao fechar o mês entra na fila `envios_email` (`src/lib/envios.ts`), processada logo depois e a cada 5 min. Precisa de `RESEND_API_KEY`; sem ela, em desenvolvimento fica "simulado" no log.
