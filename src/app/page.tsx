import { redirect } from "next/navigation";

// O app do investidor entra aqui na fase 2.
export default function Inicio() {
  redirect("/painel");
}
