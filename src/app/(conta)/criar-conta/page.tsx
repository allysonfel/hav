import { Abas } from "../Abas";
import { pedirLink } from "../acoes";

export default async function CriarConta({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  return (
    <>
      <Abas atual="/criar-conta" />
      <p className="muted sm" style={{ marginTop: 0 }}>O app é para investidores da HAV Energia. Informe o e-mail que você passou à equipe e enviaremos um link para criar sua senha.</p>
      {enviado ? (
        <div className="aviso ok">Se esse e-mail estiver cadastrado, o link chega em instantes. Confira também a caixa de spam.</div>
      ) : (
        <form action={pedirLink}>
          <input type="hidden" name="origem" value="criar-conta" />
          <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" required maxLength={160} /></div>
          <button className="btn btn-primary btn-block">Enviar link</button>
        </form>
      )}
    </>
  );
}
