import { salvarInvestidor } from "./acoes";

type Dados = { id: number; nome: string; email: string; celular: string; documento: string; pix: string; banco: string; agencia: string; conta: string };

export function FormInvestidor({ inv }: { inv?: Dados }) {
  return (
    <form action={salvarInvestidor} className="card card-p" style={{ maxWidth: 760 }}>
      {inv && <input type="hidden" name="id" value={inv.id} />}
      <div className="form-grid">
        <div className="field inteiro"><label htmlFor="nome">Nome ou razão social</label><input id="nome" name="nome" defaultValue={inv?.nome} required maxLength={120} /></div>
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={inv?.email} required maxLength={160} /><small>Será o login no app do investidor.</small></div>
        <div className="field"><label htmlFor="celular">Celular</label><input id="celular" name="celular" defaultValue={inv?.celular} maxLength={20} inputMode="tel" placeholder="(81) 99999-0000" /></div>
        <div className="field"><label htmlFor="documento">CPF ou CNPJ</label><input id="documento" name="documento" defaultValue={inv?.documento} maxLength={20} inputMode="numeric" /><small>Guardado com criptografia.</small></div>
        <div className="field"><label htmlFor="pix">Chave Pix para repasse</label><input id="pix" name="pix" defaultValue={inv?.pix} maxLength={140} /><small>Guardada com criptografia.</small></div>
      </div>
      <div className="box-title">Conta bancária para repasse (opcional)</div>
      <div className="form-grid">
        <div className="field"><label htmlFor="banco">Banco</label><input id="banco" name="banco" defaultValue={inv?.banco} maxLength={60} placeholder="Caixa Econômica Federal" /></div>
        <div className="field"><label htmlFor="agencia">Agência</label><input id="agencia" name="agencia" defaultValue={inv?.agencia} maxLength={12} inputMode="numeric" placeholder="0974-1" /></div>
        <div className="field"><label htmlFor="conta">Conta com dígito</label><input id="conta" name="conta" defaultValue={inv?.conta} maxLength={24} placeholder="577141806-0" /><small>Sai no relatório do investidor, em Dados para pagamento. Guardada com criptografia.</small></div>
      </div>
      <button className="btn btn-primary">{inv ? "Salvar alterações" : "Cadastrar investidor"}</button>
    </form>
  );
}

export const ERROS_INVESTIDOR: Record<string, string> = {
  nome: "Informe o nome.",
  email: "Confira o e-mail.",
  email_dup: "Já existe um investidor com esse e-mail.",
  celular: "Confira o celular, com DDD.",
  documento: "CPF ou CNPJ inválido.",
  conta: "Conta bancária incompleta: informe banco, agência e conta (só números e traço), ou deixe os três em branco.",
  documento_dup: "Já existe um investidor com esse CPF/CNPJ.",
  movimento: "Este investidor tem cotas ou histórico e não pode ser excluído. Use Desativar.",
};
