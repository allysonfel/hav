"use client";

export default function Erro({ reset }: { reset: () => void }) {
  return (
    <div className="card card-p">
      <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Algo não saiu como esperado</h3>
      <p className="muted sm" style={{ margin: "0 0 14px" }}>Tente de novo. Se continuar, avise o suporte.</p>
      <button className="btn btn-primary" onClick={reset}>Tentar de novo</button>
    </div>
  );
}
