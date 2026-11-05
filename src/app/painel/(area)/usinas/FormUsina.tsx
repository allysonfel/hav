import { salvarUsina } from "./acoes";
import { campoDecimal } from "@/lib/format";

export type UsinaForm = {
  id: number;
  nome: string;
  cidade: string;
  uf: string;
  capacidade_wp: number;
  investimento_centavos: number;
  status: string;
  desde: string | null;
  inversor_marca: string;
  inversor_modelo: string;
  inversor_qtd: number;
  monitoramento: string;
  geracao_esperada_wh: number | null;
  tarifa_kwh: number | null;
  tarifa_aferida: number | null;
  monitoramento_tipo: string;
  monitoramento_id: string;
};

export function FormUsina({ usina, status, solis }: { usina?: UsinaForm; status?: string; solis?: { configurada: boolean; usinas: { id: string; nome: string }[]; erro?: string } }) {
  return (
    <form action={salvarUsina} className="card card-p" style={{ maxWidth: 760 }}>
      {usina && <input type="hidden" name="id" value={usina.id} />}
      <div className="box-title">Usina</div>
      <div className="form-grid">
        <div className="field inteiro"><label htmlFor="nome">Nome</label><input id="nome" name="nome" defaultValue={usina?.nome} required maxLength={80} placeholder="Usina Horizonte Dourado" /></div>
        <div className="field"><label htmlFor="cidade">Cidade</label><input id="cidade" name="cidade" defaultValue={usina?.cidade} maxLength={80} /></div>
        <div className="field"><label htmlFor="uf">UF</label><input id="uf" name="uf" defaultValue={usina?.uf} maxLength={2} placeholder="PE" /></div>
        <div className="field"><label htmlFor="capacidade">Capacidade (kWp)</label><input id="capacidade" name="capacidade" defaultValue={usina ? campoDecimal(usina.capacidade_wp / 1000, 3) : ""} required inputMode="decimal" placeholder="1.100" /></div>
        <div className="field">
          <label htmlFor="investimento">Investimento total (R$)</label>
          <input id="investimento" name="investimento" defaultValue={usina ? campoDecimal(usina.investimento_centavos / 100, 2) : ""} required inputMode="decimal" placeholder="3.800.000" />
          <small>Em captação, é a meta. A cota de cada investidor sai deste valor.</small>
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={usina?.status ?? status ?? "operando"}>
            <option value="operando">Operando</option>
            <option value="captacao">Em captação</option>
            <option value="pausada">Pausada</option>
          </select>
        </div>
        <div className="field"><label htmlFor="desde">Operando desde</label><input id="desde" name="desde" type="month" defaultValue={usina?.desde ?? ""} /></div>
        <div className="field inteiro">
          <label htmlFor="tarifa">Valor pago por kWh gerado (R$)</label>
          <input id="tarifa" name="tarifa" defaultValue={usina?.tarifa_kwh ? campoDecimal(usina.tarifa_kwh / 10_000, 4) : ""} inputMode="decimal" placeholder="0,56" />
          <small>Com ele, a receita do mês é calculada sozinha: geração x este valor, e cada cotista recebe a parte da própria cota. Sem ele, a receita é digitada no lançamento.</small>
        </div>
        <div className="field inteiro">
          <label htmlFor="aferida">Tarifa aferida (R$/kWh, opcional)</label>
          <input id="aferida" name="aferida" defaultValue={usina?.tarifa_aferida ? campoDecimal(usina.tarifa_aferida / 10_000, 4) : ""} inputMode="decimal" placeholder="1,09" />
          <small>Só aparece no relatório do investidor, ao lado da tarifa contratada. Não entra no cálculo.</small>
        </div>
        <div className="field inteiro">
          <label htmlFor="esperada">Geração esperada por mês (kWh, opcional)</label>
          <input id="esperada" name="esperada" defaultValue={usina?.geracao_esperada_wh ? campoDecimal(usina.geracao_esperada_wh / 1000, 0) : ""} inputMode="decimal" placeholder="135.000" />
          <small>Média mensal do projeto da usina. Com ela, o sistema mostra quanto do esperado a usina gerou e avisa quando ficar abaixo de 85%.</small>
        </div>
      </div>
      <div className="box-title">Inversores e monitoramento</div>
      <div className="form-grid">
        <div className="field"><label htmlFor="marca">Marca</label><input id="marca" name="marca" defaultValue={usina?.inversor_marca} maxLength={60} /></div>
        <div className="field"><label htmlFor="modelo">Modelo</label><input id="modelo" name="modelo" defaultValue={usina?.inversor_modelo} maxLength={60} /></div>
        <div className="field"><label htmlFor="qtd">Quantidade</label><input id="qtd" name="qtd" type="number" min={0} max={100000} defaultValue={usina?.inversor_qtd ?? 0} /></div>
        <div className="field"><label htmlFor="monitoramento">App ou site de monitoramento</label><input id="monitoramento" name="monitoramento" defaultValue={usina?.monitoramento} maxLength={120} /></div>
      </div>
      <div className="box-title">Integração com o monitoramento</div>
      <p className="muted sm" style={{ margin: "0 0 10px" }}>Ligada, a geração de cada dia entra sozinha no sistema: o investidor acompanha no app quanto a usina gerou e quanto vai receber no período, e o lançamento do mês já vem preenchido.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="mon_tipo">Integração</label>
          <select id="mon_tipo" name="mon_tipo" defaultValue={usina?.monitoramento_tipo ?? ""}>
            <option value="">Sem integração (geração lançada à mão)</option>
            <option value="solis">Solis (SolisCloud)</option>
          </select>
          {solis && !solis.configurada && <small>A chave da Solis ainda não foi configurada no servidor. Dá para deixar a usina vinculada: os dados começam a entrar quando a chave for ligada.</small>}
        </div>
        <div className="field">
          <label htmlFor="mon_id">Usina na Solis</label>
          {solis?.usinas.length ? (
            <select id="mon_id" name="mon_id" defaultValue={usina?.monitoramento_id ?? ""}>
              <option value="">Escolha</option>
              {solis.usinas.map((s) => <option key={s.id} value={s.id}>{s.nome} (ID {s.id})</option>)}
              {usina?.monitoramento_id && !solis.usinas.some((s) => s.id === usina.monitoramento_id) && <option value={usina.monitoramento_id}>ID {usina.monitoramento_id}</option>}
            </select>
          ) : (
            <input id="mon_id" name="mon_id" defaultValue={usina?.monitoramento_id} maxLength={40} inputMode="numeric" placeholder="ID da usina no SolisCloud" />
          )}
          <small>{solis?.erro ? `Não deu para listar as usinas da Solis agora (${solis.erro}). Informe o ID.` : "O ID aparece no endereço da usina no site do SolisCloud."}</small>
        </div>
      </div>
      <button className="btn btn-primary">{usina ? "Salvar alterações" : "Cadastrar usina"}</button>
    </form>
  );
}

export const ERROS_USINA: Record<string, string> = {
  nome: "Informe o nome da usina.",
  uf: "A UF tem 2 letras (ex.: PE).",
  capacidade: "Informe a capacidade em kWp.",
  investimento: "Informe o investimento total.",
  qtd: "Confira a quantidade de inversores.",
  tarifa: "Confira o valor por kWh (ex.: 0,56).",
  aferida: "Confira a tarifa aferida (ex.: 1,09).",
  integracao: "Com a integração ligada, escolha a usina na Solis (ID só com números).",
  esperada: "Confira a geração esperada por mês (em kWh, a partir de 1).",
  duplicada: "Já existe uma usina com esse nome.",
  movimento: "Esta usina tem cotistas, lançamentos ou interessados e não pode ser excluída. Use o status Pausada.",
};
