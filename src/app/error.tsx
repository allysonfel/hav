"use client";

export default function Erro({ reset }: { reset: () => void }) {
  return (
    <div className="login">
      <div className="login-card">
        <h1>Algo não saiu como esperado</h1>
        <p className="sub">Tente de novo. Se continuar, avise a equipe.</p>
        <button className="btn btn-primary btn-block" onClick={reset}>Tentar de novo</button>
      </div>
    </div>
  );
}
