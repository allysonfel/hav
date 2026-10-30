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
};

export function FormUsina({ usina, status }: { usina?: UsinaForm; status?: string }) {
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
      </div>
      <div className="box-title">Inversores e monitoramento</div>
      <div className="form-grid">
        <div className="field"><label htmlFor="marca">Marca</label><input id="marca" name="marca" defaultValue={usina?.inversor_marca} maxLength={60} /></div>
        <div className="field"><label htmlFor="modelo">Modelo</label><input id="modelo" name="modelo" defaultValue={usina?.inversor_modelo} maxLength={60} /></div>
        <div className="field"><label htmlFor="qtd">Quantidade</label><input id="qtd" name="qtd" type="number" min={0} max={100000} defaultValue={usina?.inversor_qtd ?? 0} /></div>
        <div className="field"><label htmlFor="monitoramento">App ou site de monitoramento</label><input id="monitoramento" name="monitoramento" defaultValue={usina?.monitoramento} maxLength={120} /></div>
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
  duplicada: "Já existe uma usina com esse nome.",
  movimento: "Esta usina tem cotistas, lançamentos ou interessados e não pode ser excluída. Use o status Pausada.",
};
