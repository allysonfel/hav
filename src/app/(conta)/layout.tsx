export default function ContaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="inv-login">
      <div className="inv-login-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icone-192.png" alt="" />
        <h1>HAV Energia</h1>
        <p>Mais que energia. Valor.</p>
        <p className="inv-login-texto">Acompanhe a geração, a receita e os repasses das suas usinas num só lugar.</p>
      </div>
      <div className="inv-login-sheet">{children}</div>
    </div>
  );
}
