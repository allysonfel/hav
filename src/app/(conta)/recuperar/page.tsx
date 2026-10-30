import { Abas } from "../Abas";
import { pedirLink } from "../acoes";

export default async function Recuperar({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const { enviado } = await searchParams;
  return (
    <>
      <Abas atual="/recuperar" />
      {enviado ? (
        <div className="aviso ok">Se esse e-mail estiver cadastrado, o link chega em instantes. Confira também a caixa de spam.</div>
      ) : (
        <form action={pedirLink}>
          <div className="field"><label htmlFor="email">E-mail cadastrado</label><input id="email" name="email" type="email" required maxLength={160} /></div>
          <button className="btn btn-primary btn-block">Enviar link</button>
        </form>
      )}
    </>
  );
}
