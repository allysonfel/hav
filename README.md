# HAV Energia

Painel interno (usinas, investidores, captação, rateio) e app do investidor. Next.js + PostgreSQL + Railway.

## Rodar local
1. Postgres na porta 5434, banco `hav_local`.
2. `.env.local` a partir do `.env.example`.
3. `npm run dev` → http://localhost:3800/painel
4. Demonstração: com o sistema já tendo subido uma vez, `DATABASE_URL=... node scripts/seed-demo.mjs`.

`npm run teste` confere o cálculo do rateio. O backup diário é um serviço separado, na pasta `backup/`.
