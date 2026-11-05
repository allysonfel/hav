// Conexão com o PostgreSQL e criação das tabelas.
//
// As tabelas são criadas sozinhas na primeira consulta (CREATE TABLE IF NOT
// EXISTS): subir o sistema num banco vazio já basta, sem passo manual de
// migração. Um lock de transação evita corrida quando mais de um processo
// sobe ao mesmo tempo. Dinheiro em centavos, energia em Wh, potência em Wp e
// cota em partes por milhão (180000 = 18%): tudo inteiro, nunca float.
import postgres from "postgres";
import { hashPassword } from "./auth";

const url = process.env.DATABASE_URL ?? "";

// Rede interna do Railway (ou banco local) não usa SSL; acesso de fora usa
// SSL quando o servidor oferece.
export const sql = postgres(url, {
  ssl: url.includes(".railway.internal") || url.includes("localhost") || url.includes("127.0.0.1") ? false : "prefer",
  max: 10,
  onnotice: () => {},
  types: {
    bigint: { to: 20, from: [20], serialize: (v: number) => String(v), parse: (v: string) => Number(v) },
  },
});

const SCHEMA = `
-- Busca por nome sem acento (sem depender da extensão unaccent).
CREATE OR REPLACE FUNCTION unaccent_simples(t TEXT) RETURNS TEXT AS $$
  SELECT translate(lower(t), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS configuracoes (
  id INT PRIMARY KEY CHECK (id = 1),
  dados JSONB NOT NULL DEFAULT '{}'
);

-- Equipe do painel. admin: tudo; operador: lança geração e emite relatórios,
-- sem valores de captação, dados bancários e documentos.
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 80),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'operador')),
  telefone TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  sessao_versao INT NOT NULL DEFAULT 1,
  ultimo_acesso TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tentativas_falhas (
  id BIGSERIAL PRIMARY KEY,
  chave TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tentativas_chave_idx ON tentativas_falhas (chave, criado_em);

-- Só inserção: quem fez o quê. Nunca guardar documento, chave Pix ou senha.
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  ator TEXT NOT NULL,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id INT,
  detalhe TEXT,
  ip TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- investimento_centavos: total da usina (em captação, é a meta).
CREATE TABLE IF NOT EXISTS usinas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE CHECK (length(nome) BETWEEN 2 AND 80),
  cidade TEXT NOT NULL DEFAULT '',
  uf TEXT NOT NULL DEFAULT '' CHECK (uf = '' OR uf ~ '^[A-Z]{2}$'),
  capacidade_wp BIGINT NOT NULL CHECK (capacidade_wp > 0),
  investimento_centavos BIGINT NOT NULL CHECK (investimento_centavos > 0),
  status TEXT NOT NULL DEFAULT 'operando' CHECK (status IN ('operando', 'captacao', 'pausada')),
  operando_desde DATE,
  inversor_marca TEXT NOT NULL DEFAULT '',
  inversor_modelo TEXT NOT NULL DEFAULT '',
  inversor_qtd INT NOT NULL DEFAULT 0 CHECK (inversor_qtd BETWEEN 0 AND 100000),
  monitoramento TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documento e chave Pix ficam criptografados (lib/cifra.ts). documento_hash só
-- serve para impedir duplicidade; documento_final, para mostrar mascarado.
-- senha_hash e sessao_versao são do login no app do investidor.
CREATE TABLE IF NOT EXISTS investidores (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 120),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  celular TEXT NOT NULL DEFAULT '',
  documento_cifrado TEXT,
  documento_hash TEXT UNIQUE,
  documento_final TEXT NOT NULL DEFAULT '',
  pix_cifrado TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  senha_hash TEXT,
  sessao_versao INT NOT NULL DEFAULT 1,
  ultimo_acesso TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participação vigente. O histórico não depende daqui: cada mês fechado guarda
-- a foto em rateios. Cota removida fica inativa, não some.
CREATE TABLE IF NOT EXISTS cotas (
  id SERIAL PRIMARY KEY,
  usina_id INT NOT NULL REFERENCES usinas(id),
  investidor_id INT NOT NULL REFERENCES investidores(id),
  cota_ppm INT NOT NULL CHECK (cota_ppm BETWEEN 1 AND 1000000),
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  ativa BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usina_id, investidor_id)
);

-- Lançamento do mês de uma usina. Rascunho é editável e o investidor não vê.
CREATE TABLE IF NOT EXISTS fechamentos (
  id SERIAL PRIMARY KEY,
  usina_id INT NOT NULL REFERENCES usinas(id),
  competencia DATE NOT NULL CHECK (EXTRACT(DAY FROM competencia) = 1),
  geracao_wh BIGINT NOT NULL CHECK (geracao_wh >= 0),
  receita_centavos BIGINT NOT NULL CHECK (receita_centavos >= 0),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'fechado')),
  lancado_por INT REFERENCES usuarios(id),
  lancado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_por INT REFERENCES usuarios(id),
  fechado_em TIMESTAMPTZ,
  UNIQUE (usina_id, competencia)
);

-- Foto do rateio no fechamento. Só existe para mês fechado.
CREATE TABLE IF NOT EXISTS rateios (
  id SERIAL PRIMARY KEY,
  fechamento_id INT NOT NULL REFERENCES fechamentos(id),
  investidor_id INT NOT NULL REFERENCES investidores(id),
  cota_ppm INT NOT NULL CHECK (cota_ppm BETWEEN 1 AND 1000000),
  geracao_wh BIGINT NOT NULL CHECK (geracao_wh >= 0),
  receita_centavos BIGINT NOT NULL CHECK (receita_centavos >= 0),
  repasse_status TEXT NOT NULL DEFAULT 'pendente' CHECK (repasse_status IN ('pendente', 'pago')),
  pago_em TIMESTAMPTZ,
  pago_por INT REFERENCES usuarios(id),
  UNIQUE (fechamento_id, investidor_id)
);
CREATE INDEX IF NOT EXISTS rateios_investidor_idx ON rateios (investidor_id);

-- Link de primeiro acesso ou de nova senha do investidor. Só o hash fica aqui.
CREATE TABLE IF NOT EXISTS acesso_tokens (
  id SERIAL PRIMARY KEY,
  investidor_id INT NOT NULL REFERENCES investidores(id),
  token_hash TEXT NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Avisos dentro do app do investidor.
CREATE TABLE IF NOT EXISTS avisos_investidor (
  id SERIAL PRIMARY KEY,
  investidor_id INT NOT NULL REFERENCES investidores(id),
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '/',
  lido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS avisos_investidor_idx ON avisos_investidor (investidor_id, criado_em DESC);

ALTER TABLE investidores ADD COLUMN IF NOT EXISTS aceite_em TIMESTAMPTZ;

-- Funil da captação.
CREATE TABLE IF NOT EXISTS interesses (
  id SERIAL PRIMARY KEY,
  usina_id INT NOT NULL REFERENCES usinas(id),
  investidor_id INT REFERENCES investidores(id),
  nome TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 120),
  telefone TEXT NOT NULL DEFAULT '',
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  origem TEXT NOT NULL DEFAULT 'indicacao' CHECK (origem IN ('app', 'indicacao', 'equipe')),
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'negociacao', 'confirmado', 'desistiu')),
  observacao TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Um pedido em aberto por investidor em cada usina.
CREATE UNIQUE INDEX IF NOT EXISTS interesses_aberto_idx ON interesses (usina_id, investidor_id)
  WHERE investidor_id IS NOT NULL AND status IN ('aguardando', 'negociacao');

-- Fase 3 (Plus). Investidor pode desligar o relatório mensal por e-mail.
ALTER TABLE investidores ADD COLUMN IF NOT EXISTS relatorio_email BOOLEAN NOT NULL DEFAULT true;

-- Fila do relatório mensal por e-mail: uma linha por investidor em cada mês
-- fechado. Reabrir e fechar de novo volta a linha para pendente.
CREATE TABLE IF NOT EXISTS envios_email (
  id SERIAL PRIMARY KEY,
  fechamento_id INT NOT NULL REFERENCES fechamentos(id),
  investidor_id INT NOT NULL REFERENCES investidores(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviando', 'enviado', 'simulado', 'falhou', 'cancelado')),
  tentativas INT NOT NULL DEFAULT 0,
  erro TEXT NOT NULL DEFAULT '',
  proxima_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fechamento_id, investidor_id)
);
CREATE INDEX IF NOT EXISTS envios_fila_idx ON envios_email (status, proxima_em);

-- Dados de demonstração (botão em Visão geral e Configurações): o que foi criado
-- para apresentar fica anotado aqui, para remover só isso (lib/demo.ts).
CREATE TABLE IF NOT EXISTS demo_registros (
  tabela TEXT NOT NULL,
  id BIGINT NOT NULL,
  PRIMARY KEY (tabela, id)
);

-- Geração esperada da usina por mês (média do projeto). Serve para comparar o
-- real com o esperado e avisar quando a usina rende menos. Opcional.
ALTER TABLE usinas ADD COLUMN IF NOT EXISTS geracao_esperada_wh BIGINT CHECK (geracao_esperada_wh IS NULL OR geracao_esperada_wh > 0);

-- Comprovante do Pix de um repasse (imagem ou PDF, até 3 MB). Um por repasse;
-- o tipo é conferido pelos primeiros bytes. Desfazer o pagamento apaga.
CREATE TABLE IF NOT EXISTS comprovantes (
  id SERIAL PRIMARY KEY,
  rateio_id INT NOT NULL UNIQUE REFERENCES rateios(id) ON DELETE CASCADE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  nome TEXT NOT NULL DEFAULT '' CHECK (length(nome) <= 120),
  tamanho INT NOT NULL CHECK (tamanho > 0 AND tamanho <= 3145728),
  conteudo BYTEA NOT NULL,
  enviado_por INT REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Valor pago por kWh gerado, por usina, em décimos de milésimo de real
-- (R$ 0,56 = 5600). Com ele a receita do mês sai da geração. Opcional: sem
-- valor, a equipe lança a receita em reais como antes. O fechamento guarda a
-- tarifa usada, para o histórico não mudar se a tarifa mudar depois.
ALTER TABLE usinas ADD COLUMN IF NOT EXISTS tarifa_kwh INT CHECK (tarifa_kwh IS NULL OR tarifa_kwh BETWEEN 1 AND 1000000);
ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS tarifa_kwh INT CHECK (tarifa_kwh IS NULL OR tarifa_kwh BETWEEN 1 AND 1000000);
-- Disponibilidade da usina no período (do app de monitoramento), em ppm. Opcional.
ALTER TABLE fechamentos ADD COLUMN IF NOT EXISTS disponibilidade_ppm INT CHECK (disponibilidade_ppm IS NULL OR disponibilidade_ppm BETWEEN 0 AND 1000000);
-- Conta bancária do investidor para o repasse (banco, agência, conta),
-- criptografada como a chave Pix.
ALTER TABLE investidores ADD COLUMN IF NOT EXISTS conta_cifrada TEXT;

-- Integração com o app de monitoramento dos inversores (lib/monitoramento).
-- monitoramento_tipo: '' (sem integração) ou 'solis'; monitoramento_id: id da
-- usina no app. A chave de acesso fica só no ambiente, nunca no banco.
ALTER TABLE usinas ADD COLUMN IF NOT EXISTS monitoramento_tipo TEXT NOT NULL DEFAULT '' CHECK (monitoramento_tipo IN ('', 'solis'));
ALTER TABLE usinas ADD COLUMN IF NOT EXISTS monitoramento_id TEXT NOT NULL DEFAULT '' CHECK (length(monitoramento_id) <= 40);
ALTER TABLE usinas ADD COLUMN IF NOT EXISTS monitoramento_sinc TIMESTAMPTZ;
ALTER TABLE usinas ADD COLUMN IF NOT EXISTS monitoramento_erro TEXT NOT NULL DEFAULT '';

-- Geração de cada dia, puxada do app de monitoramento (fonte 'solis') ou da
-- demonstração ('demo'). O dia de hoje vai sendo atualizado ao longo do dia.
-- Tarifa aferida da usina (R$/kWh da energia compensada, como no relatório da
-- HAV), mesma escala da tarifa_kwh. Só informativa no relatório.
ALTER TABLE usinas ADD COLUMN IF NOT EXISTS tarifa_aferida INT CHECK (tarifa_aferida IS NULL OR tarifa_aferida BETWEEN 1 AND 1000000);

CREATE TABLE IF NOT EXISTS geracao_diaria (
  usina_id INT NOT NULL REFERENCES usinas(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  geracao_wh BIGINT NOT NULL CHECK (geracao_wh >= 0),
  fonte TEXT NOT NULL DEFAULT 'solis' CHECK (fonte IN ('solis', 'demo')),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usina_id, dia)
);
`;

let pronto: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  pronto ??= (async () => {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(884201)`;
      await tx.unsafe(SCHEMA);
      await tx`INSERT INTO configuracoes (id) VALUES (1) ON CONFLICT DO NOTHING`;
      const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM usuarios`;
      if (n === 0) {
        const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
        const senha = process.env.INITIAL_ADMIN_PASSWORD;
        if (email && senha) {
          await tx`INSERT INTO usuarios (nome, email, senha_hash, perfil)
            VALUES (${process.env.INITIAL_ADMIN_NAME ?? "Administrador"}, ${email}, ${hashPassword(senha)}, 'admin')`;
        }
      }
    });
  })().catch((err) => {
    pronto = null;
    throw err;
  });
  return pronto;
}
